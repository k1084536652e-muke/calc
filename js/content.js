import {
  decryptMetadata,
  encryptMetadata,
} from "./archive.js";
import {
  htmlToPlainText,
  textBodyToHtml,
  textRecordForDisplay,
} from "./text-content.js";

export const CONTENT_SCHEMA_VERSION = 1;
export const TEXT_SCHEMA_VERSION = 2;

const SUPPORTED_VERSIONS = Object.freeze({
  folder: [CONTENT_SCHEMA_VERSION],
  text: [CONTENT_SCHEMA_VERSION, TEXT_SCHEMA_VERSION],
});

const MEDIA_EXTENSION_TYPES = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/heic", ".heic"],
  ["image/gif", ".gif"],
  ["image/webp", ".webp"],
  ["video/mp4", ".mp4"],
  ["video/quicktime", ".mov"],
]);

export function splitMediaName(name, mimeType = "") {
  const value = String(name || "");
  const dotIndex = value.lastIndexOf(".");
  if (dotIndex > 0) {
    const candidate = value.slice(dotIndex + 1);
    if (/^[A-Za-z0-9]{1,10}$/.test(candidate)) {
      return {
        base: value.slice(0, dotIndex),
        ext: value.slice(dotIndex),
      };
    }
  }
  const normalizedMime = String(mimeType)
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  return {
    base: value,
    ext: MEDIA_EXTENSION_TYPES.get(normalizedMime) || "",
  };
}

export function validateMediaBaseName(value, ext = "") {
  const base = String(value || "").trim();
  if (!base || base === "." || base === "..") {
    return "请输入名称";
  }
  if (/[/\\\u0000-\u001f\u007f]/.test(base)) {
    return "名称不能包含 / 或 \\";
  }
  if (`${base}${ext}`.length > 90) {
    return "名称过长";
  }
  return "";
}

export function contentId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function envelope(id, encrypted) {
  return {
    id,
    iv: encrypted.iv,
    ciphertext: encrypted.ciphertext,
  };
}

function textPayload(text) {
  const requestedVersion = Number(text.schemaVersion);
  const schemaVersion =
    requestedVersion === TEXT_SCHEMA_VERSION
      ? TEXT_SCHEMA_VERSION
      : CONTENT_SCHEMA_VERSION;
  if (!SUPPORTED_VERSIONS.text.includes(requestedVersion || CONTENT_SCHEMA_VERSION)) {
    throw new Error("不支持的文本格式");
  }
  const payload = {
    id: text.id,
    type: "text",
    kind: "text",
    title: String(text.title || ""),
    body: String(text.body || ""),
    createdAt: Number(text.createdAt) || Date.now(),
    updatedAt: Number(text.updatedAt) || Date.now(),
    folderId: text.folderId ?? null,
    schemaVersion,
  };
  if (schemaVersion === TEXT_SCHEMA_VERSION) {
    payload.format = "html";
    payload.html = String(
      text.html ??
        textBodyToHtml(payload.body)
    );
    payload.body =
      text.body === undefined
        ? htmlToPlainText(payload.html)
        : String(text.body);
  }
  return payload;
}

function folderPayload(folder) {
  return {
    id: folder.id,
    type: "folder",
    name: String(folder.name || ""),
    createdAt: Number(folder.createdAt) || Date.now(),
    updatedAt: Number(folder.updatedAt) || Date.now(),
    schemaVersion: CONTENT_SCHEMA_VERSION,
  };
}

function validateEnvelope(record, expectedId, expectedType) {
  const versions = SUPPORTED_VERSIONS[expectedType] || [];
  if (
    !record ||
    record.id !== expectedId ||
    record.type !== expectedType ||
    !versions.includes(record.schemaVersion)
  ) {
    throw new Error("不支持的内容格式");
  }
  return record;
}

export async function saveText({ crypto, key, db, text }) {
  const payload = textPayload(text);
  const encrypted = await crypto.encryptJson(payload, key);
  await db.saveText(envelope(payload.id, encrypted));
  return payload;
}

export async function decryptText({ crypto, key, envelope: record }) {
  const payload = await crypto.decryptJson(
    record.ciphertext,
    record.iv,
    key
  );
  return textRecordForDisplay(
    validateEnvelope(payload, record.id, "text")
  );
}

export async function renameTextRecord({
  crypto,
  key,
  db,
  id,
  title,
  now = Date.now(),
}) {
  const envelopes = await db.getTextEnvelopes();
  const envelope = envelopes.find((item) => item.id === id);
  if (!envelope) {
    return null;
  }
  const current = await decryptText({ crypto, key, envelope });
  return saveText({
    crypto,
    key,
    db,
    text: {
      ...current,
      title,
      updatedAt: now,
    },
  });
}

export async function saveFolder({ crypto, key, db, folder }) {
  const payload = folderPayload(folder);
  const encrypted = await crypto.encryptJson(payload, key);
  await db.saveFolder(envelope(payload.id, encrypted));
  return payload;
}

export async function decryptFolder({ crypto, key, envelope: record }) {
  const payload = await crypto.decryptJson(
    record.ciphertext,
    record.iv,
    key
  );
  return validateEnvelope(payload, record.id, "folder");
}

/**
 * Re-encrypts only content metadata. Media chunks and thumbnails are not read.
 */
export async function moveContentRecords({
  crypto,
  key,
  db,
  records,
  folderId,
}) {
  if (records.some((record) => record.legacy)) {
    throw new Error("旧内容整理完成后才能移动");
  }
  const moved = [];
  for (const record of records) {
    const targetFolderId = folderId ?? null;
    if (record.kind === "text") {
      moved.push(
        await saveText({
          crypto,
          key,
          db,
          text: {
            ...record,
            folderId: targetFolderId,
            updatedAt: Date.now(),
          },
        })
      );
      continue;
    }

    const metadata = {
      ...record,
      folderId: targetFolderId,
    };
    delete metadata.legacy;
    await db.saveMedia(
      await encryptMetadata(crypto, key, metadata),
      null
    );
    moved.push(metadata);
  }
  return moved;
}

/**
 * Re-encrypts media metadata while leaving chunks and thumbnails untouched.
 * Returns null when the active record changed or no longer exists.
 */
export async function renameMediaRecord({
  crypto,
  key,
  db,
  id,
  name,
  now = Date.now(),
}) {
  const currentEnvelope = await db.getMetaEnvelope(id);
  if (!currentEnvelope) {
    return null;
  }
  if (await db.getTrashMetaEnvelope?.(id)) {
    return null;
  }
  const current = await decryptMetadata(crypto, key, currentEnvelope);
  const metadata = {
    ...current,
    name,
    updatedAt: now,
  };
  await db.saveMetadata(
    await encryptMetadata(crypto, key, metadata)
  );
  return metadata;
}

export async function deleteContentRecords({ db, records }) {
  for (const record of records) {
    if (record.kind === "text") {
      await db.deleteText(record.id);
    } else {
      // DataStore.deleteMedia removes every chunk in the same transaction.
      await db.deleteMedia(record.id);
    }
  }
}

/**
 * Deletes a folder shell. Its contents are either moved to the uncategorized
 * root or removed before the shell itself is deleted.
 */
export async function removeFolder({
  crypto,
  key,
  db,
  folder,
  contents,
  contentsMode,
}) {
  if (contentsMode === "move") {
    await moveContentRecords({
      crypto,
      key,
      db,
      records: contents,
      folderId: null,
    });
  } else if (contentsMode === "delete") {
    await deleteContentRecords({ db, records: contents });
  } else {
    throw new TypeError("无效的文件夹处理方式");
  }
  await db.deleteFolder(folder.id);
}
