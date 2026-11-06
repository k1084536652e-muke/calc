/**
 * 媒体缓存：解密后的字节 → objectURL，供缩略图、查看器、视频使用。
 * 约定：
 * - 缩略图走 LRU（上限 240 张，超出后 revoke 最久未用的），解锁时会话内复用；
 * - 原件 / 视频在查看器关闭时由调用方 release，锁定 / 退出时全部 revoke；
 * - 任何 URL 都不落盘，只存在于内存。
 *
 * 2.1.2 起：**分块存储**的条目不再整份解密（`readBlob()` 会对它们抛 CHUNKED），
 * 改为返回 SW 的虚拟 URL `/__media/<token>/<id>`（见 js/core/stream.js）——
 * 这个 URL 同样可以直接赋给 `<video src>` / 用作 background-image，UI 层无感，
 * 但字节是按 Range 逐块解密流式送达的，内存恒定在一块左右。
 */

import * as Stream from "./stream.js";

const THUMB_LIMIT = 240;
/** 流式 URL 不可用时，小于此大小的分块条目可退回整份解密成 blob URL（有界内存；大文件绝不走这条） */
const STREAM_BLOB_FALLBACK_MAX = 80 * 1024 * 1024;

export class MediaCache {
  constructor(vault) {
    this.vault = vault;
    this.urls = new Map();     // key `${kind}:${id}` -> url
    this.streams = new Set();  // 走 SW 虚拟 URL 的 key（不需要 revokeObjectURL，锁定时通知 SW 撤销）
    this.pending = new Map();  // key -> Promise<url|null>
    this.order = [];           // 缩略图 LRU 顺序
    this.epoch = 0;            // 缓存世代：clear()/授权撤销时自增，用来丢弃在途结果
    // 授权被撤销（锁定 / 切后台 / SW 换新）后，已缓存的 `/__media/<旧token>/…` 永远 403。
    // 必须在这里主动作废，否则回前台再打开同一张照片会一直黑屏。
    this.unsubscribe = Stream.onInvalidate(() => this.#invalidateStreams());
  }

  /** 丢掉所有虚拟 URL（只影响 SW 流式条目；blob: URL 仍然有效，不动） */
  #invalidateStreams() {
    this.epoch++;
    for (const key of [...this.streams]) {
      this.urls.delete(key);
      this.pending.delete(key);              // 旧 token 的授权结果作废，别贴回 DOM
      const i = this.order.indexOf(key);
      if (i >= 0) this.order.splice(i, 1);
    }
    this.streams.clear();
  }

  #key(kind, id) { return kind + ":" + id; }

  /** 同步取已缓存的 URL（供模板渲染用；未就绪返回 null） */
  url(kind, id) {
    const u = this.urls.get(this.#key(kind, id));
    if (u) this.#touch(kind, id);
    return u || null;
  }

  #touch(kind, id) {
    if (kind !== "thumb") return;
    const key = this.#key(kind, id);
    const i = this.order.indexOf(key);
    if (i >= 0) this.order.splice(i, 1);
    this.order.push(key);
    while (this.order.length > THUMB_LIMIT) {
      const old = this.order.shift();
      const u = this.urls.get(old);
      if (u) { URL.revokeObjectURL(u); this.urls.delete(old); }
    }
  }

