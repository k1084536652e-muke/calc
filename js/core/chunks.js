/**
 * 大文件分块加密存储底座（2.1.2）。
 *
 * 目标：照片/视频不再整份读进内存再加密，改为按 1–4 MiB 逐块读取、每块独立随机 IV 的 AES-GCM，
 * 逐块提交到 IndexedDB，元数据（chunkmeta.state="ready"）作为**唯一提交点**。
 *
 * 存储布局（见 db.js 顶部注释）：
 *   chunkmeta  keyPath 'id'                {id, state, total, chunkSize, size, km, createdAt, committedAt}
 *   chunks     keyPath ['itemId','index']  {itemId, index, iv, ct, n}
 *
 * chunkmeta 里**保留明文**的只有结构信息：size/total/chunkSize/state/时间戳。
 * 必要性：SW 在没有 items 索引的情况下要立刻回 Content-Length/Content-Range（不能每次先解密），
 * 配额估算与孤儿清理（含「是否已提交」）也要在无密钥时可用；这些只泄露「大约多大、几块」，
 * 不泄露文件名/类型/内容。类型（kind/mime）已改为加密的 `km`（AAD 绑定 itemId）。
 *
 * 安全要点：
 * - 每块用同一把 DEK 加密，但 IV 各自随机（12 字节），AAD = `daishui/chunk/${itemId}/${index}/${total}`。
 *   → 交换两块：AAD 里的 index 对不上，解密失败；
 *   → 截断（少几块）：total 写在每块 AAD 里，去掉尾部块后 meta.total 与实际不符，解密失败；
 *   → 跨文件搬运：itemId 对不上。
 * - DEK 只驻留内存（setChunkKey），不落盘；chunkmeta 里没有文件名，类型也已加密（km）。
 * - 明文只在一个块的范围内短暂存在，写完即丢弃，日志/错误信息不打印内容。
 *
 * 写入流程（崩溃安全）：
 *   1. beginWrite() → 先写 chunkmeta{state:"pending"}（先占位，保证后续 chunks 行永远「有主」）
 *   2. writeChunk()/writeFromFile() → 每块一个独立事务提交；File.slice 只读一块，绝不整文件 arrayBuffer
 *   3. commit() → chunkmeta{state:"ready", committedAt}  ← 唯一提交点
 *   失败/取消 → abort() 回滚本组 chunks；进程被杀 → cleanupOrphans() 启动时清理
 *
 * 读取接口（供后续 SW 的 Range 请求使用，避免整文件解密）：
 *   readChunk(itemId, index) / readRange(itemId, start, end) / chunkStream(itemId, {start, end})
 *
 * 兼容：旧版单 blob 数据仍在 store `blobs` 里，读取走 repo.readBlob()（legacy getBlob）。
 * 新写入的大文件不再产生 blobs 行；播放/预览必须走 chunk 接口，不得用 getBlob（会整份解密进内存）。
 */

import * as DB from "./db.js";
import { seal, open as openEnvelope, aadChunk, aadChunkMeta, toBytes, sealJson } from "./crypto.js";

export const CHUNK_SIZE = 2 * 1024 * 1024;          // 默认 2 MiB
export const MIN_CHUNK_SIZE = 1 * 1024 * 1024;
export const MAX_CHUNK_SIZE = 4 * 1024 * 1024;
export const DEFAULT_GRACE_MS = 10 * 60 * 1000;     // 未提交写入的宽限期（避免误删「正在导入」）
export const BEAT_INTERVAL_MS = 2000;               // 写入心跳间隔：跨标签页孤儿清理据此判断「仍在写」
export const DEFAULT_RESERVE = 8 * 1024 * 1024;     // 预留空间，避免把配额吃到 0

/** 带错误码的异常，便于 UI 区分「空间不足 / 已取消 / 数据被篡改」 */
export class ChunkError extends Error {
  constructor(message, code, extra) {
    super(message);
    this.name = "ChunkError";
    this.code = code;
    if (extra) Object.assign(this, extra);
  }
}

