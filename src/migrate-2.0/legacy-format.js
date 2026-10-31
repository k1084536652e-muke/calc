/**
 * 2.0.0（旧 App，/workspace/calc-vault）已落盘数据格式的只读描述 + 纯映射函数。
 *
 * - 纯函数 / 纯常量：不碰 IndexedDB、不碰 DOM、不 import 主流程任何代码，
 *   因此可以在 Node 里直接 import 做单测（见 tests/node-migrate.mjs）。
 * - 每个参数的出处（旧仓库文件:行号）见 NOTES-xiaoma.md「2.0.0 存储格式」。
 * - **本文件不含任何解密逻辑**，解密在 legacy-crypto.js；这里只做「旧字段 → 新字段」的翻译。
 */

export const LEGACY_APP_VERSION = "2.0.0";

/** 旧数据库名。current 是 2.0.0 主库，后两个只作为只读迁移源（1.x 遗留）。 */
export const LEGACY_DB = Object.freeze({
  current: "calc-data-current",
  previous: "calc-data",
  oldest: "calculator-private-vault",
  order: ["calc-data-current", "calc-data", "calculator-private-vault"],
});

/** 旧加密参数（js/crypto.js、js/archive.js）。测试会拿旧仓库源码核对这份常量。 */
export const LEGACY_CRYPTO = Object.freeze({
  kdf: "PBKDF2",
  hash: "SHA-256",
  bits: 256,
  iterations: 600_000,       // js/crypto.js:1  PBKDF2_ITERATIONS
  legacyIterations: 100_000, // js/crypto.js:2  LEGACY_PBKDF2_ITERATIONS
  saltBytes: 16,             // js/crypto.js:121
  ivBytes: 12,               // js/crypto.js:83 / 351
  keyBytes: 32,              // js/crypto.js:3 MASTER_KEY_BYTES
  cipher: "AES-GCM",
  tagBits: 128,
  masterKeyAad: "local-tool/master-key/v2", // js/crypto.js:6 MASTER_KEY_AAD
  contentAad: null,          // 内容 / 元数据 / 缩略图加密不带 AAD（js/crypto.js:346-372）
});

export const LEGACY_CHUNK_SIZE = 4 * 1024 * 1024; // js/archive.js:1
export const LEGACY_METADATA_VERSION = 2;         // js/archive.js:2
export const LEGACY_TEXT_SCHEMA_VERSION = 2;      // js/content.js:12
export const LEGACY_FOLDER_SCHEMA_VERSION = 1;    // js/content.js:11

/** 旧 store 结构（仅供 detectLegacy 报告与文档对照，不做写入）。 */
export const LEGACY_STORES = Object.freeze({
  settings: { keyPath: "key", encrypted: false, keys: ["auth", "preferences", "dataSchema", "trashPurgeIndex"] },
  meta: { keyPath: "id", encrypted: true },
  thumbs: { keyPath: "mediaId", encrypted: true },
  chunks: { keyPath: ["mediaId", "index"], index: "mediaId", encrypted: true },
  texts: { keyPath: "id", encrypted: true },
  folders: { keyPath: "id", encrypted: true },
  trashMeta: { keyPath: "id", encrypted: true },
  trashTexts: { keyPath: "id", encrypted: true },
  trashFolders: { keyPath: "id", encrypted: true },
  migration: { keyPath: "id", encrypted: false },
  // 只在 1.x 源库出现的 store
  media: { keyPath: "id", encrypted: true, note: "1.x 整文件密文（PIN 派生密钥，非 DEK）" },
  legacyMeta: { keyPath: "id", encrypted: false, note: "1.x 明文摘要" },
});

const EXT_MIME = [
  ["image/jpeg", ".jpg"], ["image/png", ".png"], ["image/heic", ".heic"],
  ["image/gif", ".gif"], ["image/webp", ".webp"],
  ["video/mp4", ".mp4"], ["video/quicktime", ".mov"],
];

/** 旧 kind（image/video/file）→ 2.1.0 kind（photo/video/file/doc） */
export function newKindForLegacy(kind, mimeType = "") {
  const k = String(kind || "").toLowerCase();
  const mime = String(mimeType || "").toLowerCase();
  if (k === "video" || mime.startsWith("video/")) return "video";
  if (k === "image" || k === "photo" || mime.startsWith("image/")) return "photo";
  if (k === "text" || k === "doc") return "doc";
  return "file";
}

/** 旧版推断 mime（js/db.js:72-84 legacySummary 的兜底逻辑） */
export function legacyMimeFor({ kind, mimeType }) {
  if (mimeType) return mimeType;
  return kind === "video" ? "video/mp4" : "image/jpeg";
}

/** 纯文本 → 最小可用 HTML（保留段落与换行）。旧 1.x 文档只有 body，没有 html。 */
export function plainTextToHtml(text) {
  const escape = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const lines = String(text ?? "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  for (const line of lines) {
    blocks.push(line.trim() === "" ? "<p></p>" : `<p>${escape(line)}</p>`);
  }
  return blocks.length ? blocks.join("") : "<p></p>";
}

