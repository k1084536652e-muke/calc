import { encryptMetadata } from "./archive.js";

export const CONTENT_SCHEMA_VERSION = 1;

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
  return {
    id: text.id,
    type: "text",
    kind: "text",
    title: String(text.title || ""),
    body: String(text.body || ""),
    createdAt: Number(text.createdAt) || Date.now(),
    updatedAt: Number(text.updatedAt) || Date.now(),
    folderId: text.folderId ?? null,
    schemaVersion: CONTENT_SCHEMA_VERSION,
  };
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
  if (
    !record ||
    record.id !== expectedId ||
    record.schemaVersion !== CONTENT_SCHEMA_VERSION ||
    record.type !== expectedType
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
  return validateEnvelope(payload, record.id, "text");
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