const BAD_CODES = /^[A-Z_]+$/;

// ---------------- DEK（仅内存） ----------------

let keyRef = null;
/** 解锁后调用：把 DEK 交给分块层（只存引用，不落盘） */
export function setChunkKey(key) { keyRef = key || null; }
/** 锁定时调用：丢弃 DEK 引用 */
export function clearChunkKey() { keyRef = null; }
export function hasChunkKey() { return !!keyRef; }

function needKey(opts) {
  const key = (opts && opts.key) || keyRef;
  if (!key) throw new ChunkError("已锁定：无法读写分块数据", "LOCKED");
  return key;
}

// ---------------- 存储后端（IndexedDB，测试可替换） ----------------

export const idbBackend = {
  async putChunk(rec) { await DB.put("chunks", rec); },
  async getChunk(itemId, index) { return (await DB.get("chunks", [itemId, index])) || null; },
  async delChunks(itemId) { return DB.delRange("chunks", DB.keyRangeForItem(itemId)); },
  /**
   * 按批删除某条目的块：批间 await 0，给 UI 让出主线程。
   * 测试用的内存后端可不实现，deleteChunkSet 会退回 delChunks。
   */
  async delChunksBatched(itemId, { batchSize = 40, onProgress } = {}) {
    const keys = await DB.getRange("chunks", DB.keyRangeForItem(itemId), { keysOnly: true });
    const total = keys.length;
    let removed = 0;
    const bs = Math.max(8, batchSize | 0);
    for (let i = 0; i < keys.length; i += bs) {
      const slice = keys.slice(i, i + bs);
      await DB.delMany("chunks", slice);
      removed += slice.length;
      onProgress && onProgress({ removed, total, itemId });
      await new Promise((r) => setTimeout(r, 0));
    }
    return removed;
  },
  async countChunks(itemId) { return DB.countRange("chunks", DB.keyRangeForItem(itemId)); },
  /** 所有含 chunks 的 itemId（游标按 [itemId,index] 排序，逐组跳过，不加载值） */
  async chunkItemIds() {
    const database = await DB.db();
    return new Promise((resolve, reject) => {
      const ids = [];
      let last = null;
      const tx = database.transaction("chunks", "readonly");
      const req = tx.objectStore("chunks").openKeyCursor();
      req.onsuccess = () => {
        const cur = req.result;
        if (!cur) { resolve(ids); return; }
        const id = cur.key[0];
        if (id !== last) { ids.push(id); last = id; }
        // 直接跳到「本组之后」：[id, []] > [id, 任意 index]
        cur.continue([id, []]);
      };
      req.onerror = () => reject(req.error);
    });
  },
  async putMeta(meta) { await DB.put("chunkmeta", meta); },
  async getMeta(id) { return (await DB.get("chunkmeta", id)) || null; },
  async delMeta(id) { await DB.del("chunkmeta", id); },
  async listMetas() { return (await DB.getAll("chunkmeta")) || []; },
};

let backend = idbBackend;
/** 仅测试用：替换存储后端（Node 无 IndexedDB） */
export function setChunkBackend(b) { backend = b || idbBackend; }
export function getChunkBackend() { return backend; }

// ---------------- 配额 ----------------

let storageApi = null;
/** 仅测试用：替换 navigator.storage */
export function setStorageApi(api) { storageApi = api || null; }
function storage() {
  if (storageApi) return storageApi;
  return typeof navigator !== "undefined" && navigator.storage ? navigator.storage : null;
}

export function isQuotaError(err) {
  if (!err) return false;
  const name = err.name || "";
  return name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED" || err.code === 22 || err.code === "QUOTA" || /quota|空间不足/i.test(String(err.message || ""));
}

/** 申请持久化存储（可能被拒绝，不抛出） */
export async function requestPersist() {
  try {
    const s = storage();
    if (s && typeof s.persist === "function") return await s.persist();
  } catch { /* ignore */ }
  return false;
}

