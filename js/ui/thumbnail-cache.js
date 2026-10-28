export const THUMBNAIL_CACHE_MAX_ENTRIES = 300;
export const THUMBNAIL_CACHE_MAX_BYTES = 60 * 1024 * 1024;

export class ThumbnailCache {
  constructor({
    maxEntries = THUMBNAIL_CACHE_MAX_ENTRIES,
    maxBytes = THUMBNAIL_CACHE_MAX_BYTES,
    onEvict = null,
  } = {}) {
    this.maxEntries = maxEntries;
    this.maxBytes = maxBytes;
    this.onEvict = onEvict;
    this.entries = new Map();
    this.totalBytes = 0;
  }

  get(id) {
    const entry = this.entries.get(id);
    if (!entry) {
      return null;
    }
    this.entries.delete(id);
    this.entries.set(id, entry);
    return entry.url;
  }

  has(id) {
    return this.entries.has(id);
  }

  set(id, url, size = 0, protectedIds = new Set()) {
    this.delete(id);
    const bytes = Math.max(0, Number(size) || 0);
    this.entries.set(id, { url, size: bytes });
    this.totalBytes += bytes;
    this.evictIfNeeded({ protectedIds });
    return url;
  }

  delete(id) {
    const entry = this.entries.get(id);
    if (!entry) {
      return false;
    }
    this.entries.delete(id);
    this.totalBytes = Math.max(0, this.totalBytes - entry.size);
    this.onEvict?.(entry.url, id);
    return true;
  }

  evictIfNeeded({ protectedIds = new Set() } = {}) {
    if (
      this.entries.size <= this.maxEntries &&
      this.totalBytes <= this.maxBytes
    ) {
      return [];
    }
    const evicted = [];
    for (const [id, entry] of this.entries) {
      if (
        this.entries.size <= this.maxEntries &&
        this.totalBytes <= this.maxBytes
      ) {
        break;
      }
      if (protectedIds.has(id)) {
        continue;
      }
      this.entries.delete(id);
      this.totalBytes = Math.max(0, this.totalBytes - entry.size);
      this.onEvict?.(entry.url, id);
      evicted.push({ id, url: entry.url, size: entry.size });
    }
    return evicted;
  }

  clear() {
    for (const [id, entry] of this.entries) {
      this.onEvict?.(entry.url, id);
    }
    this.entries.clear();
    this.totalBytes = 0;
  }
}
