export const DB_NAME = "calc-data-current";
// The second-generation database is kept only as a migration source.
const PREVIOUS_DB_NAME = "calc-data";
// Older installations used this identifier; decode it only for migration.
const LEGACY_DB_NAME = globalThis.atob("Y2FsY3VsYXRvci1wcml2YXRlLXZhdWx0");
export const DB_VERSION = 2;

const SOURCE_DB_NAMES = [PREVIOUS_DB_NAME, LEGACY_DB_NAME];
const ALL_DB_NAMES = [DB_NAME, ...SOURCE_DB_NAMES];
const COPY_STORES = [
  "settings",
  "meta",
  "thumbs",
  "texts",
  "folders",
  "trashMeta",
  "trashTexts",
  "trashFolders",
  "migration",
];
const PREVIOUS_COPY_MARKER = "previous-database-copied";

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), {
      once: true,
    });
    request.addEventListener("error", () => reject(request.error), {
      once: true,
    });
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve(), { once: true });
    transaction.addEventListener(
      "error",
      () => reject(transaction.error || new Error("数据库事务失败")),
      { once: true }
    );
    transaction.addEventListener(
      "abort",
      () => reject(transaction.error || new Error("数据库事务已取消")),
      { once: true }
    );
  });
}

function ensureStore(database, name, options) {
  if (!database.objectStoreNames.contains(name)) {
    database.createObjectStore(name, options);
  }
}

function legacySummary(record) {
  return {
    id: record.id,
    name: record.name || "内容",
    kind: record.kind || "image",
    mimeType:
      record.mimeType ||
      (record.kind === "video" ? "video/mp4" : "image/jpeg"),
    size: Number(record.size) || 0,
    createdAt: Number(record.createdAt) || 0,
    folderId: record.folderId ?? null,
  };
}

function binaryFingerprint(value) {
  if (!value) {
    return null;
  }
  try {
    const bytes =
      value instanceof ArrayBuffer
        ? new Uint8Array(value)
        : new Uint8Array(
            value.buffer,
            value.byteOffset || 0,
            value.byteLength
          );
    return Array.from(bytes).join(",");
  } catch {
    return "";
  }
}

function wrappedFingerprint(value) {
  if (!value) {
    return null;
  }
  return {
    iv: binaryFingerprint(value.iv),
    ciphertext: binaryFingerprint(value.ciphertext),
  };
}

function authFingerprint(auth) {
  if (!auth) {
    return "";
  }
  return JSON.stringify({
    version: auth.version || 0,
    salt: binaryFingerprint(auth.salt),
    iterations: auth.iterations || 0,
    verifier: binaryFingerprint(auth.verifier),
    verifierVersion: auth.verifierVersion || 0,
    wrappedMasterKey: wrappedFingerprint(auth.wrappedMasterKey),
    wrappedLegacyKey: wrappedFingerprint(auth.wrappedLegacyKey),
  });
}

function upgradeDatabase(database) {
  ensureStore(database, "settings", { keyPath: "key" });
  ensureStore(database, "meta", { keyPath: "id" });
  ensureStore(database, "thumbs", { keyPath: "mediaId" });
  if (!database.objectStoreNames.contains("chunks")) {
    const chunks = database.createObjectStore("chunks", {
      keyPath: ["mediaId", "index"],
    });
    chunks.createIndex("mediaId", "mediaId");
  }
  // Text and folder envelopes are encrypted with the same in-memory master key.
  ensureStore(database, "texts", { keyPath: "id" });
  ensureStore(database, "folders", { keyPath: "id" });
  ensureStore(database, "trashMeta", { keyPath: "id" });
  ensureStore(database, "trashTexts", { keyPath: "id" });
  ensureStore(database, "trashFolders", { keyPath: "id" });
  ensureStore(database, "migration", { keyPath: "id" });
}

function openDatabase(name, version, onCreate) {
  return new Promise((resolve, reject) => {
    const request =
      version === undefined
        ? indexedDB.open(name)
        : indexedDB.open(name, version);

    request.addEventListener("upgradeneeded", () => {
      if (onCreate) {
        onCreate(request.result, request.transaction, request.oldVersion);
      }
    });
    request.addEventListener("success", () => {
      const database = request.result;
      database.addEventListener("versionchange", () => database.close());
      resolve(database);
    });
    request.addEventListener("error", () => reject(request.error));
    request.addEventListener("blocked", () => {
      reject(new Error("数据库被另一个页面占用，请关闭后重试"));
    });
  });
}

