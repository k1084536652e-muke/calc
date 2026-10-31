/**
 * 仓储层：唯一持有 DEK 的地方。负责解锁 / 加锁、索引加载、条目与文件夹 CRUD、
 * 导入导出、设置、回收站与清除。上层 UI 只与这里交互，不直接碰 IndexedDB。
 *
 * 明文边界：DEK、条目明文（名称 / 文件夹 / 时间 / 缩略图字节）只在内存中出现；
 * 落盘一律是 {iv, ct} 信封 + 明文 AAD 绑定（AAD 里只有 id 与用途，不含内容）。
 */

import * as DB from "./db.js";
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
};

export const PIN_RE = /^\d{4,9}$/;

const now = () => Date.now();
const newId = (prefix = "") => prefix + Array.from(randomBytes(8), (b) => b.toString(16).padStart(2, "0")).join("");

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

  /** 首次配置：生成 DEK 并用解锁码包裹；同时写入默认设置 */
  async create(pin) {
    if (!PIN_RE.test(String(pin))) throw new Error("解锁码须为 4–9 位数字");
    const salt = randomBytes(SALT_BYTES);
    const kek = await deriveKek(pin, salt, KDF_ITERATIONS);
    const dek = await generateDek();
    const wrappedDek = await wrapDek(kek, dek.raw);
    this.auth = { version: 1, salt, iterations: KDF_ITERATIONS, wrappedDek, createdAt: now() };
    await this.#saveAuth();
    this.dekKey = dek.key;
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

  /** 移入回收站（软删除） */
  async trashItems(ids) {
    const set = new Set(ids);
    const list = this.items.filter((it) => set.has(it.id));
    for (const it of list) it.trashedAt = now();
    await this.saveItems(list);
    return list.length;
  }

  async restoreItems(ids) {
    const set = new Set(ids);
    const list = this.items.filter((it) => set.has(it.id));
    for (const it of list) it.trashedAt = null;
    await this.saveItems(list);
    return list.length;
  }

  /** 永久删除：条目 + 原件 + 缩略图 + 文档正文，一次事务清干净 */
  async purgeItems(ids) {
    const idset = new Set(ids);
    if (!idset.size) return 0;
    const ops = [];
    for (const id of idset) {
      ops.push({ type: "del", store: "items", key: id });
      ops.push({ type: "del", store: "blobs", key: id });
      ops.push({ type: "del", store: "thumbs", key: id });
      ops.push({ type: "del", store: "docs", key: id });
    }
    await DB.writeBatch(ops);
    this.items = this.items.filter((it) => !idset.has(it.id));
    // 文件夹封面候选同步剔除
    let touched = false;
    for (const f of this.folders) {
      const before = (f.coverIds || []).length;
      f.coverIds = (f.coverIds || []).filter((id) => !idset.has(id));
      if (before !== f.coverIds.length) touched = true;
    }
    if (touched) await this.saveFolders(this.folders);
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
    const row = await DB.get("blobs", id);
    if (!row) return null;
    return open(key, row, aadFor("blob", id));
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

    // 封面候选：最近加入的图片排到第一张（§32）
    const covers = new Map();
    for (const it of this.items) {
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
    return touched.length;
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

  /** 修改解锁码：只重新包裹 DEK，不重新加密任何数据 */
  async changePin(current, next) {
    if (!PIN_RE.test(String(next))) throw new Error("解锁码须为 4–9 位数字");
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

  /** 紧急清除码：单独盐 + 包裹一个随机标记；不存码、不存哈希 */
  async setWipeCode(code) {
    if (!PIN_RE.test(String(code))) throw new Error("清除码须为 4–9 位数字");
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
    await DB.clearStores(["items", "thumbs", "blobs", "docs", "folders"]);
    this.items = [];
    this.folders = [];
    return true;
  }

  /** 紧急清除：删除全部内容 + 解锁码 / 清除码配置（回到首次使用状态） */
  async wipeAll() {
    await DB.clearStores(["items", "thumbs", "blobs", "docs", "folders", "prefs", "auth", "meta"]);
    this.auth = null;
    this.dekKey = null;
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

    for (let i = 0; i < total; i++) {
      if (cancelled && cancelled()) break;
      const file = files[i];
      const name = file.name || "未命名";
      const kind = /^image\//.test(file.type) ? "photo" : /^video\//.test(file.type) ? "video" : "file";
      onProgress && onProgress({ index: i + 1, total, name, pct: (i / total) * 100 });

      try {
        const buffer = await file.arrayBuffer();
        const id = newId(kind === "photo" ? "p" : kind === "video" ? "v" : "x");
        const item = {
          id,
          kind,
          name,
          mime: file.type || "application/octet-stream",
          size: file.size || buffer.byteLength,
          w: 0, h: 0, dur: null,
          createdAt: now(),
          updatedAt: now(),
          folderIds: [],
          trashedAt: null,
          hasThumb: false,
        };

        if (kind === "photo") {
          const meta = await decodeImage(buffer);
          item.w = meta.w; item.h = meta.h;
          if (meta.thumb) { await this.putThumb(id, meta.thumb); item.hasThumb = true; }
        } else if (kind === "video") {
          const meta = await decodeVideo(buffer, file.type);
          item.w = meta.w; item.h = meta.h; item.dur = meta.dur;
          if (meta.thumb) { await this.putThumb(id, meta.thumb); item.hasThumb = true; }
        }

        await this.putBlob(id, buffer);
        this.items.unshift(item);
        await this.saveItem(item);
        imported.push(item);
      } catch (err) {
        failed.push({ name, error: err });
        if (quotaError(err)) throw Object.assign(new Error("本机存储空间不足，未能导入「" + name + "」"), { quota: true });
      }
      onProgress && onProgress({ index: i + 1, total, name, pct: ((i + 1) / total) * 100 });
    }
    return { imported, failed };
  }
}

/** 解码图片：取尺寸 + 生成缩略图（长边 320，JPEG 0.72） */
async function decodeImage(buffer) {
  const blob = new Blob([buffer]);
  try {
    if (window.createImageBitmap) {
      const bmp = await createImageBitmap(blob);
      const out = drawThumb(bmp, bmp.width, bmp.height);
      bmp.close && bmp.close();
      return { w: out.w, h: out.h, thumb: await canvasToBytes(out.canvas) };
    }
  } catch { /* 退回 <img> 路径 */ }
  const url = URL.createObjectURL(blob);
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

/** 解码视频：取尺寸 + 时长 + 首帧缩略图（失败时只丢封面，不影响导入） */
async function decodeVideo(buffer, mime) {
  const blob = new Blob([buffer], { type: mime || "video/mp4" });
  const url = URL.createObjectURL(blob);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  video.src = url + "#t=0.1";
  const meta = await new Promise((resolve) => {
    const done = (v) => resolve(v);
    video.onloadedmetadata = () => done({ w: video.videoWidth || 0, h: video.videoHeight || 0, dur: Number.isFinite(video.duration) ? video.duration : null });
    video.onerror = () => done({ w: 0, h: 0, dur: null });
    setTimeout(() => done({ w: video.videoWidth || 0, h: video.videoHeight || 0, dur: Number.isFinite(video.duration) ? video.duration : null }), 4000);
  });
  let thumb = null;
  try {
    video.currentTime = 0.1;
    await new Promise((resolve) => {
      video.onseeked = () => resolve();
      setTimeout(resolve, 2500);
    });
    if (video.videoWidth && video.videoHeight) {
      const { canvas } = drawThumb(video, video.videoWidth, video.videoHeight);
      thumb = await canvasToBytes(canvas);
    }
  } catch { /* 无封面 */ }
  URL.revokeObjectURL(url);
  return { ...meta, thumb };
}
