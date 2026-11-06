/**
 * 仓储层：唯一持有 DEK 的地方。负责解锁 / 加锁、索引加载、条目与文件夹 CRUD、
 * 导入导出、设置、回收站与清除。上层 UI 只与这里交互，不直接碰 IndexedDB。
 *
 * 明文边界：DEK、条目明文（名称 / 文件夹 / 时间 / 缩略图字节）只在内存中出现；
 * 落盘一律是 {iv, ct} 信封 + 明文 AAD 绑定（AAD 里只有 id 与用途，不含内容）。
 */

import * as DB from "./db.js";
import * as Chunks from "./chunks.js";
import * as Cover from "./cover.js";
import {
  KDF_ITERATIONS, SALT_BYTES, DEK_BYTES,
  randomBytes, deriveKek, generateDek, importDek,
  seal, open, sealJson, openJson, sealText, openText,
  wrapDek, unwrapDek, wrapWipeMarker, unwrapWipeMarker, aadFor, toBytes,
} from "./crypto.js";

export const DEFAULT_SETTINGS = {
  showNames: false,
  retention: "30",     // "7" | "30" | "90" | "never"
  slideInt: "3",       // "2" | "3" | "5" | "8"
  autoLock: "never",   // "never" | "60" | "120" | "300"（秒）；永不 = 不自动锁
};

/**
 * 旧口径（4–9 位）：**只用于「验证已存在的码」**——2.0.0 / 2.1.1 的存量用户可能设的就是 4~5 位，
 * 解锁、二次确认、清除码校验必须继续接受，否则老用户直接被锁在门外（绝不能丢数据/丢访问权）。
 * 也用于迁移模块与测试播种旧数据（显式传 allowLegacy，见下）。
 */
export const PIN_RE = /^\d{4,9}$/;
/**
 * 新口径（6–9 位）：**只用于「设置新码」**（首次配置 / 修改解锁码 / 设置清除码）。
 * DESIGN-NOTES §52 要求 4–9 位是旧版；2.1.2 起 UI 与核心都收紧到 6–9，核心不能只有 UI 拦。
 */
export const NEW_PIN_RE = /^\d{6,9}$/;

const now = () => Date.now();
const newId = (prefix = "") => prefix + Array.from(randomBytes(8), (b) => b.toString(16).padStart(2, "0")).join("");

/** iOS 选片器有时给出空 type / application/octet-stream；按扩展名补全，避免被当成普通文件、Content-Type 不对导致无法播放 */
const EXT_MIME = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
  webp: "image/webp", heic: "image/heic", heif: "image/heif",
  mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", qt: "video/quicktime",
  webm: "video/webm", mkv: "video/x-matroska", "3gp": "video/3gpp", "3g2": "video/3gpp2",
};
function sniffMime(file) {
  const t = String((file && file.type) || "").trim();
  if (t && t !== "application/octet-stream") return t;
  const name = String((file && file.name) || "").toLowerCase();
  const dot = name.lastIndexOf(".");
  const ext = dot >= 0 ? name.slice(dot + 1) : "";
  return EXT_MIME[ext] || t || "application/octet-stream";
}

export function quotaError(err) {
  const name = err && (err.name || err.code);
  return name === "QuotaExceededError" || name === 22 || /quota/i.test(String(err && err.message));
}

export class Vault {
  constructor() {
    this.auth = null;        // {salt, iterations, wrappedDek, wipe?} 不解锁也能读（结构信息，无秘密）
    this.dekKey = null;      // CryptoKey，仅内存
    this.items = [];         // 内存索引（元数据全部解密）
    this.folders = [];
    this.settings = { ...DEFAULT_SETTINGS };
    this.onLock = null;
  }

  get unlocked() { return !!this.dekKey; }

  /** 读取库状态（不需要解锁）：是否已配置解锁码 / 是否已配置紧急清除码 */
  async status() {
    const row = await DB.get("auth", "vault");
    this.auth = row ? row.v : null;
    return {
      configured: !!(this.auth && this.auth.wrappedDek),
      wipeConfigured: !!(this.auth && this.auth.wipe),
      iterations: this.auth ? this.auth.iterations : KDF_ITERATIONS,
    };
  }

