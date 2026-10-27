import {
  decryptMetadata,
  encryptMetadata,
} from "./archive.js";
import { decryptFolder, decryptText } from "./content.js";

export const TRASH_SCHEMA_VERSION = 1;
export const DAY_MS = 24 * 60 * 60 * 1_000;

function withoutTrashState(record) {
  const { trashedAt, trashSchemaVersion, legacy, ...content } = record;
  return content;
}

async function encryptJsonEnvelope(crypto, key, id, payload) {
  const encrypted = await crypto.encryptJson(payload, key);
  return {
    id,
    iv: encrypted.iv,
    ciphertext: encrypted.ciphertext,
  };
}

export function trashPurgeEntryKey(item) {
  return `${item.trashType}:${item.id}`;
}

export function buildTrashPurgeEntries(items, retentionDays) {
  if (retentionDays === null) {
    return [];
  }
  const days = Number(retentionDays);
  if (!Number.isFinite(days) || days <= 0) {
    return [];
  }
  return items
    .filter(
      (item) =>
        typeof item?.id === "string" &&
        ["media", "text", "folder"].includes(item.trashType) &&
        Number.isFinite(item.trashedAt)
    )
    .map((item) => ({
      id: item.id,
      trashType: item.trashType,
      expiresAt: item.trashedAt + days * DAY_MS,
    }));
}

export async function trashContentRecords({
  crypto,
  key,
  db,
  records,
  folder = null,
  retentionDays = null,
  now = Date.now(),
}) {
  if (records.some((record) => record.legacy)) {
    throw new Error("旧内容整理完成后才能删除");
  }
  const trashed = [];
  if (folder) {
    const payload = {
      ...withoutTrashState(folder),
      trashedAt: now,
      trashSchemaVersion: TRASH_SCHEMA_VERSION,
    };
    const envelope = await encryptJsonEnvelope(
      crypto,
      key,
      folder.id,
      payload
    );
    await db.moveFolderToTrash(envelope);
    trashed.push({
      ...payload,
      id: folder.id,
      kind: "folder",
      trashType: "folder",
      displayName: payload.name,
      trashEnvelope: envelope,
    });
  }

  for (const record of records) {
    const payload = {
      ...withoutTrashState(record),
      trashedAt: now,
      trashSchemaVersion: TRASH_SCHEMA_VERSION,
    };
    if (record.kind === "text") {
      const envelope = await encryptJsonEnvelope(
        crypto,
        key,
        record.id,
        payload
      );
      await db.moveTextToTrash(envelope);
      trashed.push({
        ...payload,
        trashType: "text",
        displayName: payload.title || "无标题",
        trashEnvelope: envelope,
      });
    } else {
      const metadata = withoutTrashState(record);
      metadata.id = record.id;
      const envelope = await encryptMetadata(crypto, key, {
        ...metadata,
        trashedAt: now,
        trashSchemaVersion: TRASH_SCHEMA_VERSION,
      });
      await db.moveMediaToTrash(envelope);
      trashed.push({
        ...metadata,
        trashType: "media",
        displayName: metadata.name || "内容",
        trashedAt: now,
        trashSchemaVersion: TRASH_SCHEMA_VERSION,
        trashEnvelope: envelope,
      });
    }
  }
  await db.upsertTrashPurgeEntries(
    buildTrashPurgeEntries(trashed, retentionDays)
  );
  return trashed;
}

export async function getTrashItems({ crypto, key, db }) {
  const [mediaEnvelopes, textEnvelopes, folderEnvelopes] =
    await Promise.all([
      db.getTrashMetaEnvelopes(),
      db.getTrashTextEnvelopes(),
      db.getTrashFolderEnvelopes(),
    ]);

  const items = [];
  for (const envelope of mediaEnvelopes) {
    try {
      const record = await decryptMetadata(crypto, key, envelope);
      if (!Number.isFinite(record.trashedAt)) {
        continue;
      }
      items.push({
        ...record,
        trashType: "media",
        displayName: record.name || "内容",
        storageSize: Number(record.size) || envelope.ciphertext.byteLength,
        trashEnvelope: envelope,
      });
    } catch {
      // A damaged entry stays untouched until it can be repaired.
    }
  }
  for (const envelope of textEnvelopes) {
    try {
      const record = await decryptText({
        crypto,
        key,
        envelope,
      });
      const payload = await crypto.decryptJson(
        envelope.ciphertext,
        envelope.iv,
        key
      );
      if (!Number.isFinite(payload.trashedAt)) {
        continue;
      }
      items.push({
        ...record,
        trashedAt: payload.trashedAt,
        trashSchemaVersion: payload.trashSchemaVersion,
        trashType: "text",
        displayName: record.title || "无标题",
        storageSize: envelope.ciphertext.byteLength,
        trashEnvelope: envelope,
      });
    } catch {
      // Keep unreadable entries out of the actionable list.
    }
  }
  for (const envelope of folderEnvelopes) {
    try {
      const record = await decryptFolder({
        crypto,
        key,
        envelope,
      });
      const payload = await crypto.decryptJson(
        envelope.ciphertext,
        envelope.iv,
        key
      );
      if (!Number.isFinite(payload.trashedAt)) {
        continue;
      }
      items.push({
        ...record,
        trashedAt: payload.trashedAt,
        trashSchemaVersion: payload.trashSchemaVersion,
        trashType: "folder",
        kind: "folder",
        displayName: record.name || "文件夹",
        storageSize: envelope.ciphertext.byteLength,
        trashEnvelope: envelope,
      });
    } catch {
      // Keep unreadable entries out of the actionable list.
    }
  }
  return items.sort((left, right) => right.trashedAt - left.trashedAt);
}

