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
 *
 * 2.1.2 新增（分块存储底座，见 js/core/chunks.js）：
 *   chunks    keyPath ['itemId','index'] {itemId, index, iv, ct}  大文件的分块密文（每块独立 IV）
 *   chunkmeta keyPath 'id'              分块清单 {id, state, total, chunkSize, committedAt}
 *            —— 列表中 state="ready" 的记录是**唯一提交点**；没有它的 chunks 行一律视为孤儿。
 */

export const DB_NAME = "daishui-vault";
export const DB_VERSION = 3;

/** store → 主键描述。除 auth/chunks 外都是单字段 'id'。 */
const KEY_PATHS = { auth: "k", chunks: ["itemId", "index"] };
export const STORES = ["auth", "items", "folders", "thumbs", "blobs", "docs", "prefs", "chunks", "chunkmeta"];

/** 打开（必要时创建/升级）数据库。onupgradeneeded 里只做增量创建，不删除任何既有 store。 */
export function openDb(onClose) {
  return openAt(DB_VERSION, onClose).catch((err) => {
    // 回滚保护：如果本机数据的 schema 版本比当前代码更新（用户曾装过新版本再退回旧版本），
    // 不要直接报错，用「最高可用版本」打开——旧代码只读自己认识的 store，不会破坏新数据。
    if (err && err.name === "VersionError") return openAt(undefined, onClose);
    throw err;
  });
}

function openAt(version, onClose) {
  return new Promise((resolve, reject) => {
    let req;
    try {
      req = version === undefined ? indexedDB.open(DB_NAME) : indexedDB.open(DB_NAME, version);
    } catch (err) {
      reject(err);
      return;
    }
    req.onupgradeneeded = (event) => {
      const db = req.result;
      // 只「补齐缺失的 store」，绝不删改既有结构（避免升级路径丢数据）
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: KEY_PATHS[name] || "id" });
        }
      }
      // 记录当前 schema 版本，供后续迁移脚本判断（迁移必须可预演、可回滚）
      if (!db.objectStoreNames.contains("meta")) {
        const meta = db.createObjectStore("meta", { keyPath: "k" });
        meta.put({ k: "schema", from: event.oldVersion, to: DB_VERSION, at: Date.now() });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      // 别的页面要升级数据库时必须让路：关闭连接，并通知持有者丢弃缓存，下次调用自动重开
      db.onversionchange = () => {
        db.close();
        if (typeof onClose === "function") onClose(db);
      };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("数据库被其它页面占用，请关闭其它标签页后重试"));
  });
}

let dbPromise = null;
export function db() {
  if (!dbPromise) {
    const p = openDb((closed) => {
      // 连接已被版本变更关闭：清掉缓存，否则后续 transaction 会抛 InvalidStateError
      if (dbPromise === p) dbPromise = null;
      p.catch(() => {});
    });
    dbPromise = p;
    p.catch(() => { if (dbPromise === p) dbPromise = null; });
  }
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

/** 区间查询（分块读取用）：range 为 IDBKeyRange，可只取键 */
export function getRange(store, range, { keysOnly = false } = {}) {
  return run(store, "readonly", (s) => {
    const src = keysOnly ? s[store].getAllKeys(range) : s[store].getAll(range);
    return wrap(src);
  });
}

export function countRange(store, range) {
  return run(store, "readonly", (s) => wrap(s[store].count(range)));
}

/** 区间删除：一次事务内用游标删掉所有匹配键，返回删除条数（游标不读取值，省内存） */
export function delRange(store, range) {
  return run(store, "readwrite", (s) =>
    new Promise((resolve, reject) => {
      let n = 0;
      const req = s[store].openCursor(range);
      req.onsuccess = () => {
        const cur = req.result;
        if (!cur) { resolve(n); return; }
        cur.delete();
        n++;
        cur.continue();
      };
      req.onerror = () => reject(req.error);
    })
  );
}

/** 复合键区间：[itemId, 任意 index] —— '[]' 作上界（数组类型键 > 数字类型键，覆盖全部 index） */
export function keyRangeForItem(itemId) {
  return IDBKeyRange.bound([itemId], [itemId, []], false, false);
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