  async #saveAuth() {
    await DB.put("auth", { k: "vault", v: this.auth });
  }

  /**
   * 首次配置：生成 DEK 并用解锁码包裹；同时写入默认设置。
   * `allowLegacy:true` **只给迁移模块/测试**播种「旧版 4~5 位码」的数据用；UI 永不传。
   */
  async create(pin, { allowLegacy = false } = {}) {
    if (!(allowLegacy ? PIN_RE : NEW_PIN_RE).test(String(pin))) {
      throw new Error("解锁码须为 6–9 位数字");
    }
    const salt = randomBytes(SALT_BYTES);
    const kek = await deriveKek(pin, salt, KDF_ITERATIONS);
    const dek = await generateDek();
    const wrappedDek = await wrapDek(kek, dek.raw);
    this.auth = { version: 1, salt, iterations: KDF_ITERATIONS, wrappedDek, createdAt: now() };
    await this.#saveAuth();
    this.dekKey = dek.key;
    Chunks.setChunkKey(this.dekKey);
    this.items = [];
    this.folders = [];
    this.settings = { ...DEFAULT_SETTINGS };
    await this.saveSettings({});
    return true;
  }

  /** 解锁：能否解包 DEK 就是唯一的验证方式（不存解锁码、不存其哈希） */
  async unlock(pin) {
    if (!this.auth) await this.status();
    if (!this.auth || !this.auth.wrappedDek) return false;
    if (!PIN_RE.test(String(pin))) return false;
    let raw;
    try {
      const kek = await deriveKek(pin, this.auth.salt, this.auth.iterations || KDF_ITERATIONS);
      raw = await unwrapDek(kek, this.auth.wrappedDek);
    } catch {
      return false;   // 认证失败 = 解锁码不对
    }
    this.dekKey = await importDek(raw);
    Chunks.setChunkKey(this.dekKey);
    await this.loadAll();
    return true;
  }

  /** 只验证解锁码（不改变解锁状态、不加载索引）：用于敏感操作前的二次确认 */
  async verifyPin(pin) {
    if (!this.auth || !this.auth.wrappedDek) return false;
    if (!PIN_RE.test(String(pin))) return false;
    try {
      const kek = await deriveKek(pin, this.auth.salt, this.auth.iterations || KDF_ITERATIONS);
      await unwrapDek(kek, this.auth.wrappedDek);
      return true;
    } catch {
      return false;
    }
  }

  /** 锁定：丢弃 DEK 与全部内存明文 */
  lock() {
    this.dekKey = null;
    Chunks.clearChunkKey();
    this.items = [];
    this.folders = [];
    this.settings = { ...DEFAULT_SETTINGS };
    if (typeof this.onLock === "function") this.onLock();
  }

  #needKey() {
    if (!this.dekKey) throw new Error("已锁定");
    return this.dekKey;
  }

  /** 解锁后一次性解密全部元数据（DESIGN-NOTES §18：索引全量、缩略图懒加载） */
  async loadAll() {
    const key = this.#needKey();
    const rows = await DB.getAll("items");
    const items = await Promise.all(
      rows.map(async (row) => {
        try {
          return await openJson(key, row, aadFor("item", row.id));
        } catch {
          return null;   // 单条损坏不应拖垮整个索引
        }
      })
    );
    this.items = items.filter(Boolean).sort((a, b) => b.createdAt - a.createdAt);

    const frows = await DB.getAll("folders");
    const folders = await Promise.all(
      frows.map(async (row) => {
        try { return await openJson(key, row, aadFor("item", "folder:" + row.id)); } catch { return null; }
      })
    );
    this.folders = folders.filter(Boolean);

    const prow = await DB.get("prefs", "settings");
    if (prow) {
      try { this.settings = { ...DEFAULT_SETTINGS, ...(await openJson(key, prow, aadFor("prefs"))) }; }
      catch { this.settings = { ...DEFAULT_SETTINGS }; }
    } else {
      this.settings = { ...DEFAULT_SETTINGS };
    }
    return this;
  }

  // ---------- 条目 ----------

  async saveItem(item) {
    const key = this.#needKey();
    item.updatedAt = now();
    const env = await sealJson(key, item, aadFor("item", item.id));
    await DB.put("items", { id: item.id, ...env });
  }

  async saveItems(items) {
    const key = this.#needKey();
    const rows = await Promise.all(
      items.map(async (item) => {
        item.updatedAt = now();
        const env = await sealJson(key, item, aadFor("item", item.id));
        return { id: item.id, ...env };
      })
    );
    await DB.putMany("items", rows);
  }

  /** 移入回收站（软删除）；同时重算文件夹封面（已删项不得再当封面） */
  async trashItems(ids) {
    const set = new Set(ids);
    const list = this.items.filter((it) => set.has(it.id));
    for (const it of list) it.trashedAt = now();
    await this.saveItems(list);
    await this.refreshFolderCovers();
    return list.length;
  }

  /** 从回收站恢复；封面按恢复后的存活条目重算 */
  async restoreItems(ids) {
    const set = new Set(ids);
    const list = this.items.filter((it) => set.has(it.id));
    for (const it of list) it.trashedAt = null;
    await this.saveItems(list);
    await this.refreshFolderCovers();
    return list.length;
  }

  /**
   * 永久删除：条目 + 原件 + 缩略图 + 文档正文，再清分块。
   * @param {string[]} ids
   * @param {{ onProgress?: (p:{index:number,total:number,id:string,pct:number,chunkRemoved?:number,chunkTotal?:number})=>void }} [opts]
   */
  async purgeItems(ids, opts = {}) {
    const idset = new Set(ids);
    if (!idset.size) return 0;
    const onProgress = typeof opts.onProgress === "function" ? opts.onProgress : null;
    const list = [...idset];
    const ops = [];
    for (const id of list) {
      ops.push({ type: "del", store: "items", key: id });
      ops.push({ type: "del", store: "blobs", key: id });
      ops.push({ type: "del", store: "thumbs", key: id });
      ops.push({ type: "del", store: "docs", key: id });
    }
    await DB.writeBatch(ops);
    // 分块大文件：条目先删（避免悬空引用），再按批清分块；批间让出主线程
    for (let i = 0; i < list.length; i++) {
      const id = list[i];
      try {
        await Chunks.deleteChunkSet(id, {
          onProgress: onProgress
            ? (p) => {
              const frac = p.total ? p.removed / p.total : 1;
              onProgress({
                index: i + 1,
                total: list.length,
                id,
                chunkRemoved: p.removed,
                chunkTotal: p.total,
                pct: ((i + frac) / list.length) * 100,
              });
            }
            : null,
        });
      } catch { /* 残留块由启动时的 cleanupOrphans 兜底 */ }
      onProgress && onProgress({
        index: i + 1, total: list.length, id,
        pct: ((i + 1) / list.length) * 100,
      });
      await new Promise((r) => setTimeout(r, 0));
    }
    this.items = this.items.filter((it) => !idset.has(it.id));
    await this.refreshFolderCovers();
    return idset.size;
  }

  /** 回收站到期自动清理（打开应用时调用） */
  async purgeExpired(retention) {
    if (!retention || retention === "never") return 0;
    const days = Number(retention);
    if (!Number.isFinite(days) || days <= 0) return 0;
    const cutoff = now() - days * 86400_000;
    const expired = this.items.filter((it) => it.trashedAt && it.trashedAt < cutoff).map((it) => it.id);
    if (!expired.length) return 0;
    await this.purgeItems(expired);
    return expired.length;
  }

  async readBlob(id) {
    const key = this.#needKey();
    // 契约：分块大文件不走这里（整份解密会把内存打爆）。调用方应改用 readChunkRange / chunkStream。
    if (await Chunks.isChunked(id)) {
      throw new Chunks.ChunkError("该条目使用分块存储，请使用 readChunkRange/chunkStream 读取", "CHUNKED");
    }
    const row = await DB.get("blobs", id);
    if (!row) return null;
    return open(key, row, aadFor("blob", id));
  }

  // ---------- 分块大文件（2.1.2 底座，媒体层/播放器后续接入） ----------

  /** 该条目是否以分块格式存储 */
  isChunked(id) { return Chunks.isChunked(id); }

  /**
   * **仅导出用**：一次性取回该条目的全部明文字节（legacy 单 blob 直接解一个信封；
   * 分块条目按块解密后拼成一份 Uint8Array）。字节与用户原始文件**完全一致**，
   * 不解码、不重编码、不剥 EXIF —— 导出的 SHA-256 必须等于导入时源文件的 SHA-256。
   *
   * 约定（别拿它当通用读取接口）：
   *  - 播放 / 预览 / 缩略图**一律不许**走这里：分块条目的意义就是「永远不整份解密」，
   *    `readBlob()` 对分块条目继续抛 CHUNKED 的护栏保持不变；
   *  - 这里必然会把整份明文放进内存（大视频导出 = 整份缓冲），属于**已知且延期**的限制，
   *    不要在 UI 上承诺「大视频导出不占内存」。
   */
  async readForExport(id) {
    this.#needKey();
    if (!(await Chunks.isChunked(id))) return this.readBlob(id);
    const meta = await Chunks.getChunkMeta(id, { readyOnly: true });
    if (!meta) return null;
    const part = await Chunks.readRange(id, 0, meta.size, { key: this.dekKey });
    return part && part.bytes ? part.bytes : new Uint8Array(0);
  }

  /** 分块清单（含 size/total/chunkSize，用于 Range 响应头） */
  readChunkMeta(id) { return Chunks.getChunkMeta(id, { readyOnly: true }); }

  /** 按字节区间读取（只解密覆盖区间的块） */
  async readChunkRange(id, start = 0, end = Infinity) {
    this.#needKey();
    return Chunks.readRange(id, start, end, { key: this.dekKey });
  }

  /** 按字节区间流式读取（SW Range 响应用，内存里只有一块明文） */
  readChunkStream(id, range) {
    this.#needKey();
    return Chunks.chunkStream(id, { ...range, key: this.dekKey });
  }

  /**
   * 写入分块大文件：从 File/Blob 逐块读、逐块加密提交，最后 chunkmeta 作为唯一提交点。
   * 返回值 { meta } 或抛 ChunkError（CANCELLED / QUOTA / BAD_SIZE / INCOMPLETE）。
   */
  async putChunkedFile(id, file, { onProgress, cancelled, chunkSize, kind, mime } = {}) {
    this.#needKey();
    const meta = await Chunks.importFileChunked(id, file, {
      onProgress, cancelled, chunkSize, kind, mime, key: this.dekKey,
    });
    return meta;
  }

  /** 启动时清理中断的导入留下的孤儿分块（不删正在导入的：有 grace 宽限） */
  async cleanupChunkOrphans(graceMs) {
    const ids = new Set(this.items.map((it) => it.id));
    return Chunks.cleanupOrphans({
      graceMs,
      isReferenced: async (id) => ids.has(id) || !!(await DB.get("items", id)),
    });
  }

  async putBlob(id, bytes) {
    const key = this.#needKey();
    const env = await seal(key, bytes, aadFor("blob", id));
    await DB.put("blobs", { id, ...env });
  }

  async readThumb(id) {
    const key = this.#needKey();
    const row = await DB.get("thumbs", id);
    if (!row) return null;
    try { return await open(key, row, aadFor("thumb", id)); } catch { return null; }
  }

  async putThumb(id, bytes) {
    const key = this.#needKey();
    const env = await seal(key, bytes, aadFor("thumb", id));
    await DB.put("thumbs", { id, ...env });
  }

  async deleteThumb(id) {
    try { await DB.del("thumbs", id); } catch { /* */ }
  }

  // ---------- 文档 ----------

  async saveDoc(id, html) {
    const key = this.#needKey();
    const env = await sealText(key, html, aadFor("doc", id));
    await DB.put("docs", { id, ...env });
  }

  async readDoc(id) {
    const key = this.#needKey();
    const row = await DB.get("docs", id);
    if (!row) return "";
    try { return await openText(key, row, aadFor("doc", id)); } catch { return ""; }
  }

  // ---------- 文件夹 ----------

  async saveFolder(folder) {
    const key = this.#needKey();
    folder.updatedAt = now();
    const env = await sealJson(key, folder, aadFor("item", "folder:" + folder.id));
    await DB.put("folders", { id: folder.id, ...env });
  }

  async saveFolders(folders) {
    const key = this.#needKey();
    const rows = await Promise.all(
      folders.map(async (folder) => {
        folder.updatedAt = now();
        const env = await sealJson(key, folder, aadFor("item", "folder:" + folder.id));
        return { id: folder.id, ...env };
      })
    );
    await DB.putMany("folders", rows);
  }

  /** 新建文件夹（同时写回内存索引与库） */
  async createFolder(name) {
    const folder = { id: newId("f"), n: String(name).trim(), createdAt: now(), updatedAt: now(), coverIds: [] };
    this.folders.push(folder);
    await this.saveFolder(folder);
    return folder;
  }

  async deleteFolders(ids) {
    const idset = new Set(ids);
    await DB.delMany("folders", [...idset]);
    this.folders = this.folders.filter((f) => !idset.has(f.id));
    const affected = this.items.filter((it) => (it.folderIds || []).some((f) => idset.has(f)));
    for (const it of affected) it.folderIds = (it.folderIds || []).filter((f) => !idset.has(f));
    if (affected.length) await this.saveItems(affected);
  }

  /** 文件夹归属：非互斥（§31） */
  async setFolders(itemIds, addIds, removeIds) {
    const add = new Set(addIds || []);
    const remove = new Set(removeIds || []);
    const idset = new Set(itemIds);
    const touched = this.items.filter((it) => idset.has(it.id));
    for (const it of touched) {
      const set = new Set(it.folderIds || []);
      add.forEach((f) => set.add(f));
      remove.forEach((f) => set.delete(f));
      it.folderIds = [...set];
    }
    if (touched.length) await this.saveItems(touched);
    await this.refreshFolderCovers();
    return touched.length;
  }

  /**
   * 按当前未删除条目重算每个文件夹的 coverIds（最多 3 张，跳过文档与回收站）。
   * 软删除 / 恢复 / 永久删除 / 加入移出文件夹后都要跑，避免封面仍指向已删项。
   */
  async refreshFolderCovers() {
    const covers = new Map();
    for (const it of this.items) {
      if (it.trashedAt) continue;
      if (!it.folderIds || !it.folderIds.length) continue;
      if (it.kind === "doc") continue;
      for (const fid of it.folderIds) {
        if (!covers.has(fid)) covers.set(fid, []);
        covers.get(fid).push(it);
      }
    }
    const changed = [];
    for (const f of this.folders) {
      const list = (covers.get(f.id) || []).slice(0, 3).map((it) => it.id);
      const cur = (f.coverIds || []).join(",");
      if (cur !== list.join(",")) { f.coverIds = list; changed.push(f); }
    }
    if (changed.length) await this.saveFolders(changed);
    return changed.length;
  }

  // ---------- 设置 ----------

  async saveSettings(patch) {
    const key = this.#needKey();
    Object.assign(this.settings, patch || {});
    const env = await sealJson(key, this.settings, aadFor("prefs"));
    await DB.put("prefs", { id: "settings", ...env });
    return this.settings;
  }

  // ---------- 安全相关 ----------

  /** 修改解锁码：只重新包裹 DEK，不重新加密任何数据（当前码允许旧口径，新码必须 6–9 位） */
  async changePin(current, next, { allowLegacy = false } = {}) {
    if (!(allowLegacy ? PIN_RE : NEW_PIN_RE).test(String(next))) {
      throw new Error("解锁码须为 6–9 位数字");
    }
    const kekOld = await deriveKek(current, this.auth.salt, this.auth.iterations || KDF_ITERATIONS);
    let raw;
    try {
      raw = await unwrapDek(kekOld, this.auth.wrappedDek);
    } catch {
      throw new Error("解锁码不正确");
    }
    const salt = randomBytes(SALT_BYTES);
    const kekNew = await deriveKek(next, salt, KDF_ITERATIONS);
    this.auth = { ...this.auth, salt, iterations: KDF_ITERATIONS, wrappedDek: await wrapDek(kekNew, raw) };
    await this.#saveAuth();
    return true;
  }

  /** 紧急清除码：单独盐 + 包裹一个随机标记；不存码、不存哈希（新设必须 6–9 位） */
  async setWipeCode(code, { allowLegacy = false } = {}) {
    if (!(allowLegacy ? PIN_RE : NEW_PIN_RE).test(String(code))) {
      throw new Error("清除码须为 6–9 位数字");
    }
    // 必须与解锁码不同：若该码能解包 DEK，说明它就是解锁码
    const probeKek = await deriveKek(code, this.auth.salt, this.auth.iterations || KDF_ITERATIONS);
    try {
      await unwrapDek(probeKek, this.auth.wrappedDek);
      throw new Error("清除码不能与解锁码相同");
    } catch (err) {
      if (err && err.message === "清除码不能与解锁码相同") throw err;
    }
    const salt = randomBytes(SALT_BYTES);
    const kek = await deriveKek(code, salt, KDF_ITERATIONS);
    const marker = randomBytes(DEK_BYTES);
    this.auth = {
      ...this.auth,
      wipe: { salt, iterations: KDF_ITERATIONS, wrapped: await wrapWipeMarker(kek, marker), createdAt: now() },
    };
    await this.#saveAuth();
    return true;
  }

  async disableWipeCode() {
    if (!this.auth || !this.auth.wipe) return false;
    const next = { ...this.auth };
    delete next.wipe;
    this.auth = next;
    await this.#saveAuth();
    return true;
  }

  /** 验证紧急清除码；未配置时返回 false（不泄露配置状态给调用方以外的地方） */
  async checkWipeCode(code) {
    if (!this.auth || !this.auth.wipe) return false;
    try {
      const kek = await deriveKek(code, this.auth.wipe.salt, this.auth.wipe.iterations || KDF_ITERATIONS);
      await unwrapWipeMarker(kek, this.auth.wipe.wrapped);
      return true;
    } catch {
      return false;
    }
  }

  /** 清空全部数据（设置页）：删内容与文件夹，保留解锁码与设置 */
  async clearContent() {
    await DB.clearStores(["items", "thumbs", "blobs", "docs", "folders", "chunks", "chunkmeta"]);
    this.items = [];
    this.folders = [];
    return true;
  }

  /** 紧急清除：删除全部内容 + 解锁码 / 清除码配置（回到首次使用状态） */
  async wipeAll() {
    await DB.clearStores(["items", "thumbs", "blobs", "docs", "folders", "chunks", "chunkmeta", "prefs", "auth", "meta"]);
    this.auth = null;
    this.dekKey = null;
    Chunks.clearChunkKey();
    this.items = [];
    this.folders = [];
    this.settings = { ...DEFAULT_SETTINGS };
    return true;
  }

  // ---------- 导入 ----------

  /**
   * 导入文件（照片 / 视频 / 其它文件）。
   * 逐个处理：解码 → 生成缩略图 → 加密写入 → 更新内存索引；任一项失败不影响其它项。
   * onProgress({index,total,name,pct}) 用于 §44 进度弹窗；opts.cancelled() 返回 true 时中止。
   */
  async importFiles(files, { onProgress, cancelled } = {}) {
    this.#needKey();
    const total = files.length;
    const imported = [];
    const failed = [];
    let attempted = 0;
    let quotaHit = null;

    /* iOS：文件选择的用户手势只在本轮同步栈里有效。
       先给所有视频同步 beginCapture（挂 blob URL + play），再逐个 await 结果 + 加密写入。 */
    const videoPrimes = new Map();
    const videoPrimed = new Set();
    for (const file of files) {
      const mime0 = sniffMime(file);
      if (/^video\//.test(mime0)) videoPrimes.set(file, Cover.beginCapture(file, { mime: mime0 }));
    }

    for (let i = 0; i < total; i++) {
      if (cancelled && cancelled()) break;
      if (!this.dekKey) break;           // 已锁定：不再处理后续文件（每一个都会因无 key 抛错）
      const file = files[i];
      const name = (file && file.name) || "未命名";
      const mime = sniffMime(file);
      const kind = /^image\//.test(mime) ? "photo" : /^video\//.test(mime) ? "video" : "file";
      const id = newId(kind === "photo" ? "p" : kind === "video" ? "v" : "x");
      attempted++;
      onProgress && onProgress({ index: i + 1, total, name, pct: (i / total) * 100 });

      try {
        // 1) 元数据 + 缩略图：直接从 File 解码（图片用 createImageBitmap / <img>，
        //    视频用导入时 beginCapture 的句柄），**不做 file.arrayBuffer()**
        const item = {
          id,
          kind,
          name,
          mime,
          size: file.size || 0,
          w: 0, h: 0, dur: null,
          createdAt: now(),
          updatedAt: now(),
          folderIds: [],
          trashedAt: null,
          hasThumb: false,
        };
        let thumb = null;
        if (kind === "photo") {
          const meta = await decodeImage(file);
          item.w = meta.w; item.h = meta.h; thumb = meta.thumb;
        } else if (kind === "video") {
          const handle = videoPrimes.get(file);
          if (handle) videoPrimed.add(file);
          const meta = handle ? await handle.promise : await Cover.captureCover(file, { mime });
          item.w = meta.w; item.h = meta.h; item.dur = meta.dur; thumb = meta.thumb;
          if (!thumb && meta.reason) {
            item.coverFail = meta.reason;
            item.coverFailAt = now();
            item.coverFailGen = Cover.COVER_GEN;
            item.coverFailMs = meta.ms || null;
          }
        }

        // 2) 分块加密写入：File.slice 逐块读 → 逐块加密 → 逐块提交，内存峰值 ≈ 一块
        await this.putChunkedFile(id, file, {
          kind, mime: item.mime, cancelled,
          onProgress: ({ pct }) => onProgress
            && onProgress({ index: i + 1, total, name, pct: (i / total) * 100 + (pct || 0) / total }),
        });

        // 3) 缩略图/首帧仍加密写入 thumbs store
        if (thumb) {
          await this.putThumb(id, thumb); item.hasThumb = true;
          delete item.coverFail; delete item.coverFailAt; delete item.coverFailGen;
        }

        // 4) 条目最后提交：这一步成功才算导入完成（此前失败都不可见、可回滚）
        this.items.unshift(item);
        await this.saveItem(item);
        imported.push(item);
      } catch (err) {
        // 失败 / 取消 / 配额：回滚本次已写入的块与缩略图，绝不留半截数据
        try { await Chunks.discardChunks(id); } catch { /* ignore */ }
        try { await DB.del("thumbs", id); } catch { /* ignore */ }
        // saveItem 抛错时内存索引里可能已经 unshift 了这条：一并撤掉，避免「列表里有、库里没有」
        if (this.items.some((x) => x.id === id)) this.items = this.items.filter((x) => x.id !== id);
        if (cancelled && cancelled()) break;                 // 用户取消：不计失败，直接停
        // 锁定（自动锁 / 手动锁）导致在途导入中断：立刻停，不继续写明文、不提交后续条目
        if (!this.dekKey) break;
        failed.push({ name, error: err, code: (err && err.code) || (err && err.name) || "ERROR" });
        if (Chunks.isQuotaError(err) || quotaError(err)) { quotaHit = err; break; }
      }
      onProgress && onProgress({ index: i + 1, total, name, pct: ((i + 1) / total) * 100 });
    }

    // 配额中断：没轮到的文件也明确计入 failed，保证「成功 N / 失败 M」之和 = 总数，
    // 不给用户「剩下 80 个去哪了」的静默截断。
    if (quotaHit && attempted < total) {
      const reason = new Error("本机存储空间不足，尚未导入");
      for (let k = attempted; k < total; k++) {
        failed.push({ name: (files[k] && files[k].name) || "未命名", error: reason, code: "QUOTA", skipped: true });
      }
    }
    // 取消尚未轮到的取帧（已 await 的会自己收尾）
    for (const [f, h] of videoPrimes) {
      if (!videoPrimed.has(f)) { try { h.cancel(); } catch { /* */ } }
    }
    return { imported, failed };
  }
}