function deleteDatabase(name, rejectIfBlocked = false) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.addEventListener("success", () => resolve(), { once: true });
    request.addEventListener(
      "error",
      () => reject(request.error || new Error("删除数据库失败")),
      { once: true }
    );
    request.addEventListener(
      "blocked",
      () => {
        if (rejectIfBlocked) {
          reject(new Error("数据库仍被占用，请关闭其他应用窗口后重试"));
        } else {
          resolve();
        }
      },
      { once: true }
    );
  });
}

function hasAnyStore(database) {
  return database.objectStoreNames.length > 0;
}

async function readCursorBatch(database, storeName, limit, afterKey = null) {
  if (!database.objectStoreNames.contains(storeName)) {
    return { values: [], lastKey: null };
  }
  const transaction = database.transaction(storeName, "readonly");
  const store = transaction.objectStore(storeName);
  const values = [];
  let lastKey = null;
  const range =
    afterKey === null
      ? undefined
      : IDBKeyRange.lowerBound(afterKey, true);
  await new Promise((resolve, reject) => {
    const request = store.openCursor(range);
    request.addEventListener("success", () => {
      const cursor = request.result;
      if (!cursor) {
        resolve();
        return;
      }
      values.push(cursor.value);
      lastKey = cursor.key;
      if (values.length >= limit) {
        resolve();
      } else {
        cursor.continue();
      }
    });
    request.addEventListener("error", () => reject(request.error), {
      once: true,
    });
  });
  await transactionDone(transaction).catch(() => {});
  return { values, lastKey };
}

async function putRecords(database, storeName, records) {
  if (!database.objectStoreNames.contains(storeName) || records.length === 0) {
    return;
  }
  const transaction = database.transaction(storeName, "readwrite");
  const store = transaction.objectStore(storeName);
  for (const record of records) {
    if (storeName === "settings" && record.key === PREVIOUS_COPY_MARKER) {
      continue;
    }
    store.put(record);
  }
  await transactionDone(transaction);
}

async function copyStore(source, target, storeName, batchSize = 24) {
  let afterKey = null;
  while (true) {
    const { values: records, lastKey } = await readCursorBatch(
      source,
      storeName,
      batchSize,
      afterKey
    );
    if (records.length === 0) {
      return;
    }
    await putRecords(target, storeName, records);
    afterKey = lastKey;
    if (records.length < batchSize) {
      return;
    }
  }
}

async function getSettingFromDatabase(database, key) {
  const transaction = database.transaction("settings", "readonly");
  const record = await requestResult(
    transaction.objectStore("settings").get(key)
  );
  await transactionDone(transaction);
  return record || null;
}

async function putSetting(database, record) {
  const transaction = database.transaction("settings", "readwrite");
  transaction.objectStore("settings").put(record);
  await transactionDone(transaction);
}

async function readLegacySummaries(database) {
  if (!database.objectStoreNames.contains("media")) {
    return [];
  }
  const readTransaction = database.transaction(
    ["media", ...(database.objectStoreNames.contains("legacyMeta")
      ? ["legacyMeta"]
      : [])],
    "readonly"
  );
  const media = readTransaction.objectStore("media");
  const mediaKeysRequest = requestResult(media.getAllKeys());
  const savedRequest = database.objectStoreNames.contains("legacyMeta")
    ? requestResult(readTransaction.objectStore("legacyMeta").getAll())
    : null;
  const mediaKeys = await mediaKeysRequest;
  const keySet = new Set(mediaKeys);
  let summaries = [];
  if (savedRequest) {
    const saved = await savedRequest;
    summaries = saved
      .filter((summary) => keySet.has(summary.id))
      .map(legacySummary);
  }
  await transactionDone(readTransaction);

  const summarizedIds = new Set(summaries.map((summary) => summary.id));
  const missingIds = mediaKeys.filter((key) => !summarizedIds.has(key));
  for (const mediaId of missingIds) {
    const transaction = database.transaction("media", "readonly");
    const record = await requestResult(
      transaction.objectStore("media").get(mediaId)
    );
    await transactionDone(transaction);
    if (record) {
      summaries.push(legacySummary(record));
    }
  }
  return summaries;
}