/**
 * 旧媒体元数据 → 2.1.0 条目（字段映射的唯一实现）。
 * 旧版没有 width/height，只能给 0；视频时长可以继承。
 *
 * @param {object} payload 解密后的旧元数据
 * @param {object} opts { id?:string, trashedAt?:number|null, folderIds?:string[] }
 */
export function legacyMediaToNewItem(payload, opts = {}) {
  const p = payload || {};
  const id = opts.id || p.id;
  const kind = newKindForLegacy(p.kind, p.mimeType);
  const trashedAt = opts.trashedAt ?? (Number.isFinite(p.trashedAt) ? p.trashedAt : null);
  const createdAt = Number(p.createdAt) || Date.now();
  return {
    id,
    kind,
    name: String(p.name || (kind === "video" ? "视频" : "照片")),
    mime: legacyMimeFor(p),
    size: Number(p.size) || 0,
    w: 0,                                  // 旧版没存宽高：布局需容忍 0（见 NOTES 待决 7）
    h: 0,
    dur: Number.isFinite(p.duration) ? Number(p.duration) : null,
    createdAt,
    updatedAt: Number(p.updatedAt) || createdAt,
    folderIds: Array.isArray(opts.folderIds) ? [...opts.folderIds] : [],
    trashedAt: trashedAt || null,
    hasThumb: !!opts.hasThumb,
    migratedFrom: { app: LEGACY_APP_VERSION, legacyId: id },
  };
}

/**
 * 旧文档 → 2.1.0 条目（正文另存 docs store）。
 * schemaVersion 2 用 payload.html；1 用 body 转 HTML。
 */
export function legacyTextToNewItem(payload, opts = {}) {
  const p = payload || {};
  const id = opts.id || p.id;
  const createdAt = Number(p.createdAt) || Date.now();
  const html = legacyTextHtml(p);
  const trashedAt = Number.isFinite(opts.trashedAt)
    ? opts.trashedAt
    : (Number.isFinite(p.trashedAt) ? p.trashedAt : null);
  return {
    id,
    kind: "doc",
    name: String(p.title || "无标题"),
    mime: "text/html",
    size: html.length,
    w: 0,
    h: 0,
    dur: null,
    createdAt,
    updatedAt: Number(p.updatedAt) || createdAt,
    folderIds: Array.isArray(opts.folderIds) ? [...opts.folderIds] : [],
    trashedAt,
    hasThumb: false,
    migratedFrom: { app: LEGACY_APP_VERSION, legacyId: id, legacySchemaVersion: Number(p.schemaVersion) || 1 },
  };
}

/** 从旧文档 payload 里取 HTML（供 saveDoc 使用） */
export function legacyTextHtml(payload) {
  const p = payload || {};
  const version = Number(p.schemaVersion) || 1;
  if (version === LEGACY_TEXT_SCHEMA_VERSION && typeof p.html === "string" && p.html.trim()) {
    return p.html;
  }
  return plainTextToHtml(p.body || "");
}

/** 旧文件夹 → 2.1.0 文件夹（id 由调用方映射成新 id，coverIds 稍后算） */
export function legacyFolderToNewFolder(payload, newId) {
  const p = payload || {};
  const createdAt = Number(p.createdAt) || Date.now();
  return {
    id: newId || p.id,
    n: String(p.name || "文件夹"),
    createdAt,
    updatedAt: Number(p.updatedAt) || createdAt,
    coverIds: [],
    migratedFrom: { app: LEGACY_APP_VERSION, legacyId: p.id },
  };
}

/** 文件夹封面候选：按创建时间倒序取前 max 个非文档条目（与 repo.setFolders 规则一致） */
export function coverIdsFor(items, folderId, max = 3) {
  return (items || [])
    .filter((it) => it && it.kind !== "doc" && !it.trashedAt && (it.folderIds || []).includes(folderId))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, max)
    .map((it) => it.id);
}

/** 旧 preferences → 2.1.0 settings（DEFAULT_SETTINGS 形状：showNames / retention / slideInt） */
export function legacyPreferencesToSettings(payload) {
  const p = payload || {};
  // 旧版可选 7/15/30/60/90/永不；2.1.0 只有 7/30/90/永不。
  // 一律「向上取到更长的保留期」，宁可晚删也不提前销毁用户内容。
  const retentionMap = { 7: "7", 15: "30", 30: "30", 60: "90", 90: "90" };
  let retention = "30";
  if (p.trashRetentionDays === null) retention = "never";
  else if (Number.isFinite(Number(p.trashRetentionDays))) {
    retention = retentionMap[Number(p.trashRetentionDays)] || "30";
  }
  // 旧版相册主题（system / day / night）。2.1.0 的主题在 localStorage（calc-theme / album-theme），
  // 不是 settings 字段：这里只负责取出来，由调用方（js/legacy-migrate.js）落到 localStorage。
  const theme = ["system", "day", "night"].includes(p.albumTheme) ? p.albumTheme : null;
  return {
    showNames: typeof p.showNames === "boolean" ? p.showNames : false,
    retention,
    // 旧版没有幻灯片间隔设置，用 2.1.0 默认 3 秒
    slideInt: "3",
    ...(theme ? { theme } : {}),
  };
}