export async function storageEstimate() {
  try {
    const s = storage();
    if (s && typeof s.estimate === "function") return await s.estimate();
  } catch { /* ignore */ }
  return null;
}

function fmtBytes(n) {
  if (!Number.isFinite(n)) return "?";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)}${u[i]}`;
}

/**
 * 写入前检查剩余配额。空间不足直接抛 ChunkError{code:"QUOTA"}，避免写一半失败。
 * 返回 {ok:true, free, quota, unknown?}；无法读取配额（如隐私模式）时 unknown=true 放行。
 */
export async function ensureSpace(needBytes, { reserve = DEFAULT_RESERVE } = {}) {
  const need = Number(needBytes) || 0;
  const est = await storageEstimate();
  if (!est || !Number.isFinite(est.quota) || est.quota <= 0) return { ok: true, unknown: true, need };
  const free = est.quota - (Number(est.usage) || 0);
  if (need + reserve > free) {
    throw new ChunkError(
      `本机存储空间不足：需要 ${fmtBytes(need)}，当前可用约 ${fmtBytes(Math.max(0, free - reserve))}`,
      "QUOTA",
      { quota: true, need, free: Math.max(0, free) }
    );
  }
  return { ok: true, free, quota: est.quota, need };
}

// ---------------- 元数据 ----------------

export async function getChunkMeta(itemId, { readyOnly = false } = {}) {
  const meta = await backend.getMeta(String(itemId));
  if (!meta) return null;
  if (readyOnly && meta.state !== "ready") return null;
  return meta;
}

/** 该条目是否以「分块格式」提交过（决定读取走 chunks 还是 legacy blobs） */
export async function isChunked(itemId) {
  const meta = await backend.getMeta(String(itemId));
  return !!(meta && meta.state === "ready");
}

const clampChunkSize = (n) => {
  const v = Math.round(Number(n) || 0);
  if (!v) return CHUNK_SIZE;
  return Math.min(MAX_CHUNK_SIZE, Math.max(MIN_CHUNK_SIZE, v));
};

const chunkCountFor = (size, chunkSize) => Math.max(1, Math.ceil(size / chunkSize));

// ---------------- 写入 ----------------

/**
 * 开始一次分块写入。
 * @param {string} itemId  条目 id（必须提前确定，AAD 依赖它）
 * @param {object} opts    {size, total, chunkSize, kind, mime, key, checkSpace}
 *   优先用 size 推导 total；只给 total 时按 total*chunkSize 估算声明大小。
 */
export async function beginWrite(itemId, opts = {}) {
  const id = String(itemId || "");
  if (!id) throw new ChunkError("缺少条目 id", "BAD_ARG");
  const key = needKey(opts);
  const chunkSize = clampChunkSize(opts.chunkSize);
  const size = Number.isFinite(opts.size) ? Math.max(0, Math.round(opts.size)) : null;
  const total = Number.isInteger(opts.total) && opts.total > 0
    ? opts.total
    : size !== null ? chunkCountFor(size, chunkSize) : 0;
  if (!total) throw new ChunkError("缺少 size 或 total，无法确定分块数", "BAD_ARG");
  if (size !== null && total !== chunkCountFor(size, chunkSize)) {
    throw new ChunkError("total 与 size/chunkSize 不一致", "BAD_ARG");
  }
  if (opts.checkSpace !== false) await ensureSpace(size === null ? total * chunkSize : size);
  // 类型信息（kind/mime）**加密**后放进 km：chunkmeta 只有尺寸/块数这类结构信息，
  // 不出现「这是视频/这是 mp4」这种可被本地窥探的类型泄露。文件名本来就在加密的 items 里。
  let km = null;
  if (opts.kind || opts.mime) {
    try { km = await sealJson(key, { kind: opts.kind || null, mime: opts.mime || null }, aadChunkMeta(id)); }
    catch { km = null; }   // 加密失败不阻断导入：读取侧退回 application/octet-stream
  }
  // 先占位：保证之后写下的 chunks 行永远有对应 meta，不会被孤儿清理误删
  const meta = {
    id,
    v: 2,
    state: "pending",
    total,
    chunkSize,
    size: size === null ? total * chunkSize : size,
    km,
    createdAt: Date.now(),
    beatAt: Date.now(),
    committedAt: null,
  };
  await backend.putMeta(meta);
  return new ChunkWriter(meta, key);
}

/** 逐块写入器：每个块一次独立事务提交，内存里只保留一块明文 */
export class ChunkWriter {
  constructor(meta, key) {
    this.meta = meta;
    this.key = key;
    this.written = new Set();
    this.done = false;
    this.lastBeat = Number(meta.beatAt || meta.createdAt || 0);
  }

  /**
   * 心跳/租约：把「我还在写」这个时间戳落到 meta（明文时间戳，不含密文）。
   * 为什么必须有：孤儿清理在**另一个标签页**里也会跑，只按 createdAt 算年龄的话，
   * 一个 1 GiB 的导入写到第 6 分钟就会被别的标签页判定为「中断的导入」删掉。
   * 节流到 2 s 一次，写 500 块也只多几十次小事务（不跟块数成正比地放大写放大）。
   */
  async #beat(force = false) {
    const t = Date.now();
    if (!force && t - this.lastBeat < BEAT_INTERVAL_MS) return;
    this.lastBeat = t;
    this.meta = { ...this.meta, beatAt: t };
    try { await backend.putMeta(this.meta); } catch { /* 心跳失败不影响数据写入，下次再补 */ }
  }

  get itemId() { return this.meta.id; }
  get total() { return this.meta.total; }

  /** 写一块。非最后一块必须恰好 chunkSize，最后一块必须等于余数（否则 Range 映射会错） */
  async writeChunk(index, data) {
    if (this.done) throw new ChunkError("写入已结束", "STATE");
    if (!Number.isInteger(index) || index < 0 || index >= this.meta.total) {
      throw new ChunkError(`块序号越界：${index}`, "BAD_ARG");
    }
    const bytes = toBytes(data);
    const { total, chunkSize, size } = this.meta;
    const expected = index === total - 1 ? size - chunkSize * (total - 1) : chunkSize;
    if (expected <= 0) throw new ChunkError("分块尺寸计算异常", "BAD_ARG");
    if (bytes.length !== expected) {
      throw new ChunkError(`第 ${index} 块大小 ${bytes.length} ≠ 预期 ${expected}`, "BAD_SIZE");
    }
    const env = await seal(this.key, bytes, aadChunk(this.itemId, index, total));
    try {
      // 逐块提交：块多也不会出现一个巨型事务，崩溃最多丢当前这一块
      await backend.putChunk({ itemId: this.itemId, index, iv: env.iv, ct: env.ct, n: env.ct.length });
    } catch (err) {
      if (isQuotaError(err)) {
        throw new ChunkError("本机存储空间不足，写入中断（已回滚本次导入的分块）", "QUOTA", { quota: true, cause: err });
      }
      throw err;
    }
    this.written.add(index);
    await this.#beat();      // 心跳：让别的标签页的孤儿清理知道这条还没写完
    return { index, bytes: env.ct.length };
  }

  /**
   * 从 File/Blob 逐块写入（唯一被允许的读取方式：File.slice → 一块 arrayBuffer）。
   * 任何失败（含取消）都会回滚已写的块。
   */
  async writeFromFile(file, { onProgress, cancelled } = {}) {
    const { total, chunkSize, size } = this.meta;
    if (!file || typeof file.slice !== "function") throw new ChunkError("需要 File/Blob", "BAD_ARG");
    if (Number.isFinite(file.size) && file.size !== size) {
      throw new ChunkError(`文件大小 ${file.size} 与声明 ${size} 不一致`, "BAD_SIZE");
    }
    try {
      for (let i = 0; i < total; i++) {
        if (this.done) throw new ChunkError("写入已结束", "STATE");
        if (cancelled && cancelled()) throw new ChunkError("导入已取消", "CANCELLED");
        const start = i * chunkSize;
        const end = Math.min(size, start + chunkSize);
        const buf = await file.slice(start, end).arrayBuffer();   // 只读这一块
        await this.writeChunk(i, buf);
        if (onProgress) onProgress({ index: i + 1, total, pct: (i + 1) / total * 100, done: end, size });
      }
      return { total, size };
    } catch (err) {
      await this.abort();
      throw err;
    }
  }

  /** 唯一提交点：所有块齐了才把 meta 置为 ready。之后才允许被读取/展示 */
  async commit() {
    if (this.done) throw new ChunkError("写入已结束", "STATE");
    if (this.written.size !== this.meta.total) {
      const missing = this.meta.total - this.written.size;
      await this.abort();
      throw new ChunkError(`分块不完整，缺少 ${missing} 块，已回滚`, "INCOMPLETE", { missing });
    }
    try {
      const meta = { ...this.meta, state: "ready", committedAt: Date.now(), beatAt: Date.now() };
      await backend.putMeta(meta);
      this.meta = meta;
      this.done = true;
      return meta;
    } catch (err) {
      if (isQuotaError(err)) {
        await this.abort();
        throw new ChunkError("本机存储空间不足，未能提交导入结果", "QUOTA", { quota: true, cause: err });
      }
      throw err;
    }
  }

  /** 回滚：删 meta（先失去引用）再删块 */
  async abort() {
    if (this.done && this.meta.state === "ready") return 0;
    this.done = true;
    return discardChunks(this.itemId);
  }
}

/** 删掉一组未提交/已提交的分块（meta 先删，立即不可达） */
export async function discardChunks(itemId) {
  const id = String(itemId);
  await backend.delMeta(id);
  const removed = await backend.delChunks(id);
  return removed;
}

/**
 * 一次性导入文件（便利函数）：beginWrite → writeFromFile → commit。
 * 不读取整文件 arrayBuffer。返回最终 meta。
 */
export async function importFileChunked(itemId, file, opts = {}) {
  const writer = await beginWrite(itemId, {
    size: file && file.size,
    kind: opts.kind,
    mime: opts.mime || (file && file.type) || null,
    key: opts.key,
    chunkSize: opts.chunkSize,
    checkSpace: opts.checkSpace,
  });
  try {
    await writer.writeFromFile(file, opts);
    return await writer.commit();
  } catch (err) {
    if (!writer.done) await writer.abort();
    throw err;
  }
}

// ---------------- 读取 ----------------

function readyMeta(meta, itemId) {
  if (!meta) throw new ChunkError(`条目 ${itemId} 没有分块数据`, "MISSING");
  if (meta.state !== "ready") throw new ChunkError(`条目 ${itemId} 的分块尚未提交`, "INCOMPLETE");
  return meta;
}

/** 读单块（解密后返回明文字节 + meta），AAD 不符（篡改/重排/跨文件）时抛 TAMPERED */
export async function readChunk(itemId, index, opts = {}) {
  const id = String(itemId);
  const key = needKey(opts);
  const meta = readyMeta(opts.meta || (await backend.getMeta(id)), id);
  if (!Number.isInteger(index) || index < 0 || index >= meta.total) {
    throw new ChunkError(`块序号越界：${index}`, "BAD_ARG");
  }
  const rec = await backend.getChunk(id, index);
  if (!rec) throw new ChunkError(`第 ${index} 块缺失`, "MISSING");
  let data;
  try {
    data = await openEnvelope(key, rec, aadChunk(id, index, meta.total));
  } catch (err) {
    throw new ChunkError(`第 ${index} 块解密失败（数据被篡改或密钥不对）`, "TAMPERED", { cause: err });
  }
  return { data, meta };
}

/** 该条目的明文总字节数（读取 Range 时用来算 Content-Length） */
export async function chunkedSize(itemId) {
  const meta = await backend.getMeta(String(itemId));
  return meta ? meta.size : null;
}

/**
 * 读取字节区间 [start, end)（end 不含）。只解密覆盖该区间的块，不整文件解密。
 * 返回 { meta, start, end, bytes }；调用方负责把 bytes 回给 Range 请求。
 */
export async function readRange(itemId, start = 0, end = Infinity, opts = {}) {
  const id = String(itemId);
  const key = needKey(opts);
  const meta = readyMeta(opts.meta || (await backend.getMeta(id)), id);
  const size = meta.size;
  const s = Math.max(0, Math.min(size, Math.floor(Number(start) || 0)));
  const e = Math.max(s, Math.min(size, end === Infinity || !Number.isFinite(end) ? size : Math.floor(end)));
  if (e === s) return { meta, start: s, end: e, bytes: new Uint8Array(0) };
  const first = Math.floor(s / meta.chunkSize);
  const last = Math.floor((e - 1) / meta.chunkSize);
  const out = new Uint8Array(e - s);
  let off = 0;
  for (let i = first; i <= last; i++) {
    const { data } = await readChunk(id, i, { key, meta });
    const chunkStart = i * meta.chunkSize;
    const from = Math.max(0, s - chunkStart);
    const to = Math.min(data.length, e - chunkStart);
    out.set(data.subarray(from, to), off);
    off += to - from;
  }
  return { meta, start: s, end: e, bytes: out };
}

/**
 * 流式读取区间（供 Service Worker 的 Range 响应）：每块解密后立刻 yield，内存只留一块。
 * for await (const part of chunkStream(id, {start, end})) { ... }
 */
export async function* chunkStream(itemId, { start = 0, end = Infinity, key, meta } = {}) {
  const id = String(itemId);
  const k = needKey({ key });
  const m = readyMeta(meta || (await backend.getMeta(id)), id);
  const size = m.size;
  const s = Math.max(0, Math.min(size, Math.floor(Number(start) || 0)));
  const e = Math.max(s, Math.min(size, end === Infinity || !Number.isFinite(end) ? size : Math.floor(end)));
  if (e === s) return;
  const first = Math.floor(s / m.chunkSize);
  const last = Math.floor((e - 1) / m.chunkSize);
  for (let i = first; i <= last; i++) {
    const { data } = await readChunk(id, i, { key: k, meta: m });
    const chunkStart = i * m.chunkSize;
    const from = Math.max(0, s - chunkStart);
    const to = Math.min(data.length, e - chunkStart);
    yield { index: i, data: data.subarray(from, to) };
  }
}

// ---------------- 删除 ----------------

/**
 * 彻底删除一组分块：先删 meta（立即不可读），再按批删块并在批间让出主线程，
 * 避免 1GB+ 视频上千块一次 cursor 删导致界面长时间无响应。
 * @param {string} itemId
 * @param {{ onProgress?: (p:{removed:number,total:number,itemId:string})=>void, batchSize?: number }} [opts]
 */
export async function deleteChunkSet(itemId, opts = {}) {
  const id = String(itemId);
  const batchSize = Math.max(8, Number(opts.batchSize) || 40);
  const onProgress = typeof opts.onProgress === "function" ? opts.onProgress : null;
  await backend.delMeta(id);
  let removed = 0;
  if (typeof backend.delChunksBatched === "function") {
    removed = await backend.delChunksBatched(id, {
      batchSize,
      onProgress: onProgress ? (p) => onProgress({ ...p, itemId: id }) : null,
    });
  } else {
    const total = await backend.countChunks(id);
    removed = await backend.delChunks(id);
    onProgress && onProgress({ removed, total: total || removed, itemId: id });
  }
  const left = await backend.countChunks(id);
  if (left) throw new ChunkError(`删除后仍有 ${left} 块残留`, "LEFTOVER", { itemId: id, left });
  return { removed, left: 0 };
}

/** 批量删除（回收站彻底删除 / 清空内容 / 紧急清除） */
export async function deleteChunkSets(ids, opts = {}) {
  let removed = 0;
  const failed = [];
  const onProgress = typeof opts.onProgress === "function" ? opts.onProgress : null;
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    try {
      const r = await deleteChunkSet(id, {
        batchSize: opts.batchSize,
        onProgress: onProgress
          ? (p) => onProgress({ ...p, index: i + 1, itemTotal: ids.length })
          : null,
      });
      removed += r.removed;
    } catch (err) {
      failed.push({ id, error: err });
    }
  }
  return { removed, failed };
}

// ---------------- 孤儿清理 ----------------

/**
 * 启动时清理：
 * 1. 未提交（state="pending"）且超过宽限期的 meta + 其块 → 是中断的导入，回滚（不删「正在导入」，故有 grace）
 * 2. 已提交（ready）但对应 item 已不存在、且超过宽限期 → 导入最后一步崩溃的残留
 * 3. 没有任何 meta 对应的 chunks 行 → 肯定是孤儿（meta 永远先于块写入）
 * @param {object} opts {graceMs, isReferenced(itemId)=>Promise<boolean>, now}
 */
export async function cleanupOrphans(opts = {}) {
  const grace = Number.isFinite(opts.graceMs) ? opts.graceMs : DEFAULT_GRACE_MS;
  const now = Number.isFinite(opts.now) ? opts.now : Date.now();
  const isReferenced = typeof opts.isReferenced === "function" ? opts.isReferenced : null;
  const metas = await backend.listMetas();
  const result = { removedSets: [], removedChunks: 0, keptPending: 0, keptSets: 0 };

  for (const meta of metas) {
    const age = now - Number(meta.createdAt || 0);
    const beatAge = now - Number(meta.beatAt || meta.createdAt || 0);
    const commitAge = now - Number(meta.committedAt || meta.createdAt || 0);
    let drop = false;
    if (meta.state === "pending") {
      // 用「最后心跳」而不是「创建时间」判活：跨标签页的大导入会持续刷新 beatAt。
      // 只有 createdAt 与 beatAt 都超过宽限期，才认为这条写入已经死了。
      if (age > grace && beatAge > grace) drop = true;
      else { result.keptPending++; continue; }
    } else if (meta.state === "ready") {
      if (isReferenced) {
        const exists = await isReferenced(meta.id);
        if (!exists) {
          if (commitAge > grace) drop = true;   // 超过宽限期还没 item 记录 = 残留
          else { result.keptSets++; continue; }
        } else { result.keptSets++; continue; }
      } else { result.keptSets++; continue; }
    } else {
      drop = true;                            // 未知状态：保守回滚
    }
    if (drop) {
      try {
        const removed = await discardChunks(meta.id);
        result.removedChunks += removed;
        result.removedSets.push(meta.id);
      } catch { /* 下次启动再清 */ }
    }
  }

  // 没有 meta 的块 → 孤儿
  let ids = [];
  try { ids = await backend.chunkItemIds(); } catch { ids = []; }
  const live = new Set(metas.map((m) => m.id));
  for (const id of ids) {
    if (live.has(id)) continue;
    try {
      const removed = await backend.delChunks(id);
      result.removedChunks += removed;
      if (removed) result.removedSets.push(id);
    } catch { /* ignore */ }
  }
  return result;
}

/** 调试/自测用：一组分块的统计 */
export async function chunkStats(itemId) {
  const id = String(itemId);
  const meta = await backend.getMeta(id);
  const count = await backend.countChunks(id);
  return { meta, count, expected: meta ? meta.total : 0 };
}

export { BAD_CODES };
