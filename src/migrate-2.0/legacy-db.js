/**
 * 2.0.0 IndexedDB 的**只读**访问层（浏览器专用；Node 里没有 indexedDB，不要 import 本文件做单测）。
 *
 * 原则：
 * - 只做 open / get / getAll / count / cursor 读，绝不 put / delete / 升级版本。
 * - 检测不到旧库时不「顺手」创建库：优先用 indexedDB.databases()；不支持时
 *   用「无版本号 open + upgradeneeded 标记」，发现是刚被创建的空库就立刻删掉（见 probeDatabase）。
 * - 只有 deleteLegacyDatabase() 会删库，且必须由调用方显式调用。
 */

import { LEGACY_DB, LEGACY_STORES } from "./legacy-format.js";

const COUNTED_STORES = ["meta", "thumbs", "chunks", "texts", "folders", "trashMeta", "trashTexts", "trashFolders", "media", "legacyMeta"];

export function hasIndexedDb() {
  return typeof globalThis.indexedDB !== "undefined" && globalThis.indexedDB !== null;
}

function idb() {
  if (!hasIndexedDb()) throw new Error("当前环境没有 IndexedDB");
  return globalThis.indexedDB;
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB 请求失败"));
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("IndexedDB 事务失败"));
    tx.onabort = () => reject(tx.error || new Error("IndexedDB 事务已取消"));
  });
}

/** indexedDB.databases()：Safari 14 等老实现没有，返回 null 表示「不支持探测」 */
export async function listDatabaseNames() {
  const factory = idb();
  if (typeof factory.databases !== "function") return null;
  try {
    const list = await factory.databases();
    return list.map((item) => item && item.name).filter(Boolean);
  } catch {
    return null;
  }
}

function openNoVersion(name) {
  return new Promise((resolve, reject) => {
    let created = false;
    const request = idb().open(name);
    request.onupgradeneeded = () => { created = true; };
    request.onsuccess = () => resolve({ db: request.result, created });
    request.onerror = () => reject(request.error || new Error("无法打开旧数据库"));
    request.onblocked = () => reject(new Error("旧数据库被其它页面占用，请关闭其它标签页"));
  });
}

export function closeDatabase(db) {
  try { db && db.close(); } catch { /* 忽略 */ }
}

export async function deleteDatabase(name) {
  await new Promise((resolve, reject) => {
    const request = idb().deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error("删除旧数据库失败"));
    // blocked：有别的标签页还开着，不阻塞调用方，但也不假装成功
    request.onblocked = () => reject(new Error("旧数据库仍被占用，请关闭其它标签页后重试"));
  });
}

/**
 * 探测单个旧库：是否存在、版本、store 列表、各表条目数。
 * 不存在时返回 {name, exists:false}，且不留下空数据库。
 */
export async function probeDatabase(name) {
  const names = await listDatabaseNames();
  if (names && !names.includes(name)) {
    return { name, exists: false, version: 0, stores: [], counts: {} };
  }

  let opened;
  try {
    opened = await openNoVersion(name);
  } catch (error) {
    return { name, exists: false, version: 0, stores: [], counts: {}, error: String(error && error.message || error) };
  }

  const db = opened.db;
  const stores = Array.from(db.objectStoreNames);
  // 无版本号 open 会把不存在的库建出来：刚创建且无 store ⇒ 视为不存在，立刻清理。
  if (opened.created && stores.length === 0) {
    closeDatabase(db);
    await deleteDatabase(name).catch(() => {});
    return { name, exists: false, version: 0, stores: [], counts: {}, createdAndRemoved: true };
  }

  const counts = {};
  try {
    for (const store of COUNTED_STORES) {
      if (!stores.includes(store)) continue;
      const tx = db.transaction(store, "readonly");
      counts[store] = await requestToPromise(tx.objectStore(store).count());
      await txDone(tx).catch(() => {});
    }
  } catch (error) {
    counts.error = String(error && error.message || error);
  }

  let hasAuth = false;
  if (stores.includes("settings")) {
    hasAuth = !!(await readSetting(db, "auth").catch(() => null));
  }

  const result = { name, exists: true, version: db.version, stores, counts, hasAuth };
  closeDatabase(db);
  return result;
}

/** 单个旧库的读写句柄（只读使用；调用方负责 closeDatabase） */
export async function openLegacyDatabase(name = LEGACY_DB.current) {
  const names = await listDatabaseNames();
  if (names && !names.includes(name)) return null;
  const { db, created } = await openNoVersion(name);
  if (created && db.objectStoreNames.length === 0) {
    closeDatabase(db);
    await deleteDatabase(name).catch(() => {});
    return null;
  }
  return db;
}

export async function readSetting(db, key) {
  if (!db.objectStoreNames.contains("settings")) return null;
  const tx = db.transaction("settings", "readonly");
  const value = await requestToPromise(tx.objectStore("settings").get(key));
  await txDone(tx).catch(() => {});
  return value || null;
}

export async function readAll(db, store) {
  if (!db.objectStoreNames.contains(store)) return [];
  const tx = db.transaction(store, "readonly");
  const rows = await requestToPromise(tx.objectStore(store).getAll());
  await txDone(tx).catch(() => {});
  return rows;
}

export async function countStore(db, store) {
  if (!db.objectStoreNames.contains(store)) return 0;
  const tx = db.transaction(store, "readonly");
  const n = await requestToPromise(tx.objectStore(store).count());
  await txDone(tx).catch(() => {});
  return n;
}

/** 游标分批迭代（大表不一次性 getAll，避免内存峰值） */
export async function* iterateStore(db, store, { batchSize = 50 } = {}) {
  if (!db.objectStoreNames.contains(store)) return;
  let lastKey = null;
  for (;;) {
    const tx = db.transaction(store, "readonly");
    const objectStore = tx.objectStore(store);
    const range = lastKey === null ? null : IDBKeyRange.lowerBound(lastKey, true);
    const batch = [];
    await new Promise((resolve, reject) => {
      const request = objectStore.openCursor(range);
      request.onerror = () => reject(request.error || new Error("游标读取失败"));
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor || batch.length >= batchSize) { resolve(); return; }
        batch.push({ key: cursor.primaryKey, value: cursor.value });
        cursor.continue();
      };
    });
    await txDone(tx).catch(() => {});
    if (!batch.length) return;
    for (const row of batch) yield row;
    lastKey = batch[batch.length - 1].key;
    if (batch.length < batchSize) return;
  }
}

/** 该库是否是我们认识的 2.0.0 结构（只按 store 名单判断，不读内容） */
export function looksLikeLegacyVault(probe) {
  if (!probe || !probe.exists) return false;
  const stores = probe.stores || [];
  const known = stores.filter((name) => name in LEGACY_STORES);
  return known.length > 0;
}