/** 解码图片（入参是 File/Blob）：取尺寸 + 生成缩略图（长边 320，JPEG 0.72）
 *  不读整份 arrayBuffer —— createImageBitmap / <img> 都能直接吃 Blob。 */
async function decodeImage(file) {
  try {
    if (window.createImageBitmap) {
      const bmp = await createImageBitmap(file);
      const out = drawThumb(bmp, bmp.width, bmp.height);
      const thumb = await canvasToBytes(out.canvas);
      bmp.close && bmp.close();
      return { w: out.w, h: out.h, thumb };
    }
  } catch { /* 退回 <img> 路径 */ }
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const out = drawThumb(img, img.naturalWidth, img.naturalHeight);
    return { w: out.w, h: out.h, thumb: await canvasToBytes(out.canvas) };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片解码失败"));
    img.src = src;
  });
}

function drawThumb(source, w, h) {
  const MAX = 320;
  const scale = Math.min(1, MAX / Math.max(w || 1, h || 1));
  const tw = Math.max(1, Math.round((w || 1) * scale));
  const th = Math.max(1, Math.round((h || 1) * scale));
  const canvas = document.createElement("canvas");
  canvas.width = tw; canvas.height = th;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(source, 0, 0, tw, th);
  return { w, h, thumb: null, canvas };
}

/** 把 canvas 转成可存储的字节（异步） */
function canvasToBytes(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      if (!blob) return resolve(null);
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, "image/jpeg", 0.72);
  });
}