async function findLegacyRecord(database, mediaId) {
  if (!database.objectStoreNames.contains("media")) {
    return null;
  }
  const transaction = database.transaction("media", "readonly");
  const record = await requestResult(
    transaction.objectStore("media").get(mediaId)
  );
  await transactionDone(transaction);
  return record || null;
}

async function deleteLegacyRecord(database, mediaId) {
  if (!database.objectStoreNames.contains("media")) {
    return;
  }
  const stores = [
    "media",
    ...(database.objectStoreNames.contains("legacyMeta")
      ? ["legacyMeta"]
      : []),
  ];
  const transaction = database.transaction(stores, "readwrite");
  transaction.objectStore("media").delete(mediaId);
  if (database.objectStoreNames.contains("legacyMeta")) {
    transaction.objectStore("legacyMeta").delete(mediaId);
  }
  await transactionDone(transaction);
}

async function mediaKeysForTransaction(store, mediaId) {
  const index = store.index("mediaId");
  return requestResult(index.getAllKeys(IDBKeyRange.only(mediaId)));
}

export class DataStore {
  #databasePromise = null;
  #sourceDatabases = new Map();

  async #copyPreviousDatabase(target) {
    const source = await openDatabase(PREVIOUS_DB_NAME);
    if (!hasAnyStore(source)) {
      source.close();
      await deleteDatabase(PREVIOUS_DB_NAME);
      return;
    }