export async function restoreTrashItems({
  crypto,
  key,
  db,
  items,
  existingFolderIds = new Set(),
}) {
  const selected = new Set(items.map((item) => item.id));
  const folderIds = new Set(existingFolderIds);
  for (const item of items) {
    if (item.trashType === "folder") {
      folderIds.add(item.id);
    }
  }

  const restored = [];
  for (const item of items.filter((entry) => entry.trashType === "folder")) {
    const payload = {
      ...withoutTrashState(item),
      trashEnvelope: undefined,
      trashType: undefined,
      displayName: undefined,
    };
    delete payload.trashEnvelope;
    delete payload.trashType;
    delete payload.displayName;
    const envelope = await encryptJsonEnvelope(
      crypto,
      key,
      item.id,
      payload
    );
    await db.restoreFolder(envelope);
    restored.push(payload);
  }

  for (const item of items.filter((entry) => entry.trashType !== "folder")) {
    if (!selected.has(item.id)) {
      continue;
    }
    const payload = withoutTrashState(item);
    delete payload.trashEnvelope;
    delete payload.trashType;
    delete payload.displayName;
    if (item.trashType === "media") {
      payload.folderId = folderIds.has(payload.folderId)
        ? payload.folderId
        : null;
      const envelope = await encryptMetadata(crypto, key, payload);
      await db.restoreMedia(envelope);
    } else {
      payload.folderId = folderIds.has(payload.folderId)
        ? payload.folderId
        : null;
      const envelope = await encryptJsonEnvelope(
        crypto,
        key,
        item.id,
        payload
      );
      await db.restoreText(envelope);
    }
    restored.push(payload);
  }
  await db.removeTrashPurgeEntries(items.map(trashPurgeEntryKey));
  return restored;
}

export async function purgeTrashItems({ db, items }) {
  for (const item of items) {
    if (item.trashType === "media") {
      await db.deleteMedia(item.id);
    } else if (item.trashType === "text") {
      await db.deleteText(item.id);
    } else if (item.trashType === "folder") {
      await db.deleteFolder(item.id);
    }
  }
  await db.removeTrashPurgeEntries(items.map(trashPurgeEntryKey));
  return items.length;
}

export async function purgeExpiredTrash({
  crypto,
  key,
  db,
  retentionDays,
  now = Date.now(),
}) {
  if (retentionDays === null) {
    return 0;
  }
  const days = Number(retentionDays);
  if (!Number.isFinite(days) || days <= 0) {
    return 0;
  }
  const cutoff = now - days * DAY_MS;
  const items = await getTrashItems({ crypto, key, db });
  return purgeTrashItems({
    db,
    items: items.filter((item) => item.trashedAt <= cutoff),
  });
}

export async function syncTrashOnUnlock({
  crypto,
  key,
  db,
  preferencesStatus,
  retentionDays,
  now = Date.now(),
}) {
  if (preferencesStatus === "failed") {
    return {
      trashItems: await getTrashItems({ crypto, key, db }),
      paused: true,
    };
  }
  await purgeExpiredTrash({
    crypto,
    key,
    db,
    retentionDays,
    now,
  });
  const trashItems = await getTrashItems({ crypto, key, db });
  await db.replaceTrashPurgeIndex(
    buildTrashPurgeEntries(trashItems, retentionDays)
  );
  return { trashItems, paused: false };
}

export function trashRemainingDays(item, retentionDays, now = Date.now()) {
  if (retentionDays === null) {
    return null;
  }
  const expiresAt = item.trashedAt + retentionDays * DAY_MS;
  return Math.max(0, Math.ceil((expiresAt - now) / DAY_MS));
}
