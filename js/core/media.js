/**
 * 媒体缓存：解密后的字节 → objectURL，供缩略图、查看器、视频使用。
 * 约定：
 * - 缩略图走 LRU（上限 240 张，超出后 revoke 最久未用的），解锁时会话内复用；
 * - 原件 / 视频在查看器关闭时由调用方 release，锁定 / 退出时全部 revoke；
 * - 任何 URL 都不落盘，只存在于内存。
 */

const THUMB_LIMIT = 240;

export class MediaCache {
  constructor(vault) {
    this.vault = vault;
    this.urls = new Map();     // key `${kind}:${id}` -> url
    this.pending = new Map();  // key -> Promise<url|null>
    this.order = [];           // 缩略图 LRU 顺序
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
    const task = (async () => {
      try {
        let bytes = null;
        let type = "application/octet-stream";
        if (kind === "thumb") bytes = await this.vault.readThumb(id);
        else if (kind === "orig") bytes = await this.vault.readBlob(id);
        else if (kind === "video") bytes = await this.vault.readBlob(id);
        if (!bytes) return null;
        const item = this.vault.items.find((x) => x.id === id);
        if (item && item.mime) type = item.mime;
        else if (kind === "thumb") type = "image/jpeg";
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
      try { URL.revokeObjectURL(url); } catch { /* ignore */ }
      this.urls.delete(key);
      const i = this.order.indexOf(key);
      if (i >= 0) this.order.splice(i, 1);
    }
  }

  release(kind, id) {
    const key = this.#key(kind, id);
    const u = this.urls.get(key);
    if (u) { URL.revokeObjectURL(u); this.urls.delete(key); }
  }

  /** 锁定 / 退出相册：清空全部 URL */
  clear() {
    for (const u of this.urls.values()) { try { URL.revokeObjectURL(u); } catch { /* ignore */ } }
    this.urls.clear();
    this.pending.clear();
    this.order.length = 0;
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
      this.ensure("thumb", id).then((u) => {
        if (!u) return;
        document.querySelectorAll(`[data-thumb="${CSS.escape(id)}"]`).forEach((el) => {
          el.style.backgroundImage = `url("${u}")`;
        });
      });
    }
  }
}