    const marker = await getSettingFromDatabase(target, PREVIOUS_COPY_MARKER);
    if (!marker) {
      for (const storeName of COPY_STORES) {
        await copyStore(source, target, storeName);
      }
      // Chunks are copied in small batches so peak memory stays bounded.
      await copyStore(source, target, "chunks", 4);
      await putSetting(target, {
        key: PREVIOUS_COPY_MARKER,
        completedAt: Date.now(),
      });
    }
    this.#sourceDatabases.set(PREVIOUS_DB_NAME, source);
  }

  async #openLegacySource(name) {
    const database = await openDatabase(name);
    if (!hasAnyStore(database)) {
      database.close();
      await deleteDatabase(name);
      return null;
    }
    this.#sourceDatabases.set(name, database);
    return database;
  }

  async #prepareStores(target) {
    await this.#copyPreviousDatabase(target);
    for (const name of SOURCE_DB_NAMES) {
      if (!this.#sourceDatabases.has(name)) {
        await this.#openLegacySource(name);
      }
    }

    const targetAuth = await getSettingFromDatabase(target, "auth");
    if (!targetAuth) {
      for (const database of this.#sourceDatabases.values()) {
        if (!database.objectStoreNames.contains("settings")) {
          continue;
        }
        const sourceAuth = await getSettingFromDatabase(database, "auth");
        if (sourceAuth) {
          await putSetting(target, sourceAuth);
          break;
        }
      }
    }
  }

  open() {
    if (this.#databasePromise) {
      return this.#databasePromise;
    }

    this.#databasePromise = openDatabase(
      DB_NAME,
      DB_VERSION,
      upgradeDatabase
    )
      .then(async (database) => {
        try {
          await this.#prepareStores(database);
        } catch (error) {
          console.error("旧数据库迁移失败", error);
          database.close();
          throw error;
        }
        return database;
      })
      .catch((error) => {
        this.#databasePromise = null;
        throw error;
      });

    return this.#databasePromise;
  }

  async getAuth() {
    const database = await this.open();
    const transaction = database.transaction("settings", "readonly");
    const record = await requestResult(
      transaction.objectStore("settings").get("auth")
    );
    await transactionDone(transaction);
    return record || null;
  }

  async saveAuth(auth) {
    const database = await this.open();
    for (const source of this.#sourceDatabases.values()) {
      if (
        source.objectStoreNames.contains("settings") &&
        (await getSettingFromDatabase(source, "auth"))
      ) {
        throw new Error("本机已有解锁设置，拒绝覆盖");
      }
    }

    const transaction = database.transaction("settings", "readwrite");
    const store = transaction.objectStore("settings");
    const existing = await requestResult(store.get("auth"));
    if (existing) {
      transaction.abort();
      await transactionDone(transaction).catch(() => {});
      throw new Error("本机已有解锁设置，拒绝覆盖");
    }
    store.put({ ...auth, key: "auth" });
    await transactionDone(transaction);
  }

  async replaceAuth(auth, expectedAuth) {
    const database = await this.open();
    const transaction = database.transaction("settings", "readwrite");
    const store = transaction.objectStore("settings");
    const current = await requestResult(store.get("auth"));
    if (
      !current ||
      !expectedAuth ||
      authFingerprint(current) !== authFingerprint(expectedAuth)
    ) {
      transaction.abort();
      await transactionDone(transaction).catch(() => {});
      throw new Error("解锁设置已变化，请重新解锁");
    }
    store.put({ ...auth, key: "auth" });
    await transactionDone(transaction);
  }

  async getSetting(key) {
    const database = await this.open();
    const transaction = database.transaction("settings", "readonly");
    const record = await requestResult(
      transaction.objectStore("settings").get(key)
    );
    await transactionDone(transaction);
    return record || null;
  }

  async saveSetting(record) {
    const database = await this.open();
    const transaction = database.transaction("settings", "readwrite");
    transaction.objectStore("settings").put(record);
    await transactionDone(transaction);
  }

  async deleteSetting(key) {
    const database = await this.open();
    const transaction = database.transaction("settings", "readwrite");
    transaction.objectStore("settings").delete(key);
    await transactionDone(transaction);
  }

  async getMetaEnvelopes() {
    const database = await this.open();
    const transaction = database.transaction("meta", "readonly");
    const records = await requestResult(
      transaction.objectStore("meta").getAll()
    );
    await transactionDone(transaction);
    return records;
  }

  async getMetaEnvelope(mediaId) {
    const database = await this.open();
    const transaction = database.transaction("meta", "readonly");
    const record = await requestResult(
      transaction.objectStore("meta").get(mediaId)
    );
    await transactionDone(transaction);
    return record || null;
  }

  async getThumbnail(mediaId) {
    const database = await this.open();
    const transaction = database.transaction("thumbs", "readonly");
    const record = await requestResult(
      transaction.objectStore("thumbs").get(mediaId)
    );
    await transactionDone(transaction);
    return record || null;
  }

  async putChunk(chunk) {
    const database = await this.open();
    const transaction = database.transaction("chunks", "readwrite");
    transaction.objectStore("chunks").put(chunk);
    await transactionDone(transaction);
  }

  async getChunks(mediaId, indexes) {
    const database = await this.open();
    const transaction = database.transaction("chunks", "readonly");
    const store = transaction.objectStore("chunks");
    const requests = indexes.map((index) =>
      requestResult(store.get([mediaId, index]))
    );
    const chunks = await Promise.all(requests);
    await transactionDone(transaction);
    return chunks;
  }

  async clearChunks(mediaId) {
    const database = await this.open();
    const transaction = database.transaction("chunks", "readwrite");
    const store = transaction.objectStore("chunks");
    const keys = await mediaKeysForTransaction(store, mediaId);
    for (const key of keys) {
      store.delete(key);
    }
    await transactionDone(transaction);
  }

  async saveMedia(metaEnvelope, thumbnailEnvelope) {
    const database = await this.open();
    const transaction = database.transaction(
      ["meta", "thumbs"],
      "readwrite"
    );
    transaction.objectStore("meta").put(metaEnvelope);
    if (thumbnailEnvelope) {
      transaction.objectStore("thumbs").put(thumbnailEnvelope);
    }
    await transactionDone(transaction);
  }

  async saveThumbnail(thumbnailEnvelope) {
    const database = await this.open();
    const transaction = database.transaction("thumbs", "readwrite");
    transaction.objectStore("thumbs").put(thumbnailEnvelope);
    await transactionDone(transaction);
  }

  async saveMetadata(metaEnvelope) {
    const database = await this.open();
    const transaction = database.transaction("meta", "readwrite");
    transaction.objectStore("meta").put(metaEnvelope);
    await transactionDone(transaction);
  }

  async getTextEnvelopes() {
    const database = await this.open();
    const transaction = database.transaction("texts", "readonly");
    const records = await requestResult(
      transaction.objectStore("texts").getAll()
    );
    await transactionDone(transaction);
    return records;
  }

  async saveText(envelope) {
    const database = await this.open();
    const transaction = database.transaction("texts", "readwrite");
    transaction.objectStore("texts").put(envelope);
    await transactionDone(transaction);
  }

  async deleteText(id) {
    const database = await this.open();
    const transaction = database.transaction(
      ["texts", "trashTexts"],
      "readwrite"
    );
    transaction.objectStore("texts").delete(id);
    transaction.objectStore("trashTexts").delete(id);
    await transactionDone(transaction);
  }

  async getFolderEnvelopes() {
    const database = await this.open();
    const transaction = database.transaction("folders", "readonly");
    const records = await requestResult(
      transaction.objectStore("folders").getAll()
    );
    await transactionDone(transaction);
    return records;
  }

  async saveFolder(envelope) {
    const database = await this.open();
    const transaction = database.transaction("folders", "readwrite");
    transaction.objectStore("folders").put(envelope);
    await transactionDone(transaction);
  }

  async deleteFolder(id) {
    const database = await this.open();
    const transaction = database.transaction(
      ["folders", "trashFolders"],
      "readwrite"
    );
    transaction.objectStore("folders").delete(id);
    transaction.objectStore("trashFolders").delete(id);
    await transactionDone(transaction);
  }

  async deleteMedia(mediaId) {
    const database = await this.open();
    const transaction = database.transaction(
      ["meta", "thumbs", "chunks", "trashMeta"],
      "readwrite"
    );
    const chunks = transaction.objectStore("chunks");
    const keys = await mediaKeysForTransaction(chunks, mediaId);
    for (const key of keys) {
      chunks.delete(key);
    }
    transaction.objectStore("meta").delete(mediaId);
    transaction.objectStore("thumbs").delete(mediaId);
    transaction.objectStore("trashMeta").delete(mediaId);
    await transactionDone(transaction);

    for (const source of this.#sourceDatabases.values()) {
      await deleteLegacyRecord(source, mediaId);
    }
  }

  async getTrashMetaEnvelopes() {
    const database = await this.open();
    const transaction = database.transaction("trashMeta", "readonly");
    const records = await requestResult(
      transaction.objectStore("trashMeta").getAll()
    );
    await transactionDone(transaction);
    return records;
  }

  async getTrashMetaEnvelope(mediaId) {
    const database = await this.open();
    const transaction = database.transaction("trashMeta", "readonly");
    const record = await requestResult(
      transaction.objectStore("trashMeta").get(mediaId)
    );
    await transactionDone(transaction);
    return record || null;
  }

  async getTrashTextEnvelopes() {
    const database = await this.open();
    const transaction = database.transaction("trashTexts", "readonly");
    const records = await requestResult(
      transaction.objectStore("trashTexts").getAll()
    );
    await transactionDone(transaction);
    return records;
  }

  async getTrashFolderEnvelopes() {
    const database = await this.open();
    const transaction = database.transaction("trashFolders", "readonly");
    const records = await requestResult(
      transaction.objectStore("trashFolders").getAll()
    );
    await transactionDone(transaction);
    return records;
  }

  async moveMediaToTrash(metaEnvelope) {
    const database = await this.open();
    const transaction = database.transaction(
      ["meta", "trashMeta"],
      "readwrite"
    );
    transaction.objectStore("trashMeta").put(metaEnvelope);
    transaction.objectStore("meta").delete(metaEnvelope.id);
    await transactionDone(transaction);
  }

  async moveTextToTrash(envelope) {
    const database = await this.open();
    const transaction = database.transaction(
      ["texts", "trashTexts"],
      "readwrite"
    );
    transaction.objectStore("trashTexts").put(envelope);
    transaction.objectStore("texts").delete(envelope.id);
    await transactionDone(transaction);
  }

  async moveFolderToTrash(envelope) {
    const database = await this.open();
    const transaction = database.transaction(
      ["folders", "trashFolders"],
      "readwrite"
    );
    transaction.objectStore("trashFolders").put(envelope);
    transaction.objectStore("folders").delete(envelope.id);
    await transactionDone(transaction);
  }

  async restoreMedia(envelope) {
    const database = await this.open();
    const transaction = database.transaction(
      ["meta", "trashMeta"],
      "readwrite"
    );
    transaction.objectStore("meta").put(envelope);
    transaction.objectStore("trashMeta").delete(envelope.id);
    await transactionDone(transaction);
  }

  async restoreText(envelope) {
    const database = await this.open();
    const transaction = database.transaction(
      ["texts", "trashTexts"],
      "readwrite"
    );
    transaction.objectStore("texts").put(envelope);
    transaction.objectStore("trashTexts").delete(envelope.id);
    await transactionDone(transaction);
  }

  async restoreFolder(envelope) {
    const database = await this.open();
    const transaction = database.transaction(
      ["folders", "trashFolders"],
      "readwrite"
    );
    transaction.objectStore("folders").put(envelope);
    transaction.objectStore("trashFolders").delete(envelope.id);
    await transactionDone(transaction);
  }

  async getLegacySummaries() {
    await this.open();
    const summaries = [];
    const seen = new Set();
    for (const database of this.#sourceDatabases.values()) {
      for (const summary of await readLegacySummaries(database)) {
        if (!seen.has(summary.id)) {
          seen.add(summary.id);
          summaries.push(summary);
        }
      }
    }
    return summaries;
  }

  async getLegacyRecord(mediaId) {
    await this.open();
    for (const database of this.#sourceDatabases.values()) {
      const record = await findLegacyRecord(database, mediaId);
      if (record) {
        return record;
      }
    }
    return null;
  }

  async getMigrationStates() {
    const database = await this.open();
    const transaction = database.transaction("migration", "readonly");
    const records = await requestResult(
      transaction.objectStore("migration").getAll()
    );
    await transactionDone(transaction);
    return records;
  }

  async putMigrationState(state) {
    const database = await this.open();
    const transaction = database.transaction("migration", "readwrite");
    transaction.objectStore("migration").put(state);
    await transactionDone(transaction);
  }

  async commitMigrated(metaEnvelope, thumbnailEnvelope, mediaId) {
    const database = await this.open();
    const transaction = database.transaction(
      ["meta", "thumbs", "migration"],
      "readwrite"
    );
    transaction.objectStore("meta").put(metaEnvelope);
    if (thumbnailEnvelope) {
      transaction.objectStore("thumbs").put(thumbnailEnvelope);
    }
    transaction.objectStore("migration").delete(mediaId);
    await transactionDone(transaction);

    try {
      for (const source of this.#sourceDatabases.values()) {
        await deleteLegacyRecord(source, mediaId);
      }
    } catch (error) {
      const rollback = database.transaction(
        ["meta", "thumbs"],
        "readwrite"
      );
      rollback.objectStore("meta").delete(mediaId);
      rollback.objectStore("thumbs").delete(mediaId);
      await transactionDone(rollback).catch(() => {});
      throw error;
    }
  }

  async finalizeLegacyMigration() {
    await this.open();
    if ((await this.getLegacySummaries()).length > 0) {
      throw new Error("旧内容尚未整理完成");
    }

    for (const database of this.#sourceDatabases.values()) {
      database.close();
    }
    this.#sourceDatabases.clear();

    for (const name of SOURCE_DB_NAMES) {
      await deleteDatabase(name, true);
    }
  }

  async wipe() {
    try {
      await this.open();
    } catch {
      // A failed open must not prevent deleting storage that already exists.
    }
    const database = this.#databasePromise
      ? await this.#databasePromise.catch(() => null)
      : null;
    database?.close();
    for (const source of this.#sourceDatabases.values()) {
      source.close();
    }
    this.#sourceDatabases.clear();
    this.#databasePromise = null;

    for (const name of ALL_DB_NAMES) {
      await deleteDatabase(name, true);
    }
  }
}