  /** 确保某条目的某类数据已解密并缓存；返回 objectURL 或 null */
  ensure(kind, id) {
    const key = this.#key(kind, id);
    if (this.urls.has(key)) { this.#touch(kind, id); return Promise.resolve(this.urls.get(key)); }
    if (this.pending.has(key)) return this.pending.get(key);
    const ep = this.epoch;
    const task = (async () => {
      try {
        let bytes = null;
        let type = "application/octet-stream";
        if (kind === "thumb") bytes = await this.vault.readThumb(id);
        else {
          // 分块条目：交给 SW 的 Range 流式解密，绝不在页面里拼整份 Blob
          let chunked = false;
          try { chunked = await this.vault.isChunked(id); } catch { chunked = false; }
          if (chunked) {
            const url = await Stream.urlFor(id);
            // 授权在途中被撤销（锁屏/切后台）→ 这个 URL 已经是旧 token，绝不能缓存/回显
            if (url && ep === this.epoch) {
              this.urls.set(key, url);
              this.streams.add(key);
              this.#touch(kind, id);
              return url;
            }
            if (ep !== this.epoch) return null;
            // SW 流式不可用时：仅对小文件退回整份解密（大文件继续 fail-closed，避免 OOM）
            const item = this.vault.items.find((x) => x.id === id);
            const size = Number(item && item.size) || 0;
            if (!size || size > STREAM_BLOB_FALLBACK_MAX || typeof this.vault.readForExport !== "function") {
              return null;
            }
            bytes = await this.vault.readForExport(id);
          } else {
            bytes = await this.vault.readBlob(id);
          }
        }
        if (!bytes) return null;
        const item = this.vault.items.find((x) => x.id === id);
        /* 缩略图字节永远是 JPEG（cover.js / decodeImage 写入），绝不能用条目自身的
           video/mp4、video/quicktime 等 MIME——WebKit 会拒绝把这种 Blob 当图片绘进
           background-image，表现为「诊断说有封面、格子却是灰的」。 */
        if (kind === "thumb") type = "image/jpeg";
        else if (item && item.mime) type = item.mime;
        const url = URL.createObjectURL(new Blob([bytes], { type }));
        this.urls.set(key, url);
        this.#touch(kind, id);
        return url;
      } catch {
        return null;
      } finally {
        this.pending.delete(key);
      }
    })();
    this.pending.set(key, task);
    return task;
  }

  /** 释放某一类全部 URL（查看器关闭时释放原图 / 视频，缩略图 LRU 继续复用） */
  releaseKind(kind) {
    const prefix = kind + ":";
    for (const [key, url] of [...this.urls]) {
      if (!key.startsWith(prefix)) continue;
      if (this.streams.has(key)) {
        this.streams.delete(key);
        Stream.releaseItem(key.slice(prefix.length));   // 只丢这一个条目的 SW 授权
      } else {
        try { URL.revokeObjectURL(url); } catch { /* ignore */ }
      }
      this.urls.delete(key);
      const i = this.order.indexOf(key);
      if (i >= 0) this.order.splice(i, 1);
    }
  }

  release(kind, id) {
    const key = this.#key(kind, id);
    const u = this.urls.get(key);
    if (u) {
      if (this.streams.has(key)) { this.streams.delete(key); Stream.releaseItem(id); }
      else { try { URL.revokeObjectURL(u); } catch { /* ignore */ } }
      this.urls.delete(key);
    }
  }

  /** 锁定 / 退出相册：清空全部 URL（SW 侧的 key 由 stream.revoke 统一收回） */
  clear() {
    for (const [key, u] of this.urls) {
      if (this.streams.has(key)) continue;                // 虚拟 URL 不可 revoke，等 SW 撤销授权
      try { URL.revokeObjectURL(u); } catch { /* ignore */ }
    }
    this.urls.clear();
    this.streams.clear();
    this.pending.clear();
    this.order.length = 0;
    this.epoch++;                                         // 在途的解密结果一律丢弃，别在锁屏后又贴回照片
    Stream.revoke("media-clear");
  }

  /**
   * 渲染后把已解密缩略图贴到 DOM 上（不重建内容，符合 §25 不抖动的要求）。
   * 元素通过 data-thumb="<itemId>" 标记；解密完成后只改 background-image。
   */
  paintThumbs(root = document) {
    const nodes = root.querySelectorAll("[data-thumb]");
    const ids = new Set();
    nodes.forEach((el) => {
      const id = el.dataset.thumb;
      if (!id) return;
      const u = this.url("thumb", id);
      if (u) { el.style.backgroundImage = `url("${u}")`; }
      else ids.add(id);
    });
    for (const id of ids) {
      const ep = this.epoch;
      this.ensure("thumb", id).then((u) => {
        if (!u || ep !== this.epoch) return;
        document.querySelectorAll(`[data-thumb="${CSS.escape(id)}"]`).forEach((el) => {
          el.style.backgroundImage = `url("${u}")`;
        });
      });
    }
  }
}
