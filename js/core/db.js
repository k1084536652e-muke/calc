/**
 * IndexedDB 访问层（薄封装）：只负责库的打开 / 升级 / 事务。
 * 所有业务语义在 repo.js；这里不出现任何明文内容。
 *
 * 库结构（DB_VERSION = 1）：
 *   auth    keyPath 'k'  单条 {k:"vault"}，存 KDF 参数、盐、被包裹的 DEK / 清除码标记（无秘密明文）
 *   items   keyPath 'id' {id, iv, ct}   加密的条目元数据（JSON）
 *   folders keyPath 'id' {id, iv, ct}   加密的文件夹元数据（JSON）
 *   thumbs keyPath 'id' {id, iv, ct}   加密的缩略图（JPEG/WebP 字节）
 *   blobs  keyPath 'id' {id, iv, ct}   加密的原文件内容
 *   docs   keyPath 'id' {id, iv, ct}   加密的文档 HTML
 *   prefs  keyPath 'id' {id, iv, ct}   加密的设置（显示名称 / 回收站保留 / 幻灯片间隔 …）
 */

export const DB_NAME = "daishui-vault";
export const DB_VERSION = 2;
export const STORES = ["auth", "items", "folders", "thumbs", "blobs", "docs", "prefs"];

/** 打开（必要时创建/升级）数据库。onupgradeneeded 里只做增量创建，不删除任何既有 store。 */
export function openDb() {
  return new Promise((resolve, reject) => {
    let req;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (err) {
      reject(err);
      return;
    }
    req.onupgradeneeded = (event) => {
      const db = req.result;
      // 只「补齐缺失的 store」，绝不删改既有结构（避免升级路径丢数据）
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: name === "auth" ? "k" : "id" });
      }
      // 记录当前 schema 版本，供后续迁移脚本判断（迁移必须可预演、可回滚）
      if (!db.objectStoreNames.contains("meta")) {
        const meta = db.createObjectStore("meta", { keyPath: "k" });
        meta.put({ k: "schema", from: event.oldVersion, to: DB_VERSION, at: Date.now() });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("数据库被其它页面占用，请关闭其它标签页后重试"));
  });
}

let dbPromise = null;
export function db() {
  if (!dbPromise) dbPromise = openDb().catch((err) => { dbPromise = null; throw err; });
  return dbPromise;
}

function run(storeNames, mode, fn) {
  return db().then(
    (database) =>
      new Promise((resolve, reject) => {
        const names = Array.isArray(storeNames) ? storeNames : [storeNames];
        const tx = database.transaction(names, mode);
        let result;
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error || new Error("数据库事务失败"));
        tx.onabort = () => reject(tx.error || new Error("数据库事务已取消"));
        try {
          const stores = {};
          for (const n of names) stores[n] = tx.objectStore(n);
          result = fn(stores, tx);
        } catch (err) {
          try { tx.abort(); } catch { /* ignore */ }
          reject(err);
        }
      })
  );
}

const wrap = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

export function get(store, key) {
  return run(store, "readonly", (s) => wrap(s[store].get(key)));
}

export function getAll(store) {
  return run(store, "readonly", (s) => wrap(s[store].getAll()));
}

export function put(store, value) {
  return run(store, "readwrite", (s) => wrap(s[store].put(value)));
}

export function putMany(store, values) {
  return run(store, "readwrite", (s) => { for (const v of values) s[store].put(v); });
}

export function del(store, key) {
  return run(store, "readwrite", (s) => wrap(s[store].delete(key)));
}

export function delMany(store, keys) {
  return run(store, "readwrite", (s) => { for (const k of keys) s[store].delete(k); });
}

export function clearStores(names) {
  return run(names, "readwrite", (s) => { for (const n of names) s[n].clear(); });
}

export function count(store) {
  return run(store, "readonly", (s) => wrap(s[store].count()));
}

/** 原子写多条：同一事务里跨多个 store 写入（迁移 / 批量导入用） */
export function writeBatch(ops) {
  const names = [...new Set(ops.map((o) => o.store))];
  return run(names, "readwrite", (s) => {
    for (const op of ops) {
      if (op.type === "put") s[op.store].put(op.value);
      else if (op.type === "del") s[op.store].delete(op.key);
      else if (op.type === "clear") s[op.store].clear();
    }
  });
}

/** 估算占用（配额提示用）；不支持时返回 null */
export async function usage() {
  try {
    if (navigator.storage && navigator.storage.estimate) return await navigator.storage.estimate();
  } catch { /* ignore */ }
  return null;
}
