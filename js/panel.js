import {
  beginSystemPanel,
  endSystemPanel,
} from "./system-panel.js";
import {
  closeAllDialogs,
  showAlert,
  showChoice,
  showConfirm,
  showPrompt,
  showToast as showUiToast,
} from "./dialogs.js";
import {
  decryptMetadata,
  decryptThumbnail,
  encryptMetadata,
  encryptThumbnail,
  importFileInChunks,
  migrateLegacyRecord,
  readOriginalBlob,
  readOriginalBlobParts,
} from "./archive.js";
import {
  contentId,
  decryptFolder,
  decryptText,
  moveContentRecords,
  renameTextRecord,
  renameMediaRecord,
  removeFolder,
  saveFolder,
  saveText,
  splitMediaName,
  validateMediaBaseName,
} from "./content.js";
import { createDocumentEditor } from "./document-editor.js";
import {
  LARGE_EXPORT_CONFIRM_MESSAGE,
  SHARE_FAILURE_MESSAGE,
  chooseExportStrategy,
  exportProgressText,
  hasLargeExport,
  isAppleMobile,
  makeFileFromParts,
} from "./media-export.js";
import {
  loadPreferences,
  savePreferences,
} from "./preferences.js";
import {
  THUMBNAIL_SIZE,
  captureVideoThumbnail,
} from "./thumbnails.js";
import {
  buildTrashPurgeEntries,
  getTrashItems,
  purgeTrashItems,
  restoreTrashItems,
  syncTrashOnUnlock,
  trashContentRecords,
} from "./trash.js";
import { ic } from "./icons.js";
import { sanitizeHtml } from "./sanitize.js";
import {
  documentCharacterCount,
  formatDocumentDate,
  htmlToPlainText,
  textBodyToHtml,
  textRecordForDisplay,
} from "./text-content.js";
import { createPlyrOptions, sideOf } from "./video.js";
import {
  FOLDER_COVER_LIMIT,
  pickFolderCoverItems,
} from "./ui/folder-cover.js";
import {
  INCREMENTAL_BATCH_SIZE,
  nextBatchWindow,
  renderBatchSize,
} from "./ui/paging.js";
import {
  THUMBNAIL_CACHE_MAX_BYTES,
  THUMBNAIL_CACHE_MAX_ENTRIES,
  ThumbnailCache,
} from "./ui/thumbnail-cache.js";
import { trashRemainingLabel } from "./ui/trash-format.js";
import {
  filterItems,
  highlightParts,
  matchQuery,
} from "./ui/search.js";
import {
  selectionActions,
  selectionContext,
} from "./ui/selection.js";
import {
  LONG_PRESS_MS,
  LongPressController,
} from "./ui/long-press.js";
import {
  readCalcThemePreference,
  retentionLabel,
  retentionOptions,
  writeCalcThemePreference,
} from "./ui/settings.js";

const THUMBNAIL_QUALITY = 0.82;
const LARGE_FILE_BYTES = 200 * 1024 * 1024;
const SHARE_MEMORY_LIMIT_BYTES = 64 * 1024 * 1024;
const THUMBNAIL_CONCURRENCY = 4;
const SEARCH_DEBOUNCE_MS = 150;

export function needsThumbnailBackfill(record) {
  return (
    record.kind === "video" &&
    !record.legacy &&
    !(Number(record.thumbnailVersion) >= 2)
  );
}

export function mergeThumbnailBackfillMetadata(current, result) {
  return {
    ...current,
    duration: result.duration || current.duration || null,
    thumbnailVersion: 2,
  };
}

export function recordSearchText(record) {
  return [record.name, record.title, record.body]
    .filter(Boolean)
    .join("\n")
    .toLocaleLowerCase("zh-CN");
}

function uid() {
  if (typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("无法生成缩略图"));
        }
      },
      "image/jpeg",
      THUMBNAIL_QUALITY
    );
  });
}

function waitForMediaEvent(target, eventName, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("内容加载超时"));
    }, timeoutMs);

    const onEvent = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("内容无法解码"));
    };
    const cleanup = () => {
      window.clearTimeout(timer);
      target.removeEventListener(eventName, onEvent);
      target.removeEventListener("error", onError);
    };

    target.addEventListener(eventName, onEvent, { once: true });
    target.addEventListener("error", onError, { once: true });
  });
}

function drawCover(context, source, sourceWidth, sourceHeight) {
  const scale = Math.max(
    THUMBNAIL_SIZE / sourceWidth,
    THUMBNAIL_SIZE / sourceHeight
  );
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  context.fillStyle = "#111113";
  context.fillRect(0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
  context.drawImage(
    source,
    (THUMBNAIL_SIZE - width) / 2,
    (THUMBNAIL_SIZE - height) / 2,
    width,
    height
  );
}

function placeholderCanvas(label) {
  const canvas = document.createElement("canvas");
  canvas.width = THUMBNAIL_SIZE;
  canvas.height = THUMBNAIL_SIZE;
  const context = canvas.getContext("2d");
  const gradient = context.createLinearGradient(
    0,
    0,
    THUMBNAIL_SIZE,
    THUMBNAIL_SIZE
  );
  gradient.addColorStop(0, "#242426");
  gradient.addColorStop(1, "#101012");
  context.fillStyle = gradient;
  context.fillRect(0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
  context.fillStyle = "#ff9f0a";
  context.beginPath();
  context.arc(THUMBNAIL_SIZE / 2, 210, 72, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#000000";
  context.beginPath();
  context.moveTo(218, 172);
  context.lineTo(276, 210);
  context.lineTo(218, 248);
  context.closePath();
  context.fill();
  context.fillStyle = "#ffffff";
  context.font =
    '600 28px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, THUMBNAIL_SIZE / 2, 330);
  return canvas;
}

async function imageThumbnail(file) {
  let bitmap = null;
  let image = null;
  let objectUrl = "";
  const canvas = document.createElement("canvas");
  canvas.width = THUMBNAIL_SIZE;
  canvas.height = THUMBNAIL_SIZE;
  const context = canvas.getContext("2d");

  try {
    if (typeof createImageBitmap === "function") {
      bitmap = await createImageBitmap(file);
      drawCover(context, bitmap, bitmap.width, bitmap.height);
    } else {
      objectUrl = URL.createObjectURL(file);
      image = new Image();
      const loaded = waitForMediaEvent(image, "load", 8_000);
      image.src = objectUrl;
      await loaded;
      drawCover(context, image, image.naturalWidth, image.naturalHeight);
    }
    return await canvasToBlob(canvas);
  } catch {
    return canvasToBlob(placeholderCanvas("照片"));
  } finally {
    if (bitmap && typeof bitmap.close === "function") {
      bitmap.close();
    }
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

async function videoThumbnail(file) {
  const objectUrl = URL.createObjectURL(file);
  return captureVideoThumbnail({
    source: objectUrl,
    drawFrame: drawCover,
    createPlaceholder: placeholderCanvas,
    cleanupSource: () => {
      URL.revokeObjectURL(objectUrl);
    },
  });
}

async function videoThumbnailFromUrl(source) {
  return captureVideoThumbnail({
    source,
    drawFrame: drawCover,
    createPlaceholder: placeholderCanvas,
  });
}

async function createThumbnail(file, kind) {
  if (kind === "video") {
    return videoThumbnail(file);
  }
  return {
    blob: await imageThumbnail(file),
    duration: null,
    frameCaptured: true,
  };
}

function inferKind(file) {
  if (file.type.startsWith("image/")) {
    return "image";
  }
  if (file.type.startsWith("video/")) {
    return "video";
  }

  const name = file.name || "";
  if (/\.(avif|bmp|gif|heic|heif|jpe?g|png|tiff?|webp)$/i.test(name)) {
    return "image";
  }
  if (/\.(m4v|mkv|mov|mp4|mpeg|mpg|webm)$/i.test(name)) {
    return "video";
  }
  return null;
}

function inferMimeType(file, kind) {
  if (file.type) {
    return file.type;
  }
  const extension = (file.name || "").split(".").pop()?.toLowerCase();
  const types = {
    avif: "image/avif",
    bmp: "image/bmp",
    gif: "image/gif",
    heic: "image/heic",
    heif: "image/heif",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    png: "image/png",
    tif: "image/tiff",
    tiff: "image/tiff",
    webp: "image/webp",
    m4v: "video/x-m4v",
    mkv: "video/x-matroska",
    mov: "video/quicktime",
    mp4: "video/mp4",
    mpeg: "video/mpeg",
    mpg: "video/mpeg",
    webm: "video/webm",
  };
  return (
    types[extension] || (kind === "video" ? "video/mp4" : "image/jpeg")
  );
}

function formatSize(size) {
  if (size < 1_024) {
    return `${size} B`;
  }
  if (size < 1_048_576) {
    return `${(size / 1_024).toFixed(1)} KB`;
  }
  if (size < 1_073_741_824) {
    return `${(size / 1_048_576).toFixed(1)} MB`;
  }
  return `${(size / 1_073_741_824).toFixed(2)} GB`;
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

export function formatDuration(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(value / 3_600);
  const minutes = Math.floor((value % 3_600) / 60);
  const remainder = value % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(
        remainder
      ).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(
        2,
        "0"
      )}`;
}

export function findThumbnailRecord(records, trashItems, mediaId) {
  return (
    (records || []).find((item) => item.id === mediaId) ||
    (trashItems || []).find(
      (item) => item.id === mediaId && item.trashType === "media"
    ) ||
    null
  );
}

async function mapWithConcurrency(items, limit, mapper) {
  const output = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      output[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );
  return output;
}

function waitForController(timeoutMs = 2_000) {
  if (navigator.serviceWorker.controller) {
    return Promise.resolve(navigator.serviceWorker.controller);
  }
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onChange
      );
      resolve(navigator.serviceWorker.controller);
    }, timeoutMs);
    const onChange = () => {
      window.clearTimeout(timer);
      resolve(navigator.serviceWorker.controller);
    };
    navigator.serviceWorker.addEventListener("controllerchange", onChange, {
      once: true,
    });
  });
}

export const PANEL_MARKUP = `
  <section id="v-album" class="view album-app" aria-label="相册">
    <header class="nav" id="a-nav">
      <div class="nav-row" id="a-nav-row">
        <button id="folder-back" class="back" type="button" data-panel-action="folder-back" aria-label="返回文件夹" hidden>${ic("chevl")}</button>
        <div class="nav-title">
          <b id="page-title">首页</b>
          <small id="media-count">0 项</small>
        </div>
        <button id="select-all-button" class="txtbtn" type="button" data-panel-action="select-all" hidden>全选</button>
        <button id="search-button" class="ibtn" type="button" data-panel-action="search" aria-label="搜索" aria-pressed="false">${ic("search")}</button>
        <button id="select-button" class="ibtn" type="button" data-panel-action="select" aria-label="多选" aria-pressed="false">${ic("checks")}</button>
        <button id="empty-trash-button" class="ibtn danger" type="button" data-panel-action="empty-trash" aria-label="清空回收站" hidden>${ic("brush")}</button>
        <button id="rename-folder-button" class="ibtn" type="button" data-panel-action="rename-folder" aria-label="重命名文件夹" hidden>${ic("pen")}</button>
        <button id="lock-button" class="ibtn" type="button" data-panel-action="lock" aria-label="锁定">${ic("lock")}</button>
      </div>
      <div id="search-box" class="sbox"><div><div class="search-wrap">
        <label class="field" for="content-search">
          ${ic("search")}
          <input id="content-search" type="search" placeholder="搜索" autocomplete="off" spellcheck="false">
          <button id="clear-search-button" class="clr" type="button" data-panel-action="clear-search" aria-label="清除搜索"><span>${ic("x")}</span></button>
        </label>
        <nav id="content-filters" class="seg" aria-label="内容类型"></nav>
      </div></div></div>
    </header>

    <main id="a-body" class="scroll" aria-live="polite">
      <section id="home-page" class="album-page">
        <div id="migration-progress" class="progress-card" hidden>
          <div class="progress-copy">
            <span id="migration-label">正在整理旧数据…</span>
            <span id="migration-percent">0%</span>
          </div>
          <progress id="migration-bar" max="100" value="0">0%</progress>
          <p class="progress-note">可随时离开，下次解锁后会继续。</p>
        </div>
        <div id="import-progress" class="progress-card" hidden>
          <div class="progress-copy">
            <span id="import-label">正在加密导入…</span>
            <span id="import-percent">0%</span>
          </div>
          <progress id="import-bar" max="100" value="0">0%</progress>
          <p class="progress-note">请勿离开此页面。写入中的分块会在中断时清理。</p>
        </div>
        <div id="export-progress" class="progress-card" hidden>
          <div class="progress-copy">
            <span id="export-label">正在准备导出…</span>
            <span id="export-percent">0%</span>
            <button id="export-cancel" class="inline-cancel" type="button">取消</button>
            <button id="export-share-button" class="inline-cancel inline-share" type="button" hidden>打开分享面板</button>
          </div>
          <progress id="export-bar" max="100" value="0">0%</progress>
          <p class="progress-note">正在逐块解密并准备文件，可随时取消。</p>
        </div>

        <section id="folder-section" class="home-folders" aria-label="文件夹">
          <div class="sec">
            <h3>文件夹</h3>
            <button id="all-folders-button" type="button" data-tab-target="folders">全部 ${ic("chev")}</button>
          </div>
          <div id="folder-grid" class="folders"></div>
        </section>

        <section id="library-section" aria-label="最近内容">
          <div class="sec">
            <h3 id="library-heading">最近</h3>
            <span id="folder-count" class="sec-count" hidden>0 个</span>
          </div>
          <div id="media-grid" class="grid"></div>
          <div id="load-status" class="load-status" hidden>加载中…</div>
          <div id="empty-state" class="empty-note" hidden>
            <h2>这里还是空的</h2>
            <p>新建文本或导入照片、视频后，内容会加密保存在此设备中。</p>
          </div>
        </section>
      </section>

      <section id="folders-page" class="album-page" aria-label="文件夹" hidden>
        <div class="page folders-page">
          <div id="folder-grid-page" class="fgrid"></div>
          <div id="folders-empty" class="empty-state" hidden>${ic("folder")}<p>还没有文件夹</p></div>
        </div>
      </section>

      <section id="trash-panel" class="album-page" aria-label="回收站" hidden>
        <div class="page">
          <p id="trash-summary" class="gf">0 项</p>
          <div id="trash-list" class="group"></div>
          <div id="trash-empty" class="empty-state" hidden>${ic("trash")}<p>回收站为空</p></div>
          <p class="gf">项目将在剩余天数后被永久删除</p>
        </div>
      </section>

      <section id="settings-panel" class="album-page" aria-label="设置" hidden></section>
    </main>

    <div id="a-sel" class="selbar" hidden>
      <span class="sc">已选 <b id="selected-count">0</b> 项</span>
      <div class="sacts">
        <button class="sbtn" type="button" data-selection-action="move" hidden>${ic("move")}<span>移动</span></button>
        <button class="sbtn" type="button" data-selection-action="rename" hidden>${ic("pen")}<span>重命名</span></button>
        <button class="sbtn" type="button" data-selection-action="export" hidden>${ic("share")}<span>导出</span></button>
        <button class="sbtn" type="button" data-selection-action="restore" hidden>${ic("restore")}<span>恢复</span></button>
        <button class="sbtn danger" type="button" data-selection-action="delete" hidden>${ic("trash")}<span>删除</span></button>
      </div>
    </div>

    <div id="a-overlay"></div>
    <nav class="tabbar" id="a-bar">
      <button class="tab on" type="button" data-tab="home">${ic("house")}<span>首页</span></button>
      <button class="tab" type="button" data-tab="folders">${ic("folder")}<span>文件夹</span></button>
      <button id="plus-button" class="tab" type="button" data-panel-action="plus" aria-label="添加" aria-expanded="false"><span class="fab">${ic("plus")}</span></button>
      <button id="trash-button" class="tab" type="button" data-tab="trash" data-panel-action="trash">${ic("trash")}<span>回收站</span><span id="trash-count" class="badge" hidden>0</span></button>
      <button class="tab" type="button" data-tab="settings">${ic("gear")}<span>设置</span></button>
    </nav>
  </section>

  <input id="media-input" type="file" accept="image/*,video/*" multiple hidden>
  <section id="media-viewer" class="viewer" role="dialog" aria-modal="true" aria-labelledby="viewer-title" hidden>
    <div class="vbar">
      <button class="vbtn" type="button" data-viewer-action="close">${ic("chevl")}返回</button>
      <b id="viewer-title"></b>
      <button class="vbtn" type="button" data-viewer-action="rename">${ic("pen")}重命名</button>
    </div>
    <div class="viewer-body">
      <button class="viewer-nav viewer-nav-previous" type="button" data-viewer-action="previous" aria-label="上一张">${ic("chevl")}</button>
      <div id="viewer-stage" class="viewer-stage"></div>
      <button class="viewer-nav viewer-nav-next" type="button" data-viewer-action="next" aria-label="下一张">${ic("chev")}</button>
    </div>
  </section>

  <section id="document-panel" class="view document-panel" role="dialog" aria-modal="true" aria-labelledby="document-title-heading" hidden>
    <header class="nav">
      <div class="nav-row three">
        <button class="back" type="button" data-text-action="back" aria-label="返回内容列表">${ic("chevl")}返回</button>
        <div class="mid" id="document-title-heading"></div>
        <button id="text-mode-button" class="txtbtn r" type="button" data-text-action="toggle-mode">编辑</button>
      </div>
    </header>
    <main id="document-scroll" class="scroll notab notepage">
      <article class="note">
        <div id="note-meta" class="note-meta"></div>
        <div id="document-title" class="note-title" data-ph="标题" role="textbox" aria-label="文档标题"></div>
        <div id="document-body" class="note-body" data-ph="开始书写…"></div>
        <span id="document-save-status" class="sr-only" role="status" aria-live="polite">自动保存</span>
      </article>
    </main>
    <div id="doc-format-overlay" class="doc-format-overlay" hidden>
      <div id="doc-format-sheet" class="fsheet" role="dialog" aria-label="格式">
        <div class="fs-head"><b>格式</b><button type="button" class="fs-x" data-text-action="format" aria-label="关闭格式面板">${ic("x")}</button></div>
        <div class="fs-chips">
          <button type="button" class="t1" data-doc-command="heading-2" aria-label="标题">标题</button>
          <button type="button" class="t2" data-doc-command="heading-3" aria-label="小标题">小标题</button>
          <button type="button" data-doc-command="paragraph" aria-label="正文">正文</button>
          <button type="button" class="mono" data-doc-command="code-block" aria-label="等宽">等宽</button>
        </div>
        <div class="fs-row">
          <div class="fs-grp">
            <button type="button" class="fb" data-doc-command="bold" aria-label="粗体">B</button>
            <button type="button" class="fi" data-doc-command="italic" aria-label="斜体">I</button>
            <button type="button" class="fu" data-doc-command="underline" aria-label="下划线">U</button>
            <button type="button" class="fx" data-doc-command="strike" aria-label="删除线">S</button>
          </div>
          <div class="fs-grp">
            <button type="button" data-doc-command="bullet-list" aria-label="项目符号">${ic("list")}</button>
            <button type="button" data-doc-command="ordered-list" aria-label="编号">${ic("olist")}</button>
            <button type="button" data-doc-command="task-list" aria-label="清单">${ic("checks")}</button>
            <button type="button" data-doc-command="indent" aria-label="缩进">${ic("indent")}</button>
          </div>
        </div>
        <div class="fs-size"><span>字号</span><div class="stepper"><button type="button" data-font-delta="-1" aria-label="减小字号">${ic("minus")}</button><output id="fs-size">17</output><button type="button" data-font-delta="1" aria-label="增大字号">${ic("plus")}</button></div></div>
        <div class="swatches">
          <button type="button" class="sw sw-default" data-text-color="default" aria-label="默认文字颜色"></button>
          <button type="button" class="sw sw-grey" data-text-color="grey" aria-label="灰色文字"></button>
          <button type="button" class="sw sw-red" data-text-color="red" aria-label="红色文字"></button>
          <button type="button" class="sw sw-orange" data-text-color="orange" aria-label="橙色文字"></button>
          <button type="button" class="sw sw-green" data-text-color="green" aria-label="绿色文字"></button>
          <button type="button" class="sw sw-blue" data-text-color="blue" aria-label="蓝色文字"></button>
        </div>
      </div>
    </div>
    <div id="doc-toolbar" class="etb" hidden>
      <button type="button" class="ibtn" data-text-action="format" data-format-toggle="sheet" aria-label="文本样式" aria-expanded="false" aria-pressed="false">${ic("aa")}</button>
      <button type="button" class="ibtn" data-text-action="task-list" aria-label="清单" aria-pressed="false">${ic("checks")}</button>
      <button type="button" class="ibtn" data-text-action="bullet-list" aria-label="列表" aria-pressed="false">${ic("list")}</button>
      <button type="button" class="ibtn" data-text-action="format" data-format-toggle="color" aria-label="颜色" aria-expanded="false" aria-pressed="false">${ic("palette")}</button>
      <button type="button" class="ibtn" data-text-action="undo" aria-label="撤销">${ic("undo")}</button>
      <button type="button" class="ibtn" data-text-action="redo" aria-label="重做">${ic("redo")}</button>
      <button type="button" class="txtbtn" data-text-action="done">完成</button>
    </div>
  </section>
`;

export class Panel {
  constructor({
    host,
    cryptoManager,
    database,
    auth,
    legacyKey,
    appVersion,
    onLock,
    onAuthUpdated,
    onDestructUpdated,
    onAlbumThemeChanged,
  }) {
    this.host = host;
    this.crypto = cryptoManager;
    this.db = database;
    this.auth = auth;
    this.legacyKey = legacyKey;
    this.appVersion = appVersion;
    this.onLock = onLock;
    this.onAuthUpdated = onAuthUpdated;
    this.onDestructUpdated = onDestructUpdated;
    this.onAlbumThemeChanged = onAlbumThemeChanged;

    this.root = null;
    this.records = [];
    this.searchIndex = new Map();
    this.folders = [];
    this.trashItems = [];
    this.selectedTrashIds = new Set();
    this.preferences = {
      showNames: true,
      trashRetentionDays: 30,
      albumTheme: "night",
    };
    this.preferencesUnavailable = false;
    this.calcThemePreference = readCalcThemePreference();
    this.searchQuery = "";
    this.contentFilter = "all";
    this.searchTimer = 0;
    this.searchOpen = false;
    this.currentFolderId = null;
    this.activeTab = "home";
    this.folderOriginTab = null;
    this.selectionMode = false;
    this.selectedIds = new Set();
    this.selectAll = false;
    this.folderIdFilter = new Set();
    this.renderedRecordCount = 0;
    this.loadingBatch = false;
    this.gridGeneration = 0;
    this.thumbnailCache = new ThumbnailCache({
      maxEntries: THUMBNAIL_CACHE_MAX_ENTRIES,
      maxBytes: THUMBNAIL_CACHE_MAX_BYTES,
      onEvict: (url, id) => this.handleThumbnailEviction(url, id),
    });
    this.thumbnailQueue = [];
    this.thumbnailQueued = new Set();
    this.thumbnailLoading = new Set();
    this.thumbnailFailed = new Set();
    this.trashThumbnailIds = new Set();
    this.thumbnailWorkers = 0;
    this.viewerRecord = null;
    this.viewerBlob = null;
    this.viewerOriginalUrl = "";
    this.viewerTouchStart = null;
    this.viewerGesture = null;
    this.viewerScale = 1;
    this.viewerTranslate = { x: 0, y: 0 };
    this.viewerLastTap = 0;
    this.viewerSuppressDoubleClickUntil = 0;
    this.viewerControlsVisible = true;
    this.viewerSwipeConsumed = false;
    this.streamMediaId = null;
    this.streamPlaybackTime = 0;
    this.streamWasPlaying = false;
    this.streamRecoveryAttempts = 0;
    this.streamRecovering = false;
    this.streamGeneration = 0;
    this.exportUrls = new Set();
    this.downloadFrames = new Set();
    this.exportJob = null;
    this.exportBusy = false;
    this.pendingShare = null;
    this.thumbnailBackfillRunning = false;
    this.thumbnailBackfillAttempted = new Set();
    this.currentImportId = null;
    this.migrationStarted = false;
    this.longPress = new LongPressController({
      delay: LONG_PRESS_MS,
      onTrigger: (key) => this.handleLongPress(key),
    });
    this.flipSnapshot = null;
    this.textDraft = null;
    this.textSaveTimer = 0;
    this.textSavePromise = Promise.resolve();
    this.documentEditor = null;
    this.documentMode = "view";
    this.documentSheetOpen = false;
    this.documentFocusTimer = 0;
    this.plyrPlayer = null;
    this.videoSeekAbortController = null;
    this.destructRecord = null;
    this.toastController = null;
    this.destroyed = false;
    this.plusOpen = false;
    this.plusCloseTimer = 0;
    this.settingsSubpage = null;
    this.handleDocumentViewportChange = () => {
      this.syncDocumentViewport();
    };
    this.handleGlobalKey = (event) => {
      if (event.key !== "Escape" || this.destroyed) {
        return;
      }
      if (!this.elements.viewer.hidden) {
        this.closeViewer();
      } else if (!this.elements.documentPanel.hidden) {
        void this.closeTextEditor();
      } else if (this.plusOpen) {
        this.closePlusMenu();
      }
    };
  }

  async mount() {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = PANEL_MARKUP;
    this.root = wrapper;
    this.host.replaceChildren(wrapper);
    this.captureElements();
    this.bindEvents();
    this.bindServiceWorkerEvents();
    this.setupThumbnailObserver();
    window.addEventListener("keydown", this.handleGlobalKey);

    this.renderGrid();
    await this.refreshRecords();
    void this.requestPersistentStorage();
    void this.startLegacyMigration();
  }

  captureElements() {
    const byId = (id) => this.root.querySelector(`#${id}`);
    this.elements = {
      album: byId("v-album"),
      navRow: byId("a-nav-row"),
      body: byId("a-body"),
      tabBar: byId("a-bar"),
      homePage: byId("home-page"),
      foldersPage: byId("folders-page"),
      settings: byId("settings-panel"),
      trash: byId("trash-panel"),
      pageTitle: byId("page-title"),
      searchButton: byId("search-button"),
      searchBox: byId("search-box"),
      selectButton: byId("select-button"),
      emptyTrashButton: byId("empty-trash-button"),
      renameFolderButton: byId("rename-folder-button"),
      lockButton: byId("lock-button"),
      plusButton: byId("plus-button"),
      mediaInput: byId("media-input"),
      mediaCount: byId("media-count"),
      trashButton: byId("trash-button"),
      trashCount: byId("trash-count"),
      contentSearch: byId("content-search"),
      clearSearchButton: byId("clear-search-button"),
      contentFilters: byId("content-filters"),
      folderBack: byId("folder-back"),
      folderSection: byId("folder-section"),
      folderGrid: byId("folder-grid"),
      folderGridPage: byId("folder-grid-page"),
      foldersEmpty: byId("folders-empty"),
      folderCount: byId("folder-count"),
      librarySection: byId("library-section"),
      libraryHeading: byId("library-heading"),
      mediaGrid: byId("media-grid"),
      loadStatus: byId("load-status"),
      emptyState: byId("empty-state"),
      importProgress: byId("import-progress"),
      importLabel: byId("import-label"),
      importPercent: byId("import-percent"),
      importBar: byId("import-bar"),
      exportProgress: byId("export-progress"),
      exportLabel: byId("export-label"),
      exportPercent: byId("export-percent"),
      exportBar: byId("export-bar"),
      exportCancel: byId("export-cancel"),
      exportShareButton: byId("export-share-button"),
      migrationProgress: byId("migration-progress"),
      migrationLabel: byId("migration-label"),
      migrationPercent: byId("migration-percent"),
      migrationBar: byId("migration-bar"),
      viewer: byId("media-viewer"),
      viewerTitle: byId("viewer-title"),
      viewerStage: byId("viewer-stage"),
      viewerPrevious: this.root.querySelector(
        '[data-viewer-action="previous"]'
      ),
      viewerNext: this.root.querySelector('[data-viewer-action="next"]'),
      viewerBack: this.root.querySelector('[data-viewer-action="close"]'),
      viewerRename: this.root.querySelector(
        '[data-viewer-action="rename"]'
      ),
      selectionActions: byId("a-sel"),
      selectAllButton: byId("select-all-button"),
      selectedCount: byId("selected-count"),
      trashSummary: byId("trash-summary"),
      trashList: byId("trash-list"),
      trashEmpty: byId("trash-empty"),
      overlay: byId("a-overlay"),
      documentPanel: byId("document-panel"),
      documentScroll: byId("document-scroll"),
      documentToolbar: byId("doc-toolbar"),
      documentFormatOverlay: byId("doc-format-overlay"),
      documentFormatSheet: byId("doc-format-sheet"),
      documentModeButton: byId("text-mode-button"),
      noteMeta: byId("note-meta"),
      documentTitle: byId("document-title"),
      documentBody: byId("document-body"),
      documentSaveStatus: byId("document-save-status"),
    };
  }

  captureSettingsElements() {
    const fromSettings = (id) =>
      this.elements.settings?.querySelector(`#${id}`) || null;
    Object.assign(this.elements, {
      settingsForm: fromSettings("settings-form"),
      settingsError: fromSettings("settings-error"),
      appVersion: fromSettings("app-version"),
      oldPin: fromSettings("old-pin"),
      newPin: fromSettings("new-pin"),
      newPinConfirm: fromSettings("new-pin-confirm"),
      changePinButton: fromSettings("change-pin-button"),
      trashRetention: fromSettings("trash-retention"),
      destructCurrentPin: fromSettings("destruct-current-pin"),
      destructCode: fromSettings("destruct-code"),
      destructConfirm: fromSettings("destruct-confirm"),
      destructStatus: fromSettings("destruct-status"),
      destructError: fromSettings("destruct-error"),
      saveDestructButton: fromSettings("save-destruct-button"),
      removeDestructButton: fromSettings("remove-destruct-button"),
      wipeButton: fromSettings("wipe-button"),
      showNamesToggle: fromSettings("show-names-toggle"),
    });
  }

  bindEvents() {
    if (!this.longPress) {
      this.longPress = new LongPressController({
        delay: LONG_PRESS_MS,
        onTrigger: (key) => this.handleLongPress(key),
      });
    }
    this.root.addEventListener("click", (event) => {
      if (this.longPress.shouldSuppressClick()) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      const tabButton = event.target.closest("[data-tab]");
      if (tabButton) {
        this.switchTab(tabButton.dataset.tab);
        return;
      }

      const tabTarget = event.target.closest("[data-tab-target]");
      if (tabTarget) {
        this.switchTab(tabTarget.dataset.tabTarget);
        return;
      }

      const settingsAction = event.target.closest(
        "[data-settings-action]"
      );
      if (settingsAction) {
        this.handleSettingsAction(settingsAction);
        return;
      }

      const plusAction = event.target.closest("[data-plus-action]");
      if (plusAction) {
        this.handlePlusAction(plusAction.dataset.plusAction);
        return;
      }

      const actionButton = event.target.closest("[data-panel-action]");
      if (actionButton) {
        const action = actionButton.dataset.panelAction;
        if (action === "lock") {
          this.onLock();
        } else if (action === "trash") {
          this.openTrash();
        } else if (action === "select") {
          this.toggleSelectionMode();
        } else if (action === "select-all") {
          this.toggleSelectAll();
        } else if (action === "search") {
          this.toggleSearch();
        } else if (action === "clear-search") {
          this.clearSearch();
        } else if (action === "empty-trash") {
          void this.emptyTrash();
        } else if (action === "folder-back") {
          this.openFolder(null);
        } else if (action === "settings-back") {
          this.settingsSubpage = null;
          this.renderSettingsView();
          this.elements.body.scrollTop = 0;
        } else if (action === "rename-folder") {
          const folder = this.folders.find(
            (item) => item.id === this.currentFolderId
          );
          if (folder) {
            void this.renameFolder(folder);
          }
        } else if (action === "plus") {
          this.togglePlusMenu();
        }
        return;
      }

      const trashInline = event.target.closest("[data-trash-inline]");
      if (trashInline) {
        if (this.longPress.shouldSuppressClick()) {
          return;
        }
        const id = trashInline.dataset.trashId;
        if (trashInline.dataset.trashInline === "restore") {
          void this.restoreTrashItem(id);
        } else if (trashInline.dataset.trashInline === "purge") {
          void this.purgeTrashItem(id);
        }
        return;
      }

      const trashRow = event.target.closest(".trow[data-trash-id]");
      if (trashRow) {
        if (this.selectionMode) {
          this.toggleTrashSelection(trashRow.dataset.trashId);
        }
        return;
      }

      const filterButton = event.target.closest("[data-content-filter]");
      if (filterButton) {
        this.setContentFilter(filterButton.dataset.contentFilter);
        return;
      }

      const viewerButton = event.target.closest("[data-viewer-action]");
      if (viewerButton) {
        const action = viewerButton.dataset.viewerAction;
        if (action === "close") {
          this.closeViewer();
        } else if (action === "previous") {
          void this.switchViewer(-1);
        } else if (action === "next") {
          void this.switchViewer(1);
        } else if (action === "rename") {
          void this.renameViewerRecord();
        }
        return;
      }

      const textButton = event.target.closest("[data-text-action]");
      if (textButton) {
        this.handleDocumentAction(textButton.dataset.textAction);
        return;
      }

      const documentCommand = event.target.closest("[data-doc-command]");
      if (documentCommand) {
        this.executeDocumentCommand(documentCommand.dataset.docCommand);
        return;
      }

      const fontStep = event.target.closest("[data-font-delta]");
      if (fontStep) {
        this.stepDocumentFont(Number(fontStep.dataset.fontDelta));
        return;
      }

      const textColor = event.target.closest("[data-text-color]");
      if (textColor) {
        this.setDocumentColor(textColor.dataset.textColor);
        return;
      }

      const folderButton = event.target.closest("[data-folder-action]");
      if (folderButton) {
        const folder = this.folders.find(
          (item) => item.id === folderButton.dataset.folderId
        );
        if (!folder) {
          return;
        }
        if (
          this.selectionMode &&
          this.activeTab === "folders" &&
          folderButton.dataset.folderAction === "open"
        ) {
          this.toggleFolderSelection(folder.id);
          return;
        }
        if (
          this.selectionMode &&
          folderButton.dataset.folderAction === "open"
        ) {
          return;
        }
        if (folderButton.dataset.folderAction === "open") {
          this.openFolder(folder.id);
        } else if (folderButton.dataset.folderAction === "rename") {
          void this.renameFolder(folder);
        } else if (folderButton.dataset.folderAction === "delete") {
          void this.deleteFolder(folder);
        }
        return;
      }

      const selectionButton = event.target.closest("[data-selection-action]");
      if (selectionButton) {
        const action = selectionButton.dataset.selectionAction;
        if (action === "export") {
          void this.exportSelected();
        } else if (action === "rename") {
          void this.renameSelected();
        } else if (action === "move") {
          void this.moveSelected();
        } else if (action === "delete") {
          void this.deleteSelected();
        } else if (action === "restore") {
          void this.restoreSelectedTrash();
        }
        return;
      }

      const mediaButton = event.target.closest(".cell[data-media-id]");
      if (mediaButton) {
        const record = this.records.find(
          (item) => item.id === mediaButton.dataset.mediaId
        );
        if (record) {
          if (this.longPress.shouldSuppressClick()) {
            return;
          }
          if (this.selectionMode) {
            this.toggleRecordSelection(record.id);
          } else if (record.kind === "text") {
            void this.openTextEditor(record);
          } else {
            void this.openViewer(record);
          }
        }
      }

      if (event.target.closest("[data-plus-close]")) {
        this.closePlusMenu();
      }
    });

    this.elements.mediaInput.addEventListener("change", () => {
      endSystemPanel();
      const files = Array.from(this.elements.mediaInput.files || []);
      this.elements.mediaInput.value = "";
      if (files.length > 0) {
        void this.importFiles(files);
      }
    });
    this.elements.mediaInput.addEventListener("cancel", () => {
      endSystemPanel();
      this.elements.mediaInput.value = "";
    });
    this.elements.contentSearch.addEventListener("input", () => {
      this.elements.clearSearchButton.classList.toggle(
        "show",
        this.elements.contentSearch.value.length > 0
      );
      window.clearTimeout(this.searchTimer);
      this.searchTimer = window.setTimeout(() => {
        this.searchQuery = this.elements.contentSearch.value
          .trim()
          .toLocaleLowerCase("zh-CN");
        this.refreshCurrentView({ resetPaging: true });
      }, SEARCH_DEBOUNCE_MS);
    });
    this.root.addEventListener("change", (event) => {
      if (event.target.id === "show-names-toggle") {
        void this.updatePreferences({
          showNames: event.target.checked,
        });
      }
    });
    this.root.addEventListener("submit", (event) => {
      if (event.target.id !== "settings-form") {
        return;
      }
      event.preventDefault();
      void this.changeCode();
    });

    this.bindViewerGestures();
    this.root.addEventListener("pointerdown", (event) => {
      const item = event.target.closest(
        ".cell[data-media-id],.fcard[data-folder-id],.trow[data-trash-id]"
      );
      if (!item || this.selectionMode || event.button > 0) {
        return;
      }
      const key = this.longPressKeyForElement(item);
      if (key) {
        this.longPress.begin({
          key,
          x: event.clientX,
          y: event.clientY,
        });
      }
    });
    this.root.addEventListener("pointermove", (event) => {
      this.longPress.move(event.clientX, event.clientY);
    });
    this.root.addEventListener("pointerup", () => {
      this.longPress.end();
    });
    this.root.addEventListener("pointercancel", () => {
      this.longPress.end();
    });
    this.root.addEventListener("pointerleave", () => {
      this.longPress.end();
    });
    this.elements.body.addEventListener(
      "scroll",
      () => this.longPress.cancel(),
      { passive: true }
    );
    this.root.addEventListener("contextmenu", (event) => {
      if (event.target.closest(".cell,.fcard,.trow")) {
        event.preventDefault();
      }
    });

    this.elements.documentTitle.addEventListener("input", () => {
      this.handleDocumentTitleInput();
    });
    this.elements.documentBody.addEventListener("change", (event) => {
      this.handleReadOnlyTaskChange(event);
    });
    for (const container of [
      this.elements.documentToolbar,
      this.elements.documentFormatSheet,
    ]) {
      container?.addEventListener("pointerdown", (event) => {
        if (event.target.closest("button")) {
          event.preventDefault();
        }
      });
    }
    this.elements.documentTitle.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        this.documentEditor?.commands.focus();
      }
    });
    this.elements.exportCancel.addEventListener("click", () => {
      this.cancelExport();
    });
    this.elements.exportShareButton.addEventListener("click", () => {
      void this.sharePreparedExport();
    });
  }

  bindServiceWorkerEvents() {
    if (!("serviceWorker" in navigator)) {
      return;
    }
    this.handleServiceWorkerMessage = (event) => {
      const message = event.data;
      const port = event.ports?.[0];
      if (message?.type !== "media-registration-required" || !port) {
        return;
      }
      const record = this.viewerRecord;
      const payload = this.makeMediaRegistration(record);
      port.postMessage(
        payload && payload.mediaId === message.mediaId
          ? payload
          : { mediaId: message.mediaId, error: "内容暂不可用" }
      );
    };
    this.handleControllerChange = () => {
      const record = this.viewerRecord;
      if (
        this.destroyed ||
        record?.kind !== "video" ||
        record.legacy ||
        !this.streamMediaId
      ) {
        return;
      }
      const controller = navigator.serviceWorker.controller;
      const registration = this.makeMediaRegistration(record);
      if (controller && registration) {
        void this.sendWorkerMessage(controller, registration).catch(() => {});
      }
    };
    navigator.serviceWorker.addEventListener(
      "message",
      this.handleServiceWorkerMessage
    );
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      this.handleControllerChange
    );
  }

  setupThumbnailObserver() {
    this.thumbnailObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const image = entry.target;
          const mediaId = image.dataset.mediaId;
          if (!mediaId) {
            continue;
          }
          if (entry.isIntersecting) {
            const record = findThumbnailRecord(
              this.records,
              this.trashItems,
              mediaId
            );
            if (record) {
              if (record.trashType === "media") {
                this.trashThumbnailIds.add(record.id);
              }
              this.scheduleThumbnail(record, image);
            }
          }
        }
      },
      {
        root: this.elements.body,
        rootMargin: "600px 0px",
      }
    );
    this.loadObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          this.appendNextBatch();
        }
      },
      {
        root: this.elements.body,
        rootMargin: "0px 0px 600px 0px",
      }
    );
    this.loadObserver.observe(this.elements.loadStatus);
  }

  async refreshRecords() {
    if (this.destroyed) {
      return;
    }
    this.thumbnailFailed.clear();
    try {
      const preferenceState = await loadPreferences({
        crypto: this.crypto,
        key: this.crypto.masterKey,
        db: this.db,
      });
      this.preferences = preferenceState.preferences;
      this.preferencesUnavailable =
        preferenceState.status === "failed";
      const { trashItems } = await syncTrashOnUnlock({
        crypto: this.crypto,
        key: this.crypto.masterKey,
        db: this.db,
        preferencesStatus: preferenceState.status,
        retentionDays: this.preferences.trashRetentionDays,
      });
      const [
        envelopes,
        legacySummaries,
        textEnvelopes,
        folderEnvelopes,
        destructRecord,
      ] = await Promise.all([
        this.db.getMetaEnvelopes(),
        this.db.getLegacySummaries(),
        this.db.getTextEnvelopes(),
        this.db.getFolderEnvelopes(),
        this.db.getSetting("destruct"),
      ]);
      const decrypted = (
        await mapWithConcurrency(envelopes, 4, async (envelope) => {
          try {
            const metadata = await decryptMetadata(
              this.crypto,
              this.crypto.masterKey,
              envelope
            );
            if (metadata.id !== envelope.id) {
              throw new Error("元数据标识不一致");
            }
            return { ...metadata, legacy: false };
          } catch (error) {
            console.error("元数据解密失败", error);
            return null;
          }
        })
      ).filter(Boolean);

      const decryptedIds = new Set(decrypted.map((record) => record.id));
      const legacyRecords = legacySummaries
        .filter((record) => !decryptedIds.has(record.id))
        .map((record) => ({
          ...record,
          legacy: true,
        }));
      const texts = (
        await mapWithConcurrency(textEnvelopes, 4, async (envelope) => {
          try {
            const text = await decryptText({
              crypto: this.crypto,
              key: this.crypto.masterKey,
              envelope,
            });
            return { ...text, legacy: false };
          } catch (error) {
            console.error("文本解密失败", error);
            return null;
          }
        })
      ).filter(Boolean);
      this.folders = (
        await mapWithConcurrency(folderEnvelopes, 4, async (envelope) => {
          try {
            return await decryptFolder({
              crypto: this.crypto,
              key: this.crypto.masterKey,
              envelope,
            });
          } catch (error) {
            console.error("文件夹解密失败", error);
            return null;
          }
        })
      )
        .filter(Boolean)
        .sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
      this.records = [...decrypted, ...texts, ...legacyRecords].sort(
        (left, right) => right.createdAt - left.createdAt
      );
      this.rebuildSearchIndex();
      this.destructRecord = destructRecord;
      this.trashItems = trashItems;
      if (
        this.currentFolderId &&
        !this.folders.some((folder) => folder.id === this.currentFolderId)
      ) {
        this.currentFolderId = null;
      }
      this.renderGrid();
      this.renderFolders();
      this.updatePreferenceControls();
      this.updateDestructControls();
      this.renderTrash();
      this.updateTrashBadge();
      this.updateShell();
      void this.startThumbnailBackfill();
    } catch (error) {
      console.error("读取本地内容失败", error);
      if (!this.destroyed) {
        this.showToast("部分内容读取失败，请稍后重试");
      }
    }
  }

  renderGrid({ preservePaging = true } = {}) {
    if (!this.root || this.destroyed) {
      return;
    }
    const previousRenderedCount = preservePaging
      ? this.renderedRecordCount
      : 0;
    const previousScrollTop = preservePaging
      ? this.elements.body.scrollTop
      : 0;
    this.gridGeneration += 1;
    this.loadingBatch = false;
    const generation = this.gridGeneration;
    const visibleRecords = this.visibleRecords();
    const visibleFolders = this.visibleFolders();
    const inFolder = this.currentFolderId !== null;
    const searchActive =
      this.searchQuery.length > 0 || this.contentFilter !== "all";
    const folderOnly = !inFolder && this.contentFilter === "folder";
    const foldersVisible =
      !inFolder &&
      (this.contentFilter === "all" ||
        this.contentFilter === "folder");
    this.elements.folderSection.hidden =
      !foldersVisible || visibleFolders.length === 0;
    this.elements.librarySection.hidden = false;
    this.elements.libraryHeading.parentElement.hidden =
      folderOnly || !searchActive;
    this.elements.libraryHeading.textContent = searchActive ? "文件" : "最近";
    this.elements.folderCount.hidden = true;
    this.elements.mediaCount.textContent = `${visibleRecords.length} 项`;
    const hideHomeEmpty =
      !inFolder &&
      visibleFolders.length > 0 &&
      visibleRecords.length === 0;
    this.elements.emptyState.hidden =
      folderOnly
        ? visibleFolders.length !== 0
        : visibleRecords.length !== 0 || hideHomeEmpty;
    const emptyTitle = this.elements.emptyState.querySelector("h2");
    const emptyCopy = this.elements.emptyState.querySelector("p");
    if (emptyTitle && emptyCopy) {
      emptyTitle.textContent = searchActive
        ? "没有匹配的内容"
        : "这里还是空的";
      emptyCopy.textContent = searchActive
        ? "换个关键词或内容类型试试。"
        : "新建文本或导入照片、视频后，内容会加密保存在此设备中。";
    }
    this.elements.mediaGrid.hidden =
      folderOnly || visibleRecords.length === 0;
    this.elements.mediaGrid.className = `grid${
      this.preferences.showNames || searchActive ? " names" : ""
    }`;
    for (const image of this.elements.mediaGrid.querySelectorAll("img")) {
      this.thumbnailObserver?.unobserve(image);
    }
    this.elements.mediaGrid.replaceChildren();
    this.renderedRecordCount = 0;

    const initialCount = renderBatchSize(
      visibleRecords.length,
      previousRenderedCount
    );
    if (initialCount > 0) {
      this.appendRecordRange(visibleRecords, 0, initialCount, generation);
      this.renderedRecordCount = initialCount;
    }
    this.updateLoadStatus(visibleRecords.length, false);
    this.updateSelectionUi();
    this.updateShell();
    this.elements.body.scrollTop = previousScrollTop;
  }

  createTile(record) {
    const selected = this.selectedIds.has(record.id);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `cell${selected ? " sel" : ""}`;
    button.dataset.mediaId = record.id;
    button.dataset.flip = `record:${record.id}`;
    button.setAttribute(
      "aria-label",
      this.selectionMode
        ? `选择 ${record.name || record.title || "文本"}`
        : `打开 ${record.name || record.title || "文本"}`
    );

    if (record.kind === "text") {
      const tile = document.createElement("div");
      tile.className = "tile doc";
      const title = document.createElement("div");
      title.className = "dt";
      this.setHighlightedText(
        title,
        record.title.trim() || "无标题"
      );
      tile.append(title);
      const preview = record.body.trim();
      const lineLengths = [92, 78, 86, 54];
      lineLengths.forEach((width, index) => {
        const line = document.createElement("div");
        line.className = `dl dl-${index + 1}`;
        if (!preview && index > 0) {
          line.hidden = true;
        }
        tile.append(line);
      });
      const icon = document.createElement("span");
      icon.className = "dic";
      icon.innerHTML = ic("filetext");
      tile.append(icon);
      if (this.selectionMode) {
        const mark = document.createElement("span");
        mark.className = "mark";
        mark.innerHTML = selected ? ic("tick") : "";
        tile.append(mark);
      }
      button.append(tile);
    } else {
      const tile = document.createElement("div");
      tile.className = `tile${record.kind === "video" ? " video" : ""}`;
      const image = document.createElement("img");
      image.className = "tile-thumb";
      image.dataset.mediaId = record.id;
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      image.draggable = false;
      tile.append(image);
      this.thumbnailObserver?.observe(image);

      if (record.kind === "video") {
        const badge = document.createElement("span");
        badge.className = "dur";
        badge.innerHTML =
          '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg>';
        const duration = document.createElement("span");
        duration.textContent = record.duration
          ? formatDuration(record.duration)
          : "视频";
        badge.append(duration);
        tile.append(badge);
      }
      if (this.selectionMode) {
        const mark = document.createElement("span");
        mark.className = "mark";
        mark.innerHTML = selected ? ic("tick") : "";
        tile.append(mark);
      }
      button.append(tile);
    }

    const name = document.createElement("div");
    name.className = "tname";
    this.setHighlightedText(
      name,
      record.name || record.title || "无标题"
    );
    button.append(name);
    return button;
  }

  setHighlightedText(element, text) {
    element.replaceChildren();
    for (const part of highlightParts(text, this.searchQuery)) {
      if (part.matched) {
        const mark = document.createElement("mark");
        mark.className = "hl";
        mark.textContent = part.text;
        element.append(mark);
      } else {
        element.append(document.createTextNode(part.text));
      }
    }
  }

  appendRecordRange(records, start, count, generation) {
    if (generation !== this.gridGeneration || this.destroyed) {
      return;
    }
    const fragment = document.createDocumentFragment();
    const reduceMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    for (let index = start; index < start + count; index += 1) {
      const record = records[index];
      if (!record) {
        continue;
      }
      const cell = this.createTile(record);
      fragment.append(cell);
      if (!reduceMotion) {
        cell.animate(
          [
            { opacity: 0, transform: "scale(.85)" },
            { opacity: 1, transform: "none" },
          ],
          {
            duration: 220,
            easing: "cubic-bezier(.2,.8,.2,1)",
            delay: Math.min(index - start, 7) * 25,
            fill: "backwards",
          }
        );
      }
    }
    this.elements.mediaGrid.append(fragment);
  }

  updateLoadStatus(total, loading) {
    if (!this.elements?.loadStatus) {
      return;
    }
    if (total === 0) {
      this.elements.loadStatus.hidden = true;
      return;
    }
    this.elements.loadStatus.hidden = false;
    if (loading) {
      this.elements.loadStatus.textContent = "加载中…";
      this.elements.loadStatus.classList.remove("complete");
    } else if (this.renderedRecordCount < total) {
      this.elements.loadStatus.textContent = "加载中…";
      this.elements.loadStatus.classList.remove("complete");
    } else {
      this.elements.loadStatus.textContent = `共 ${total} 项`;
      this.elements.loadStatus.classList.add("complete");
    }
  }

  async appendNextBatch() {
    if (
      this.loadingBatch ||
      this.destroyed ||
      this.activeTab !== "home"
    ) {
      return;
    }
    const records = this.visibleRecords();
    const windowRange = nextBatchWindow(
      records.length,
      this.renderedRecordCount,
      INCREMENTAL_BATCH_SIZE
    );
    if (windowRange.count === 0) {
      this.updateLoadStatus(records.length, false);
      return;
    }
    this.loadingBatch = true;
    const generation = this.gridGeneration;
    this.updateLoadStatus(records.length, true);
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    if (generation !== this.gridGeneration || this.destroyed) {
      this.loadingBatch = false;
      return;
    }
    this.appendRecordRange(
      records,
      windowRange.start,
      windowRange.count,
      generation
    );
    this.renderedRecordCount = windowRange.loaded;
    this.loadingBatch = false;
    this.updateLoadStatus(records.length, false);
  }

  visibleRecords() {
    const searchActive =
      this.searchQuery.length > 0 || this.contentFilter !== "all";
    const folderId =
      this.currentFolderId !== null
        ? this.currentFolderId
        : searchActive
          ? undefined
          : null;
    return filterItems(
      this.records.map((record) => ({
        ...record,
        category: this.recordCategory(record),
        searchText: this.searchIndex.get(record.id) || "",
      })),
      {
        q: this.searchQuery,
        filter: this.contentFilter,
        folderId,
      }
    );
  }

  recordCategory(record) {
    if (
      record.kind === "text" ||
      String(record.mimeType || "").startsWith("text/") ||
      record.mimeType === "application/pdf"
    ) {
      return "document";
    }
    return record.kind === "image" ? "image" : "video";
  }

  rebuildSearchIndex() {
    this.searchIndex = new Map();
    for (const record of this.records) {
      this.searchIndex.set(record.id, recordSearchText(record));
    }
  }

  setContentFilter(filter) {
    if (
      !["all", "image", "video", "document", "folder"].includes(
        filter
      )
    ) {
      return;
    }
    this.contentFilter = filter;
    for (const button of this.elements.contentFilters.querySelectorAll(
      "[data-content-filter]"
    )) {
      const active = button.dataset.contentFilter === filter;
      button.classList.toggle("on", active);
      button.setAttribute("aria-pressed", String(active));
    }
    this.refreshCurrentView({ resetPaging: true });
  }

  renderFolders() {
    if (!this.root || this.destroyed) {
      return;
    }
    const counts = new Map(
      this.folders.map((folder) => [
        folder.id,
        this.records.filter((record) => record.folderId === folder.id).length,
      ])
    );
    const visibleFolders = this.folders.filter((folder) =>
      matchQuery(folder.name, this.searchQuery)
    );
    const homeFragment = document.createDocumentFragment();
    for (const folder of visibleFolders) {
      homeFragment.append(
        this.createFolderCard(folder, counts.get(folder.id) || 0)
      );
    }
    this.elements.folderGrid.replaceChildren(homeFragment);

    const sorted = [...visibleFolders].sort(
      (left, right) =>
        (Number(right.updatedAt) || 0) -
          (Number(left.updatedAt) || 0) ||
        left.name.localeCompare(right.name, "zh-CN")
    );
    const pageFragment = document.createDocumentFragment();
    for (const folder of sorted) {
      pageFragment.append(
        this.createFolderCard(folder, counts.get(folder.id) || 0)
      );
    }
    this.elements.folderGridPage.replaceChildren(pageFragment);
    this.elements.foldersEmpty.hidden = visibleFolders.length > 0;
    this.elements.folderCount.textContent = `${this.folders.length} 个`;
    this.updateSelectionUi();
  }

  createFolderCard(folder, count) {
    const card = document.createElement("button");
    card.type = "button";
    const selecting =
      this.selectionMode && this.activeTab === "folders";
    const selected = selecting && this.selectedIds.has(folder.id);
    card.className = `fcard${selected ? " sel" : ""}`;
    card.dataset.folderAction = "open";
    card.dataset.folderId = folder.id;
    card.dataset.flip = `folder:${folder.id}`;
    card.setAttribute(
      "aria-label",
      selecting ? `选择文件夹 ${folder.name}` : `打开文件夹 ${folder.name}`
    );
    const wrap = document.createElement("div");
    wrap.className = "fwrap";
    const cover = document.createElement("div");
    cover.className = "fcover";
    const items = pickFolderCoverItems(
      this.records,
      folder.id,
      FOLDER_COVER_LIMIT
    );
    if (items.length === 0) {
      cover.classList.add("empty");
      const empty = document.createElement("div");
      empty.innerHTML = ic("folder");
      cover.append(empty);
    } else {
      for (const record of items) {
        const image = document.createElement("img");
        image.className = "fcover-thumb";
        image.dataset.mediaId = record.id;
        image.alt = "";
        image.loading = "lazy";
        image.decoding = "async";
        image.draggable = false;
        cover.append(image);
        this.thumbnailObserver?.observe(image);
      }
      if (items.length === 2) {
        cover.classList.add("has-two");
      }
    }
    wrap.append(cover);
    if (selecting) {
      const mark = document.createElement("span");
      mark.className = "mark";
      mark.innerHTML = selected ? ic("tick") : "";
      wrap.append(mark);
    }
    const name = document.createElement("div");
    name.className = "fname";
    this.setHighlightedText(name, folder.name);
    const countLabel = document.createElement("div");
    countLabel.className = "fcount";
    countLabel.textContent = `${count} 项`;
    card.append(wrap, name, countLabel);
    return card;
  }

  openFolder(folderId) {
    if (
      folderId !== null &&
      !this.folders.some((folder) => folder.id === folderId)
    ) {
      return;
    }
    if (this.activeTab === "trash") {
      this.releaseTrashThumbnails();
    }
    if (folderId === null) {
      this.currentFolderId = null;
      this.activeTab = this.folderOriginTab || "home";
      this.folderOriginTab = null;
    } else {
      if (this.currentFolderId === null) {
        this.folderOriginTab = this.activeTab;
      }
      this.currentFolderId = folderId;
      this.activeTab = "home";
    }
    this.searchQuery = "";
    this.contentFilter = "all";
    this.searchOpen = false;
    this.elements.contentSearch.value = "";
    this.elements.clearSearchButton.classList.remove("show");
    this.closeSearch();
    this.selectionMode = false;
    this.selectedIds.clear();
    if (this.activeTab === "home") {
      this.renderGrid({ preservePaging: false });
      this.renderFolders();
    } else if (this.activeTab === "folders") {
      this.renderFolders();
    }
    this.updatePageVisibility();
    for (const button of this.elements.tabBar.querySelectorAll("[data-tab]")) {
      button.classList.toggle(
        "on",
        button.dataset.tab === this.activeTab
      );
    }
    this.updateShell();
    this.elements.body.scrollTop = 0;
  }

  refreshCurrentView({ resetPaging = false } = {}) {
    const snapshot = this.captureFlipSnapshot();
    if (this.activeTab === "folders") {
      this.renderFolders();
    } else if (this.activeTab === "trash") {
      this.renderTrash();
    } else if (this.activeTab === "home") {
      this.renderGrid({ preservePaging: !resetPaging });
      this.renderFolders();
    }
    this.playFlipSnapshot(snapshot);
  }

  captureFlipSnapshot() {
    if (
      !this.elements?.body ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return null;
    }
    const bodyRect = this.elements.body.getBoundingClientRect();
    const near = (rect) =>
      rect.bottom > bodyRect.top - 120 &&
      rect.top < bodyRect.bottom + 120;
    const items = new Map();
    for (const element of this.elements.body.querySelectorAll(
      ".cell[data-flip],.fcard[data-flip],.trow[data-flip]"
    )) {
      const rect = element.getBoundingClientRect();
      if (near(rect)) {
        items.set(element.dataset.flip, { element, rect });
      }
    }
    return { bodyRect, near, items };
  }

  playFlipSnapshot(snapshot) {
    if (!snapshot || this.destroyed) {
      return;
    }
    const current = new Map();
    for (const element of this.elements.body.querySelectorAll(
      ".cell[data-flip],.fcard[data-flip],.trow[data-flip]"
    )) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        continue;
      }
      current.set(element.dataset.flip, element);
    }
    const seen = new Set();
    for (const [key, element] of current) {
      const rect = element.getBoundingClientRect();
      const before = snapshot.items.get(key);
      if (!snapshot.near(rect) && !(before && snapshot.near(before.rect))) {
        continue;
      }
      if (before) {
        seen.add(key);
        const dx = before.rect.left - rect.left;
        const dy = before.rect.top - rect.top;
        if (dx || dy) {
          element.animate(
            [
              { transform: `translate(${dx}px, ${dy}px)` },
              { transform: "none" },
            ],
            {
              duration: 250,
              delay: 40,
              easing: "cubic-bezier(.2,.8,.2,1)",
              fill: "backwards",
            }
          );
        }
      } else {
        element.animate(
          [
            { opacity: 0, transform: "scale(.85)" },
            { opacity: 1, transform: "none" },
          ],
          {
            duration: 220,
            delay: 60,
            easing: "cubic-bezier(.2,.8,.2,1)",
            fill: "backwards",
          }
        );
      }
    }

    const bodyRect = this.elements.body.getBoundingClientRect();
    for (const [key, before] of snapshot.items) {
      if (seen.has(key) || !snapshot.near(before.rect)) {
        continue;
      }
      const ghost = before.element.cloneNode(true);
      ghost.classList.add("flip-ghost");
      for (const node of [ghost, ...ghost.querySelectorAll("[data-flip]")]) {
        node.removeAttribute("data-flip");
      }
      Object.assign(ghost.style, {
        position: "absolute",
        left: `${before.rect.left - bodyRect.left + this.elements.body.scrollLeft}px`,
        top: `${before.rect.top - bodyRect.top + this.elements.body.scrollTop}px`,
        width: `${before.rect.width}px`,
        height: `${before.rect.height}px`,
        margin: "0",
        pointerEvents: "none",
        zIndex: "-1",
      });
      this.elements.body.append(ghost);
      ghost
        .animate(
          [
            { opacity: 1, transform: "none" },
            { opacity: 0, transform: "scale(.85)" },
          ],
          {
            duration: 180,
            easing: "ease-in",
            fill: "forwards",
          }
        )
        .addEventListener("finish", () => ghost.remove(), { once: true });
    }
  }

  updatePageVisibility() {
    if (!this.elements?.homePage) {
      return;
    }
    const inFolder = this.currentFolderId !== null;
    this.elements.homePage.hidden = this.activeTab !== "home";
    this.elements.foldersPage.hidden = this.activeTab !== "folders";
    this.elements.trash.hidden = this.activeTab !== "trash";
    this.elements.settings.hidden = this.activeTab !== "settings";
    this.elements.tabBar.hidden = inFolder;
    this.elements.folderBack.hidden =
      !(inFolder || this.settingsSubpage);
    this.elements.folderSection.hidden =
      inFolder ||
      this.contentFilter === "image" ||
      this.contentFilter === "video" ||
      this.contentFilter === "document" ||
      this.visibleFolders().length === 0;
  }

  switchTab(tab) {
    if (!["home", "folders", "trash", "settings"].includes(tab)) {
      return;
    }
    this.closePlusMenu(true);
    if (this.activeTab === "trash" && tab !== "trash") {
      this.releaseTrashThumbnails();
    }
    this.currentFolderId = null;
    this.activeTab = tab;
    this.folderOriginTab = null;
    this.settingsSubpage = null;
    this.searchQuery = "";
    this.contentFilter = "all";
    this.searchOpen = false;
    this.elements.contentSearch.value = "";
    this.elements.clearSearchButton.classList.remove("show");
    this.closeSearch();
    this.selectionMode = false;
    this.selectedIds?.clear();
    this.selectedTrashIds?.clear();
    this.selectAll = false;
    this.updatePageVisibility();
    for (const button of this.elements.tabBar.querySelectorAll("[data-tab]")) {
      button.classList.toggle("on", button.dataset.tab === tab);
    }
    if (tab === "home") {
      this.renderGrid({ preservePaging: false });
      this.renderFolders();
    } else if (tab === "folders") {
      this.renderFolders();
    } else if (tab === "trash") {
      this.renderTrash();
    } else {
      this.renderSettingsView();
    }
    this.updateShell();
    this.elements.body.scrollTop = 0;
  }

  updateShell() {
    if (
      !this.elements?.pageTitle ||
      !this.elements?.album?.classList ||
      !this.elements?.tabBar?.querySelectorAll ||
      !this.root
    ) {
      return;
    }
    const inFolder = this.currentFolderId !== null;
    const folder = this.folders.find(
      (item) => item.id === this.currentFolderId
    );
    const subpageTitles = {
      pin: "解锁码",
      wipe: "紧急清除码",
      retention: "回收站保留时间",
    };
    const subpage = this.activeTab === "settings"
      ? this.settingsSubpage
      : null;
    const titles = {
      home: "首页",
      folders: "文件夹",
      trash: "回收站",
      settings: "设置",
    };
    this.elements.pageTitle.textContent = subpage
      ? subpageTitles[subpage]
      : this.selectionMode
        ? "已选"
        : inFolder
          ? folder?.name || "文件夹"
          : titles[this.activeTab] || "首页";
    const count = inFolder
      ? this.visibleRecords().length
      : this.activeTab === "folders"
        ? this.folders.length
        : this.activeTab === "trash"
          ? this.trashItems.length
          : this.activeTab === "settings"
            ? null
            : this.visibleRecords().length;
    this.elements.mediaCount.textContent =
      this.selectionMode
        ? `${this.selectedCount()} 项`
        : count === null
          ? ""
          : `${count} ${inFolder || this.activeTab === "home" ? "项" : this.activeTab === "folders" ? "个" : "项"}`;
    const searchAvailable = this.activeTab !== "settings";
    const selectAvailable = this.activeTab !== "settings";
    this.elements.navRow.classList.toggle(
      "sub",
      Boolean(subpage) || inFolder
    );
    this.elements.navRow.classList.toggle("icons", inFolder);
    this.elements.searchButton.hidden = !searchAvailable || Boolean(subpage);
    this.elements.selectButton.hidden = !selectAvailable || Boolean(subpage);
    this.elements.selectAllButton.hidden =
      !this.selectionMode || Boolean(subpage);
    this.elements.emptyTrashButton.hidden =
      this.activeTab !== "trash" || this.trashItems.length === 0;
    this.elements.emptyTrashButton.disabled =
      this.trashItems.length === 0;
    this.elements.renameFolderButton.hidden = !inFolder || Boolean(subpage);
    this.elements.lockButton.hidden =
      inFolder || Boolean(subpage);
    this.elements.folderBack.hidden = !(inFolder || subpage);
    if (subpage) {
      this.elements.folderBack.dataset.panelAction = "settings-back";
      this.elements.folderBack.setAttribute("aria-label", "返回设置");
      this.elements.folderBack.innerHTML = ic("chevl");
    } else if (inFolder) {
      this.elements.folderBack.dataset.panelAction = "folder-back";
      this.elements.folderBack.setAttribute("aria-label", "返回文件夹");
      this.elements.folderBack.innerHTML = ic("chevl");
    }
    this.elements.selectButton.classList.toggle("on", this.selectionMode);
    this.elements.selectButton.setAttribute(
      "aria-pressed",
      String(this.selectionMode)
    );
    this.elements.folderSection.hidden =
      inFolder ||
      this.contentFilter === "image" ||
      this.contentFilter === "video" ||
      this.contentFilter === "document" ||
      this.visibleFolders().length === 0;
    this.elements.tabBar.hidden = inFolder;
    this.elements.body.classList.toggle("notab", inFolder);
    this.renderFilterChips();
    this.elements.contentSearch.placeholder =
      this.activeTab === "folders"
        ? "搜索文件夹"
        : "搜索";
  }

  renderFilterChips() {
    if (!this.elements?.contentFilters) {
      return;
    }
    const context = this.activeTab === "settings"
      ? "settings"
      : this.currentFolderId !== null
        ? "folder"
        : this.activeTab;
    if (context === "settings" || context === "folders") {
      this.elements.contentFilters.replaceChildren();
      this.elements.contentFilters.hidden = true;
      return;
    }
    const options =
      context === "folder"
        ? [
            ["all", "全部"],
            ["image", "图片"],
            ["video", "视频"],
          ]
        : context === "home"
          ? [
              ["all", "全部"],
              ["image", "图片"],
              ["video", "视频"],
              ["document", "文档"],
              ["folder", "文件夹"],
            ]
          : [
              ["all", "全部"],
              ["image", "图片"],
              ["video", "视频"],
              ["document", "文档"],
            ];
    const allowed = new Set(options.map(([value]) => value));
    if (!allowed.has(this.contentFilter)) {
      this.contentFilter = "all";
    }
    const fragment = document.createDocumentFragment();
    for (const [value, label] of options) {
      const button = document.createElement("button");
      const active = this.contentFilter === value;
      button.type = "button";
      button.dataset.contentFilter = value;
      button.classList.toggle("on", active);
      button.setAttribute("aria-pressed", String(active));
      button.textContent = label;
      fragment.append(button);
    }
    this.elements.contentFilters.replaceChildren(fragment);
    this.elements.contentFilters.hidden = false;
  }

  toggleSearch() {
    if (this.activeTab === "settings") {
      return;
    }
    const opening = !this.searchOpen;
    this.searchOpen = opening;
    this.elements.searchBox.classList.toggle("open", opening);
    this.elements.searchButton.classList.toggle("on", opening);
    this.elements.searchButton.setAttribute(
      "aria-pressed",
      String(opening)
    );
    if (opening) {
      window.setTimeout(() => {
        this.elements.contentSearch.focus({ preventScroll: true });
      }, 0);
    } else {
      this.clearSearch(true);
    }
    this.updateShell();
  }

  closeSearch() {
    if (!this.elements?.searchBox) {
      return;
    }
    this.searchOpen = false;
    this.elements.searchBox.classList?.remove("open");
    this.elements.searchButton?.classList?.remove("on");
    this.elements.searchButton?.setAttribute?.(
      "aria-pressed",
      "false"
    );
  }

  clearSearch(close = false) {
    window.clearTimeout(this.searchTimer);
    if (close) {
      this.closeSearch();
      this.contentFilter = "all";
    }
    this.searchQuery = "";
    this.elements.contentSearch.value = "";
    this.elements.clearSearchButton.classList.remove("show");
    this.refreshCurrentView({ resetPaging: true });
    this.updateShell();
  }

  togglePlusMenu() {
    if (this.plusOpen) {
      this.closePlusMenu();
      return;
    }
    this.closeSearch();
    this.plusOpen = true;
    window.clearTimeout(this.plusCloseTimer);
    this.elements.overlay.innerHTML = `
      <button class="scrim" type="button" data-plus-close aria-label="关闭添加菜单"></button>
      <div class="pop">
        <button type="button" data-plus-action="add-photo">${ic("imgplus")}添加照片</button>
        <button type="button" data-plus-action="add-doc">${ic("fileplus")}新建文档</button>
        <button type="button" data-plus-action="add-folder">${ic("folderplus")}新建文件夹</button>
      </div>
    `;
    this.elements.plusButton.setAttribute("aria-expanded", "true");
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (!this.plusOpen) {
          return;
        }
        this.elements.overlay.classList.add("is-open");
        this.elements.overlay
          .querySelector(".fab")
          ?.classList.add("open");
        this.elements.plusButton
          .querySelector(".fab")
          ?.classList.add("open");
      });
    });
  }

  closePlusMenu(immediate = false, after = null) {
    if (!this.elements?.overlay) {
      return;
    }
    this.plusOpen = false;
    window.clearTimeout(this.plusCloseTimer);
    this.elements.plusButton?.setAttribute("aria-expanded", "false");
    this.elements.plusButton
      ?.querySelector(".fab")
      ?.classList.remove("open");
    const cleanup = () => {
      this.elements.overlay.innerHTML = "";
      this.elements.overlay.classList.remove("is-open", "closing");
      if (after) {
        after();
      }
    };
    if (immediate || this.elements.overlay.childElementCount === 0) {
      cleanup();
      return;
    }
    this.elements.overlay.classList.add("closing");
    this.elements.overlay.classList.remove("is-open");
    const delay = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches
      ? 0
      : 160;
    this.plusCloseTimer = window.setTimeout(cleanup, delay);
  }

  handlePlusAction(action) {
    if (action === "close") {
      this.closePlusMenu();
      return;
    }
    if (!["add-photo", "add-doc", "add-folder"].includes(action)) {
      return;
    }
    this.closePlusMenu(false, () => {
      if (action === "add-photo") {
        beginSystemPanel();
        this.elements.mediaInput.click();
      } else if (action === "add-doc") {
        void this.openTextEditor(null);
      } else {
        void this.createFolder();
      }
    });
  }

  toggleSelectionMode() {
    if (this.activeTab === "settings") {
      return;
    }
    if (this.selectionMode) {
      this.exitSelection();
    } else {
      this.selectionMode = true;
      this.selectedIds.clear();
      this.selectedTrashIds.clear();
      this.refreshCurrentView();
    }
  }

  enterSelection(id) {
    this.selectionMode = true;
    if (id) {
      if (this.activeTab === "trash") {
        this.selectedTrashIds.add(id);
      } else {
        this.selectedIds.add(id);
      }
    }
    this.refreshCurrentView();
  }

  exitSelection() {
    this.selectionMode = false;
    this.selectedIds?.clear();
    this.selectedTrashIds?.clear();
    this.selectAll = false;
    if (this.root && !this.destroyed) {
      this.refreshCurrentView();
    }
  }

  toggleRecordSelection(id) {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
    this.updateRecordSelectionUi();
  }

  toggleFolderSelection(id) {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
    this.renderFolders();
    this.updateSelectionUi();
  }

  toggleSelectAll() {
    const context = this.selectionContext();
    const visible =
      context === "folders"
        ? this.visibleFolders()
        : context === "trash"
          ? this.visibleTrashItems()
          : this.visibleRecords();
    const selection =
      context === "trash" ? this.selectedTrashIds : this.selectedIds;
    if (
      visible.length > 0 &&
      visible.every((item) => selection.has(item.id))
    ) {
      selection.clear();
      this.selectAll = false;
    } else {
      for (const item of visible) {
        selection.add(item.id);
      }
      this.selectAll = true;
    }
    if (context === "trash") {
      this.renderTrash();
    } else if (context === "folders") {
      this.renderFolders();
    } else {
      this.updateRecordSelectionUi();
    }
    this.updateSelectionUi();
  }

  selectionContext() {
    return selectionContext({
      activeTab: this.activeTab,
      currentFolderId: this.currentFolderId,
    });
  }

  visibleFolders() {
    return (this.folders || []).filter((folder) =>
      matchQuery(folder.name, this.searchQuery)
    );
  }

  visibleTrashItems() {
    return (this.trashItems || []).filter((item) => {
      if (!matchQuery(item.displayName || "内容", this.searchQuery)) {
        return false;
      }
      if (this.contentFilter === "all") {
        return true;
      }
      return (
        item.trashType !== "folder" &&
        this.recordCategory(item) === this.contentFilter
      );
    });
  }

  longPressKeyForElement(element) {
    if (this.activeTab === "settings") {
      return null;
    }
    if (element.matches(".trow[data-trash-id]")) {
      return element.dataset.trashId || null;
    }
    if (element.matches(".fcard[data-folder-id]")) {
      return this.activeTab === "folders"
        ? element.dataset.folderId || null
        : null;
    }
    return element.dataset.mediaId || null;
  }

  handleLongPress(key) {
    this.enterSelection(key);
    try {
      navigator.vibrate?.(8);
    } catch {
      // Haptics are optional.
    }
    const element = [
      ...this.elements.body.querySelectorAll(
        ".cell[data-media-id],.fcard[data-folder-id],.trow[data-trash-id]"
      ),
    ].find(
      (candidate) =>
        candidate.dataset.mediaId === key ||
        candidate.dataset.folderId === key ||
        candidate.dataset.trashId === key
    );
    if (
      element &&
      !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      element.animate(
        [
          { transform: "scale(1)" },
          { transform: "scale(.93)" },
          { transform: "scale(1)" },
        ],
        { duration: 220, easing: "ease-out" }
      );
    }
  }
  updateRecordSelectionUi() {
    if (!this.elements || this.destroyed) {
      return;
    }
    for (const card of this.elements.mediaGrid.querySelectorAll(
      ".cell[data-media-id]"
    )) {
      const id = card.dataset.mediaId;
      const record = this.records.find((item) => item.id === id);
      const selected = this.selectedIds.has(id);
      card.classList.toggle("sel", selected);
      if (record) {
        card.setAttribute(
          "aria-label",
          this.selectionMode
            ? `选择 ${record.name || record.title || "文本"}`
            : `打开 ${record.name || record.title || "文本"}`
        );
      }
      let check = card.querySelector(".tile .mark");
      if (this.selectionMode && !check) {
        check = document.createElement("span");
        check.className = "mark";
        card.querySelector(".tile")?.append(check);
      }
      if (check) {
        check.setAttribute("aria-hidden", String(!selected));
        check.innerHTML = selected ? ic("tick") : "";
      }
    }
    this.updateSelectionUi();
  }

  updateSelectionUi() {
    if (!this.elements) {
      return;
    }
    const selectButton = this.root.querySelector(
      '[data-panel-action="select"]'
    );
    if (selectButton) {
      selectButton.classList.toggle("on", this.selectionMode);
      selectButton.setAttribute(
        "aria-pressed",
        String(this.selectionMode)
      );
    }
    this.elements.selectionActions.hidden = !this.selectionMode;
    this.elements.selectionActions.className =
      this.currentFolderId !== null ? "selbar last" : "selbar";
    this.elements.album.classList.toggle(
      "selmode",
      this.selectionMode
    );
    document.body.classList.toggle(
      "panel-selecting",
      this.selectionMode
    );
    if (this.elements.selectedCount) {
      this.elements.selectedCount.textContent = String(
        this.selectedCount()
      );
    }
    const context = this.selectionContext();
    const actions = selectionActions(context, this.selectedCount());
    for (const button of this.elements.selectionActions.querySelectorAll(
      "[data-selection-action]"
    )) {
      const action = actions.find(
        (item) => item.id === button.dataset.selectionAction
      );
      button.hidden = !action;
      button.disabled = action?.disabled ?? true;
    }
    this.updateSelectAllControl(context);
    this.updateShell();
  }

  selectedCount() {
    return this.activeTab === "trash"
      ? this.selectedTrashIds.size
      : this.selectedIds.size;
  }

  updateSelectAllControl(context = this.selectionContext()) {
    if (!this.elements?.selectAllButton) {
      return;
    }
    const visible =
      context === "folders"
        ? this.visibleFolders()
        : context === "trash"
          ? this.visibleTrashItems()
          : this.visibleRecords();
    const selection =
      context === "trash" ? this.selectedTrashIds : this.selectedIds;
    const allSelected =
      visible.length > 0 &&
      visible.every((item) => selection.has(item.id));
    this.elements.selectAllButton.textContent = allSelected
      ? "取消全选"
      : "全选";
  }

  selectedRecords() {
    return this.records.filter((record) =>
      this.selectedIds.has(record.id)
    );
  }

  mediaCanRename(record) {
    return Boolean(
      record &&
        !record.legacy &&
        ["image", "video"].includes(record.kind)
    );
  }

  async renameMediaRecordFromPrompt(record) {
    if (this.destroyed || !this.mediaCanRename(record)) {
      return false;
    }
    const { base, ext } = splitMediaName(
      record.name,
      record.mimeType
    );
    const value = await showPrompt("输入新的名称", {
      title: "重命名",
      suffix: ext,
      defaultValue: base,
      maxLength: Math.max(1, 90 - ext.length),
      validate: (input) => validateMediaBaseName(input, ext),
    });
    if (value === null || this.destroyed) {
      return false;
    }
    const name = `${value.trim()}${ext}`;
    if (name === record.name) {
      return false;
    }
    try {
      const saved = await renameMediaRecord({
        crypto: this.crypto,
        key: this.crypto.masterKey,
        db: this.db,
        id: record.id,
        name,
      });
      if (!saved) {
        if (!this.destroyed) {
          this.showToast("内容已变化，请重试");
        }
        return false;
      }
      if (this.destroyed) {
        return false;
      }
      this.records = this.records.map((item) =>
        item.id === saved.id ? { ...saved, legacy: false } : item
      );
      if (this.viewerRecord?.id === saved.id) {
        this.viewerRecord = { ...saved, legacy: false };
        this.elements.viewerTitle.textContent = saved.name;
        const media = this.elements.viewerStage.querySelector("img");
        if (media) {
          media.alt = saved.name;
        }
      }
      this.rebuildSearchIndex();
      this.selectionMode = false;
      this.selectedIds.clear();
      this.renderGrid();
      this.showToast("已重命名");
      return true;
    } catch (error) {
      console.error("重命名失败", error);
      if (!this.destroyed) {
        this.showToast("重命名失败，请重试");
      }
      return false;
    }
  }

  async renameViewerRecord() {
    const record = this.viewerRecord;
    if (!record || !this.mediaCanRename(record)) {
      return;
    }
    await this.renameMediaRecordFromPrompt(record);
  }

  async renameSelected() {
    const context = this.selectionContext();
    if (context === "folders") {
      if (this.selectedIds.size !== 1) {
        return;
      }
      const folder = this.folders.find((item) =>
        this.selectedIds.has(item.id)
      );
      if (folder) {
        await this.renameFolder(folder);
      }
      return;
    }
    const selected = this.selectedRecords();
    if (selected.length !== 1) {
      return;
    }
    const record = selected[0];
    if (record.kind === "text") {
      await this.renameTextRecord(record);
    } else if (this.mediaCanRename(record)) {
      await this.renameMediaRecordFromPrompt(record);
    } else {
      this.showToast("旧内容整理完成后才能重命名");
    }
  }

  async renameTextRecord(record) {
    if (record.legacy || this.destroyed) {
      this.showToast("旧内容整理完成后才能重命名");
      return false;
    }
    const title = await showPrompt("输入新的标题", {
      title: "重命名",
      defaultValue: record.title,
      maxLength: 120,
      validate: (value) =>
        value.trim() ? "" : "标题不能为空",
    });
    if (title === null || this.destroyed) {
      return false;
    }
    try {
      const saved = await renameTextRecord({
        crypto: this.crypto,
        key: this.crypto.masterKey,
        db: this.db,
        id: record.id,
        title: title.trim(),
      });
      if (!saved || this.destroyed) {
        return false;
      }
      this.records = this.records.map((item) =>
        item.id === saved.id ? { ...saved, legacy: false } : item
      );
      this.rebuildSearchIndex();
      this.exitSelection();
      this.showToast("已重命名");
      return true;
    } catch (error) {
      console.error("重命名文档失败", error);
      if (!this.destroyed) {
        this.showToast("重命名失败，请重试");
      }
      return false;
    }
  }

  async createFolder() {
    if (this.destroyed || this.currentFolderId !== null) {
      return;
    }
    const name = await showPrompt("输入文件夹名称", {
      title: "新建文件夹",
      placeholder: "文件夹名称",
      maxLength: 80,
      validate: (value) =>
        value.trim() ? "" : "请输入文件夹名称",
    });
    if (!name || this.destroyed) {
      return;
    }
    try {
      const folder = await saveFolder({
        crypto: this.crypto,
        key: this.crypto.masterKey,
        db: this.db,
        folder: {
          id: contentId(),
          name: name.trim(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      });
      if (this.destroyed) {
        return;
      }
      this.folders.push(folder);
      this.folders.sort((left, right) =>
        left.name.localeCompare(right.name, "zh-CN")
      );
      this.renderFolders();
      this.renderGrid();
      this.showToast("文件夹已创建");
    } catch (error) {
      console.error("新建文件夹失败", error);
      if (!this.destroyed) {
        this.showToast("新建文件夹失败，请重试");
      }
    }
  }

  async renameFolder(folder) {
    const name = await showPrompt("输入新的文件夹名称", {
      title: "重命名文件夹",
      placeholder: "文件夹名称",
      defaultValue: folder.name,
      maxLength: 80,
      validate: (value) =>
        value.trim() ? "" : "请输入文件夹名称",
    });
    if (!name || this.destroyed) {
      return;
    }
    try {
      const saved = await saveFolder({
        crypto: this.crypto,
        key: this.crypto.masterKey,
        db: this.db,
        folder: {
          ...folder,
          name: name.trim(),
          updatedAt: Date.now(),
        },
      });
      if (this.destroyed) {
        return;
      }
      this.folders = this.folders
        .map((item) => (item.id === saved.id ? saved : item))
        .sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
      this.selectionMode = false;
      this.selectedIds.clear();
      this.renderFolders();
      this.renderGrid();
      this.showToast("文件夹已重命名");
    } catch (error) {
      console.error("重命名文件夹失败", error);
      if (!this.destroyed) {
        this.showToast("重命名失败，请重试");
      }
    }
  }

  async deleteFolder(folder) {
    const choice = await showChoice(
      `如何处理“${folder.name}”中的内容？连同内容删除会先移到回收站。`,
      {
        title: "删除文件夹",
        choices: [
          { value: "move", label: "仅删除，内容移回未归类" },
          {
            value: "delete",
            label: "连同内容一起删除",
            danger: true,
          },
        ],
      }
    );
    if (!choice || this.destroyed) {
      return;
    }
    const contents = this.records.filter(
      (record) => record.folderId === folder.id
    );
    try {
      let trashed = [];
      if (choice === "delete") {
        trashed = await trashContentRecords({
          crypto: this.crypto,
          key: this.crypto.masterKey,
          db: this.db,
          records: contents,
          folder,
          retentionDays: this.preferencesUnavailable
            ? null
            : this.preferences.trashRetentionDays,
        });
      } else {
        await removeFolder({
          crypto: this.crypto,
          key: this.crypto.masterKey,
          db: this.db,
          folder,
          contents,
          contentsMode: choice,
        });
      }
      if (this.destroyed) {
        return;
      }
      this.folders = this.folders.filter((item) => item.id !== folder.id);
      if (choice === "move") {
        this.records = this.records.map((record) =>
          record.folderId === folder.id
            ? { ...record, folderId: null }
            : record
        );
      } else {
        this.records = this.records.filter(
          (record) => record.folderId !== folder.id
        );
      }
      this.rebuildSearchIndex();
      this.selectionMode = false;
      this.selectedIds.clear();
      this.renderFolders();
      this.renderGrid();
      if (choice === "delete") {
        this.trashItems = await getTrashItems({
          crypto: this.crypto,
          key: this.crypto.masterKey,
          db: this.db,
        });
        this.updateTrashBadge();
        this.showToast("已移到回收站", {
          actionLabel: "撤销",
          duration: 8_000,
          onAction: () => this.restoreTrashWithUndo(trashed),
        });
      } else {
        this.showToast("文件夹已删除");
      }
    } catch (error) {
      console.error("删除文件夹失败", error);
      if (!this.destroyed) {
        this.showToast(
          error.message === "旧内容整理完成后才能移动"
            ? "旧内容整理完成后才能移动"
            : "删除文件夹失败，请重试"
        );
      }
    }
  }

  async deleteSelectedFolders() {
    const folders = this.folders.filter((folder) =>
      this.selectedIds.has(folder.id)
    );
    if (folders.length === 0 || this.destroyed) {
      return;
    }
    if (folders.length === 1) {
      await this.deleteFolder(folders[0]);
      return;
    }
    const choice = await showChoice(
      `如何处理这 ${folders.length} 个文件夹中的内容？`,
      {
        title: "删除文件夹",
        choices: [
          { value: "move", label: "仅删除，内容移回未归类" },
          {
            value: "delete",
            label: "连同内容一起移入回收站",
            danger: true,
          },
        ],
      }
    );
    if (!choice || this.destroyed) {
      return;
    }
    const folderIds = new Set(folders.map((folder) => folder.id));
    const contents = this.records.filter((record) =>
      folderIds.has(record.folderId)
    );
    try {
      let trashed = [];
      if (choice === "delete") {
        for (const folder of folders) {
          trashed.push(
            ...(await trashContentRecords({
              crypto: this.crypto,
              key: this.crypto.masterKey,
              db: this.db,
              records: contents.filter(
                (record) => record.folderId === folder.id
              ),
              folder,
              retentionDays: this.preferencesUnavailable
                ? null
                : this.preferences.trashRetentionDays,
            }))
          );
        }
        this.records = this.records.filter(
          (record) => !folderIds.has(record.folderId)
        );
      } else {
        for (const folder of folders) {
          await removeFolder({
            crypto: this.crypto,
            key: this.crypto.masterKey,
            db: this.db,
            folder,
            contents: contents.filter(
              (record) => record.folderId === folder.id
            ),
            contentsMode: "move",
          });
        }
        this.records = this.records.map((record) =>
          folderIds.has(record.folderId)
            ? { ...record, folderId: null }
            : record
        );
      }
      this.folders = this.folders.filter(
        (folder) => !folderIds.has(folder.id)
      );
      this.selectionMode = false;
      this.selectedIds.clear();
      this.rebuildSearchIndex();
      if (choice === "delete") {
        this.trashItems = await getTrashItems({
          crypto: this.crypto,
          key: this.crypto.masterKey,
          db: this.db,
        });
        this.updateTrashBadge();
        this.showToast("已移到回收站", {
          actionLabel: "撤销",
          duration: 8_000,
          onAction: () => this.restoreTrashWithUndo(trashed),
        });
      } else {
        this.showToast("文件夹已删除");
      }
      this.renderFolders();
      this.renderGrid();
    } catch (error) {
      console.error("批量删除文件夹失败", error);
      if (!this.destroyed) {
        this.showToast(
          error.message === "旧内容整理完成后才能删除"
            ? "旧内容整理完成后才能删除"
            : "删除文件夹失败，请重试"
        );
      }
    }
  }

  async openTextEditor(record) {
    if (this.destroyed) {
      return;
    }
    this.closeViewer();
    this.closeSettings();
    this.documentEditor?.destroy();
    this.documentEditor = null;
    const now = Date.now();
    this.textDraft = record
      ? { ...textRecordForDisplay(record) }
      : {
          id: contentId(),
          type: "text",
          kind: "text",
          format: "html",
          title: "",
          html: "<p></p>",
          body: "",
          folderId: this.currentFolderId,
          createdAt: now,
          updatedAt: now,
          schemaVersion: 2,
          legacy: false,
        };
    this.textDraft.isNew = !record;
    this.textDraft.revision = 0;
    this.textDraft.dirty = false;
    this.documentMode = record ? "view" : "edit";
    this.documentSheetOpen = false;
    this.elements.documentTitle.textContent = String(
      this.textDraft.title || ""
    ).slice(0, 120);
    this.elements.documentBody.replaceChildren();
    this.elements.documentSaveStatus.textContent = "自动保存";
    this.elements.documentPanel.hidden = false;
    document.body.classList.add("document-open");
    this.documentEditor = createDocumentEditor({
      element: this.elements.documentBody,
      html: sanitizeHtml(
        this.textDraft.html || textBodyToHtml(this.textDraft.body)
      ),
      editable: this.documentMode === "edit",
      onUpdate: ({ transaction }) =>
        this.handleDocumentUpdate(transaction),
      onSelectionUpdate: () => this.updateDocumentToolbar(),
      onReadOnlyChecked: () => this.documentMode === "view",
    });
    this.renderDocumentChrome();
    this.syncDocumentViewport();
    window.visualViewport?.addEventListener(
      "resize",
      this.handleDocumentViewportChange
    );
    window.visualViewport?.addEventListener(
      "scroll",
      this.handleDocumentViewportChange
    );
    window.addEventListener(
      "resize",
      this.handleDocumentViewportChange
    );
    window.clearTimeout(this.documentFocusTimer);
    this.documentFocusTimer = window.setTimeout(() => {
      if (
        this.destroyed ||
        this.elements.documentPanel.hidden
      ) {
        return;
      }
      if (this.documentMode === "edit") {
        if (!this.textDraft?.title) {
          this.focusDocumentTitle();
        } else {
          this.documentEditor?.commands.focus();
        }
      }
    }, 50);
  }

  focusDocumentTitle() {
    const title = this.elements?.documentTitle;
    if (
      !title?.isConnected ||
      this.elements.documentPanel.hidden ||
      title.contentEditable !== "true"
    ) {
      return;
    }
    title.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(title);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  handleDocumentAction(action) {
    if (action === "back") {
      void this.closeTextEditor();
      return;
    }
    if (action === "toggle-mode") {
      void this.toggleDocumentMode();
      return;
    }
    if (action === "done") {
      void this.finishDocumentEditing();
      return;
    }
    if (action === "format") {
      if (this.documentMode !== "edit") {
        return;
      }
      this.documentSheetOpen = !this.documentSheetOpen;
      this.renderDocumentChrome();
      return;
    }
    if (
      ["task-list", "bullet-list", "undo", "redo"].includes(action)
    ) {
      this.executeDocumentCommand(action);
    }
  }

  async toggleDocumentMode() {
    if (!this.textDraft) {
      return;
    }
    if (this.documentMode === "edit") {
      await this.finishDocumentEditing();
      return;
    }
    this.documentMode = "edit";
    this.renderDocumentChrome();
    window.setTimeout(() => this.documentEditor?.commands.focus(), 0);
  }

  async finishDocumentEditing() {
    if (!this.textDraft || this.documentMode !== "edit") {
      return;
    }
    await this.flushTextDraft();
    if (this.destroyed || !this.textDraft) {
      return;
    }
    this.documentMode = "view";
    this.documentSheetOpen = false;
    this.renderDocumentChrome();
  }

  renderDocumentChrome() {
    if (!this.elements?.documentPanel || !this.textDraft) {
      return;
    }
    const editing = this.documentMode === "edit";
    this.documentEditor?.setEditable(editing, false);
    this.elements.documentTitle.setAttribute(
      "contenteditable",
      String(editing)
    );
    this.elements.documentTitle.setAttribute(
      "aria-readonly",
      String(!editing)
    );
    this.elements.documentPanel.classList.toggle("doc-editing", editing);
    this.elements.documentModeButton.textContent = editing
      ? "完成"
      : "编辑";
    this.elements.documentModeButton.classList.toggle(
      "strong",
      editing
    );
    this.elements.documentModeButton.setAttribute(
      "aria-label",
      editing ? "完成编辑" : "编辑文档"
    );
    this.elements.documentToolbar.hidden = !editing;
    this.elements.documentFormatOverlay.hidden =
      !editing || !this.documentSheetOpen;
    this.elements.documentFormatOverlay.classList.toggle(
      "show",
      editing && this.documentSheetOpen
    );
    this.updateDocumentMetadata();
    this.updateDocumentToolbar();
  }

  handleDocumentTitleInput() {
    if (
      !this.textDraft ||
      this.documentMode !== "edit" ||
      !this.elements?.documentTitle
    ) {
      return;
    }
    const title = this.elements.documentTitle.textContent
      .replace(/\s+/g, " ")
      .slice(0, 120);
    if (this.elements.documentTitle.textContent !== title) {
      this.elements.documentTitle.textContent = title;
    }
    if (title === String(this.textDraft.title || "")) {
      return;
    }
    this.textDraft.title = title;
    this.markDocumentDirty();
  }

  handleDocumentUpdate(transaction) {
    if (
      !this.textDraft ||
      this.destroyed ||
      !transaction?.docChanged
    ) {
      return;
    }
    this.markDocumentDirty();
    this.updateDocumentMetadata();
    this.updateDocumentToolbar();
  }

  markDocumentDirty() {
    if (!this.textDraft) {
      return;
    }
    this.textDraft.dirty = true;
    this.textDraft.revision = (this.textDraft.revision || 0) + 1;
    this.queueTextSave();
  }

  updateDocumentMetadata() {
    if (!this.textDraft || !this.elements?.noteMeta) {
      return;
    }
    const html =
      this.documentEditor?.getHTML() ||
      this.textDraft.html ||
      textBodyToHtml(this.textDraft.body);
    const body = htmlToPlainText(html);
    this.elements.noteMeta.textContent = `${formatDocumentDate(
      this.textDraft.updatedAt
    )} · ${documentCharacterCount(body)} 字`;
  }

  documentSnapshot() {
    this.documentEditor?.view?.domObserver?.flush?.();
    const html = sanitizeHtml(
      this.documentEditor?.getHTML() ||
        this.textDraft?.html ||
        "<p></p>"
    );
    return {
      title: String(
        this.elements?.documentTitle?.textContent || ""
      )
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120),
      html,
      body: htmlToPlainText(html),
    };
  }

  handleReadOnlyTaskChange(event) {
    if (this.documentMode !== "view") {
      return;
    }
    const input = event.target?.closest?.(
      'input[type="checkbox"]'
    );
    const taskItem = input?.closest?.("li[data-checked]");
    if (!taskItem) {
      return;
    }
    this.updateReadOnlyTask(taskItem, input.checked);
  }

  updateReadOnlyTask(taskItem, checked) {
    if (
      this.documentMode !== "view" ||
      !this.documentEditor ||
      !taskItem
    ) {
      return false;
    }
    let target;
    try {
      target = this.documentEditor.view.posAtDOM(taskItem, 0) - 1;
    } catch {
      return false;
    }
    const current = this.documentEditor.state.doc.nodeAt(target);
    if (current?.type.name !== "taskItem") {
      return false;
    }
    if (Boolean(current.attrs.checked) === Boolean(checked)) {
      return true;
    }
    const transaction = this.documentEditor.state.tr.setNodeMarkup(
      target,
      undefined,
      { ...current.attrs, checked }
    );
    this.documentEditor.view.dispatch(transaction);
    return true;
  }

  updateDocumentToolbar() {
    if (
      !this.documentEditor ||
      !this.elements?.documentToolbar ||
      this.documentMode !== "edit"
    ) {
      return;
    }
    const editor = this.documentEditor;
    const setActive = (selector, active) => {
      for (const button of this.elements.documentFormatOverlay.querySelectorAll(
        selector
      )) {
        button.classList.toggle("on", Boolean(active));
        button.setAttribute("aria-pressed", String(Boolean(active)));
      }
    };
    setActive(
      '[data-doc-command="heading-2"]',
      editor.isActive("heading", { level: 2 })
    );
    setActive(
      '[data-doc-command="heading-3"]',
      editor.isActive("heading", { level: 3 })
    );
    setActive(
      '[data-doc-command="paragraph"]',
      editor.isActive("paragraph") &&
        !editor.isActive("codeBlock")
    );
    setActive(
      '[data-doc-command="code-block"]',
      editor.isActive("codeBlock")
    );
    for (const mark of ["bold", "italic", "underline", "strike"]) {
      setActive(`[data-doc-command="${mark}"]`, editor.isActive(mark));
    }
    setActive(
      '[data-doc-command="bullet-list"]',
      editor.isActive("bulletList")
    );
    setActive(
      '[data-doc-command="ordered-list"]',
      editor.isActive("orderedList")
    );
    setActive(
      '[data-doc-command="task-list"]',
      editor.isActive("taskList")
    );
    const color = editor.getAttributes("textColor").color || "default";
    setActive("[data-text-color]", false);
    const colorButton =
      this.elements.documentFormatOverlay.querySelector(
        `[data-text-color="${color}"]`
      );
    colorButton?.classList.add("on");
    colorButton?.setAttribute("aria-pressed", "true");
    const size =
      Number(editor.getAttributes("fontSize").size) || 17;
    const sizeOutput =
      this.elements.documentFormatOverlay.querySelector("#fs-size");
    if (sizeOutput) {
      sizeOutput.textContent = String(size);
    }
    const taskActive = editor.isActive("taskList");
    const bulletActive = editor.isActive("bulletList");
    for (const action of ["task-list", "bullet-list"]) {
      const icon = this.elements.documentToolbar.querySelector(
        `[data-text-action="${action}"]`
      );
      const active = action === "task-list" ? taskActive : bulletActive;
      icon?.classList.toggle("on", active);
      icon?.setAttribute("aria-pressed", String(active));
    }
    const sheetButton =
      this.elements.documentToolbar.querySelector(
        '[data-format-toggle="sheet"]'
      );
    sheetButton?.classList.toggle("on", this.documentSheetOpen);
    sheetButton?.setAttribute(
      "aria-expanded",
      String(this.documentSheetOpen)
    );
    sheetButton?.setAttribute(
      "aria-pressed",
      String(this.documentSheetOpen)
    );
    const formatColorButton =
      this.elements.documentToolbar.querySelector(
        '[data-format-toggle="color"]'
      );
    const colorActive =
      !this.documentSheetOpen && color !== "default";
    formatColorButton?.classList.toggle("on", colorActive);
    formatColorButton?.setAttribute(
      "aria-expanded",
      String(this.documentSheetOpen)
    );
    formatColorButton?.setAttribute(
      "aria-pressed",
      String(colorActive)
    );
    const undo = this.elements.documentToolbar.querySelector(
      '[data-text-action="undo"]'
    );
    const redo = this.elements.documentToolbar.querySelector(
      '[data-text-action="redo"]'
    );
    if (undo) {
      undo.disabled = !editor.can().undo();
    }
    if (redo) {
      redo.disabled = !editor.can().redo();
    }
  }

  executeDocumentCommand(command) {
    const editor = this.documentEditor;
    if (!editor || this.documentMode !== "edit") {
      return;
    }
    const chain = editor.chain().focus();
    if (command === "heading-2") {
      chain.toggleHeading({ level: 2 }).run();
    } else if (command === "heading-3") {
      chain.toggleHeading({ level: 3 }).run();
    } else if (command === "paragraph") {
      chain.setParagraph().run();
    } else if (command === "code-block") {
      chain.toggleCodeBlock().run();
    } else if (command === "bold") {
      chain.toggleBold().run();
    } else if (command === "italic") {
      chain.toggleItalic().run();
    } else if (command === "underline") {
      chain.toggleUnderline().run();
    } else if (command === "strike") {
      chain.toggleStrike().run();
    } else if (command === "bullet-list") {
      chain.toggleBulletList().run();
    } else if (command === "ordered-list") {
      chain.toggleOrderedList().run();
    } else if (command === "task-list") {
      chain.toggleTaskList().run();
    } else if (command === "indent") {
      const type = editor.isActive("taskItem")
        ? "taskItem"
        : "listItem";
      if (editor.can().sinkListItem(type)) {
        chain.sinkListItem(type).run();
      }
    } else if (command === "undo") {
      chain.undo().run();
    } else if (command === "redo") {
      chain.redo().run();
    }
    this.updateDocumentToolbar();
  }

  stepDocumentFont(delta) {
    const editor = this.documentEditor;
    if (!editor || this.documentMode !== "edit" || !delta) {
      return;
    }
    const current =
      Number(editor.getAttributes("fontSize").size) || 17;
    const next = Math.max(12, Math.min(36, current + Math.sign(delta)));
    const chain = editor.chain().focus();
    if (next === 17) {
      chain.unsetMark("fontSize").run();
    } else {
      chain.setMark("fontSize", { size: next }).run();
    }
    this.updateDocumentToolbar();
  }

  setDocumentColor(color) {
    const editor = this.documentEditor;
    if (!editor || this.documentMode !== "edit") {
      return;
    }
    if (color === "default") {
      editor.chain().focus().unsetMark("textColor").run();
    } else {
      editor.chain().focus().setMark("textColor", { color }).run();
    }
    this.updateDocumentToolbar();
  }

  syncDocumentViewport() {
    if (!this.elements?.documentPanel || this.elements.documentPanel.hidden) {
      return;
    }
    const viewport = window.visualViewport;
    const height = viewport?.height || window.innerHeight;
    const top = viewport?.offsetTop || 0;
    this.elements.documentPanel.style.setProperty(
      "--doc-vv-height",
      `${height}px`
    );
    this.elements.documentPanel.style.setProperty(
      "--doc-vv-top",
      `${top}px`
    );
  }

  queueTextSave() {
    if (!this.textDraft || this.destroyed) {
      return;
    }
    window.clearTimeout(this.textSaveTimer);
    this.elements.documentSaveStatus.textContent = "正在保存…";
    this.textSaveTimer = window.setTimeout(() => {
      void this.flushTextDraft();
    }, 450);
  }

  async flushTextDraft() {
    window.clearTimeout(this.textSaveTimer);
    this.textSaveTimer = 0;
    const draft = this.textDraft;
    if (!draft || this.destroyed) {
      return;
    }
    this.documentEditor?.view?.domObserver?.flush?.();
    if (!draft.isNew && !draft.dirty) {
      return;
    }
    const snapshot = this.documentSnapshot();
    const { title, html, body } = snapshot;
    if (draft.isNew && !title.trim() && !body.trim()) {
      this.elements.documentSaveStatus.textContent = "自动保存";
      return;
    }
    const revision = draft.revision || 0;

    this.textSavePromise = this.textSavePromise
      .catch(() => {})
      .then(async () => {
        const saved = await saveText({
          crypto: this.crypto,
          key: this.crypto.masterKey,
          db: this.db,
          text: {
            ...draft,
            title,
            format: "html",
            html,
            body,
            schemaVersion: 2,
            updatedAt: Date.now(),
          },
        });
        if (this.destroyed) {
          return;
        }
        const index = this.records.findIndex((item) => item.id === saved.id);
        if (index >= 0) {
          this.records[index] = { ...saved, legacy: false };
        } else {
          this.records.unshift({ ...saved, legacy: false });
        }
        this.rebuildSearchIndex();
        const latestRevision =
          this.textDraft?.revision ?? revision;
        this.textDraft = {
          ...saved,
          isNew: false,
          revision: latestRevision,
          dirty: latestRevision !== revision,
        };
        this.elements.documentSaveStatus.textContent = "已保存";
        this.renderGrid();
        this.updateDocumentMetadata();
        if (this.textDraft.dirty) {
          this.queueTextSave();
        }
      });

    try {
      await this.textSavePromise;
    } catch (error) {
      console.error("文本保存失败", error);
      if (!this.destroyed) {
        this.elements.documentSaveStatus.textContent = "保存失败";
      }
    }
  }

  async closeTextEditor() {
    if (!this.elements?.documentPanel || this.elements.documentPanel.hidden) {
      return;
    }
    await this.flushTextDraft();
    await this.textSavePromise.catch(() => {});
    window.clearTimeout(this.documentFocusTimer);
    this.documentFocusTimer = 0;
    this.documentEditor?.destroy();
    this.documentEditor = null;
    this.elements.documentPanel.hidden = true;
    this.elements.documentTitle.textContent = "";
    this.elements.documentBody.replaceChildren();
    this.elements.documentTitle.removeAttribute("contenteditable");
    this.elements.documentSaveStatus.textContent = "自动保存";
    this.elements.noteMeta.textContent = "";
    this.elements.documentToolbar.hidden = true;
    this.elements.documentFormatOverlay.hidden = true;
    this.elements.documentFormatOverlay.classList.remove("show");
    this.elements.documentPanel.style.removeProperty("--doc-vv-height");
    this.elements.documentPanel.style.removeProperty("--doc-vv-top");
    this.textDraft = null;
    this.documentMode = "view";
    this.documentSheetOpen = false;
    window.visualViewport?.removeEventListener(
      "resize",
      this.handleDocumentViewportChange
    );
    window.visualViewport?.removeEventListener(
      "scroll",
      this.handleDocumentViewportChange
    );
    window.removeEventListener(
      "resize",
      this.handleDocumentViewportChange
    );
    document.body.classList.remove("document-open");
    this.renderGrid();
  }

  async flushBeforeLock() {
    if (!this.textDraft || this.elements?.documentPanel?.hidden) {
      return;
    }
    await this.flushTextDraft();
    await this.textSavePromise.catch(() => {});
  }

  async moveSelected() {
    const records = this.selectedRecords();
    if (records.length === 0 || this.destroyed) {
      return;
    }
    if (records.some((record) => record.legacy)) {
      this.showToast("旧内容整理完成后才能移动");
      return;
    }
    const choices = [];
    if (this.currentFolderId !== null) {
      choices.push({ value: "__root__", label: "未归类" });
    }
    for (const folder of this.folders) {
      if (folder.id !== this.currentFolderId) {
        choices.push({ value: folder.id, label: folder.name });
      }
    }
    if (choices.length === 0) {
      this.showToast("请先新建一个文件夹");
      return;
    }
    const destination = await showChoice(
      `将选中的 ${records.length} 项移动到：`,
      {
        title: "移动到",
        choices,
      }
    );
    if (!destination || this.destroyed) {
      return;
    }
    const folderId = destination === "__root__" ? null : destination;
    try {
      const moved = await moveContentRecords({
        crypto: this.crypto,
        key: this.crypto.masterKey,
        db: this.db,
        records,
        folderId,
      });
      if (this.destroyed) {
        return;
      }
      const movedMap = new Map(moved.map((record) => [record.id, record]));
      this.records = this.records.map((record) =>
        movedMap.has(record.id)
          ? { ...movedMap.get(record.id), legacy: false }
          : record
      );
      this.rebuildSearchIndex();
      this.exitSelection();
      this.renderFolders();
      this.showToast(`已移动 ${moved.length} 项`);
    } catch (error) {
      console.error("批量移动失败", error);
      if (!this.destroyed) {
        this.showToast("移动失败，请重试");
      }
    }
  }

  async deleteSelected() {
    if (this.selectionContext() === "trash") {
      await this.purgeSelectedTrash();
      return;
    }
    if (this.selectionContext() === "folders") {
      await this.deleteSelectedFolders();
      return;
    }
    const records = this.selectedRecords();
    if (records.length === 0 || this.destroyed) {
      return;
    }
    const confirmed = await showConfirm(
      `将选中的 ${records.length} 项移入回收站`,
      {
        title: `删除 ${records.length} 项？`,
        confirmText: "删除",
        cancelText: "取消",
        danger: true,
      }
    );
    if (!confirmed || this.destroyed) {
      return;
    }
    try {
      const trashed = await trashContentRecords({
        crypto: this.crypto,
        key: this.crypto.masterKey,
        db: this.db,
        records,
        retentionDays: this.preferencesUnavailable
          ? null
          : this.preferences.trashRetentionDays,
      });
      if (this.destroyed) {
        return;
      }
      const deleted = new Set(records.map((record) => record.id));
      this.records = this.records.filter(
        (record) => !deleted.has(record.id)
      );
      this.rebuildSearchIndex();
      this.exitSelection();
      this.renderFolders();
      this.trashItems = await getTrashItems({
        crypto: this.crypto,
        key: this.crypto.masterKey,
        db: this.db,
      });
      this.updateTrashBadge();
      this.showToast(`已移到回收站（${deleted.size} 项）`, {
        actionLabel: "撤销",
        duration: 8_000,
        onAction: () => this.restoreTrashWithUndo(trashed),
      });
    } catch (error) {
      console.error("批量删除失败", error);
      if (!this.destroyed) {
        this.showToast("删除失败，请重试");
      }
    }
  }

  async exportSelected() {
    const records = this.selectedRecords();
    if (records.length === 0 || this.destroyed) {
      return;
    }
    const textOnly = records.every((record) => record.kind === "text");
    if (textOnly) {
      const action = await showChoice(
        `已选择 ${records.length} 篇文本。`,
        {
          title: "存储/分享",
          choices: [
            { value: "clipboard", label: "复制到剪贴板" },
            { value: "share", label: "分享为 .txt" },
            { value: "download", label: "下载 .txt" },
          ],
        }
      );
      if (!action || this.destroyed) {
        return;
      }
      if (action === "clipboard") {
        const content = records
          .map((record) =>
            record.title
              ? `${record.title}\n\n${record.body}`
              : record.body
          )
          .join("\n\n");
        try {
          await navigator.clipboard.writeText(content);
          this.showToast("已复制到剪贴板");
        } catch {
          this.showToast("复制失败，请改用 .txt 分享");
        }
        return;
      }
      if (action === "download") {
        await this.exportRecords(records, { forceDownload: true });
        return;
      }
    }

    await this.exportRecords(records);
  }

  async exportRecords(records, { forceDownload = false } = {}) {
    if (this.destroyed || records.length === 0) {
      return;
    }
    if (hasLargeExport(records)) {
      const confirmed = await showConfirm(LARGE_EXPORT_CONFIRM_MESSAGE, {
        title: "导出较大文件",
        confirmText: "继续导出",
        cancelText: "取消",
      });
      if (!confirmed || this.destroyed) {
        return;
      }
    }
    if (this.exportBusy) {
      this.showToast("正在准备上一次导出");
      return;
    }
    this.exportBusy = true;
    const ios = isAppleMobile();
    let strategy = ios ? "ios-download" : "stream-download";
    try {
      if (forceDownload) {
        if (ios) {
          await this.downloadIosRecords(records);
        } else {
          await this.downloadRecords(records);
        }
        this.showToast(`已开始下载 ${records.length} 个文件`);
        return;
      }
      const canAttemptShare =
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function";
      const shareApiAvailable = typeof navigator.share === "function";
      const hasLargeStreamingRecord = records.some(
        (record) =>
          record.kind !== "text" &&
          !record.legacy &&
          Number(record.size) > SHARE_MEMORY_LIMIT_BYTES
      );
      let canShareFiles = false;
      if (canAttemptShare) {
        const probes = records.map(
          (record) =>
            new File([], record.name || "content", {
              type:
                record.kind === "text"
                  ? "text/plain;charset=utf-8"
                  : record.mimeType || "application/octet-stream",
            })
        );
        try {
          canShareFiles = navigator.canShare({ files: probes }) === true;
        } catch {
          canShareFiles = false;
        }
      }
      strategy = chooseExportStrategy({
        ios,
        canShareFiles: ios ? shareApiAvailable : canShareFiles,
        hasLargeStreamingRecord,
      });

      if (strategy === "stream-download") {
        await this.downloadRecords(records);
        this.showToast(`已开始下载 ${records.length} 个文件`);
        return;
      }

      if (strategy === "ios-download") {
        await this.downloadIosRecords(records);
        this.showToast("已打开文件下载");
        return;
      }

      let files = await this.prepareExportFiles(records);
      if (this.destroyed) {
        return;
      }
      let canShare = false;
      try {
        canShare =
          typeof navigator.share === "function" &&
          navigator.canShare?.({ files }) === true;
      } catch {
        canShare = false;
      }
      if (canShare) {
        const shareResult =
          ios && shareApiAvailable
            ? await this.waitForIosShareGesture(files)
            : await this.performShare(files);
        if (shareResult.status === "shared") {
          if (!this.destroyed) {
            this.showToast("已完成导出");
          }
          return;
        }
        if (
          shareResult.status === "aborted" ||
          shareResult.status === "cancelled"
        ) {
          if (!this.destroyed) {
            this.showToast("已取消分享");
          }
          return;
        }
        if (shareResult.error) {
          console.error("批量分享失败", shareResult.error);
          this.finishExportProgress();
          await showAlert(SHARE_FAILURE_MESSAGE, {
            title: "分享未完成",
          });
          return;
        }
      }

      if (ios) {
        files = [];
        await this.downloadIosRecords(records);
        this.showToast("已打开文件下载");
      } else {
        await this.downloadRecords(records);
        this.showToast(`已开始下载 ${records.length} 个文件`);
      }
    } catch (error) {
      if (error?.name === "AbortError") {
        if (!this.destroyed) {
          this.showToast("已取消导出");
        }
        return;
      }
      console.error("批量导出失败", error);
      if (!this.destroyed) {
        this.showToast("导出失败，请重试");
      }
    } finally {
      this.finishExportProgress();
      this.exportJob = null;
      this.exportBusy = false;
    }
  }

  prepareExportFiles(records) {
    const totalBytes = records.reduce(
      (sum, record) =>
        sum + (record.kind === "text" ? 1 : Number(record.size) || 0),
      0
    );
    const job = { cancelled: false, totalBytes, completedBytes: 0 };
    this.exportJob = job;
    this.beginExportProgress();
    return this.buildExportFiles(records, job);
  }

  async performShare(files) {
    const panelToken = beginSystemPanel();
    try {
      await navigator.share({ files });
      return { status: "shared" };
    } catch (error) {
      return {
        status: error?.name === "AbortError" ? "aborted" : "failed",
        error,
      };
    } finally {
      endSystemPanel(panelToken);
    }
  }

  waitForIosShareGesture(files) {
    if (!this.elements?.exportShareButton) {
      return this.performShare(files);
    }
    this.elements.exportLabel.textContent = "文件已准备好";
    this.elements.exportPercent.textContent = "100%";
    this.elements.exportBar.value = 100;
    this.elements.exportShareButton.hidden = false;
    this.elements.exportShareButton.disabled = false;
    this.elements.exportCancel.textContent = "取消";
    return new Promise((resolve) => {
      this.pendingShare = { files, resolve };
    });
  }

  async sharePreparedExport() {
    if (!this.pendingShare) {
      return;
    }
    const pending = this.pendingShare;
    this.pendingShare = null;
    this.elements.exportShareButton.disabled = true;
    this.elements.exportLabel.textContent = "正在打开系统分享…";
    const result = await this.performShare(pending.files);
    pending.resolve(result);
  }

  async buildExportFiles(records, job) {
    const files = [];
    for (const record of records) {
      this.throwIfExportCancelled(job);
      if (record.kind === "text") {
        const content = record.title
          ? `${record.title}\n\n${record.body}`
          : record.body;
        const filename = `${
          this.safeFilename(record.title) || "文本"
        }.txt`;
        files.push(
          new File([content], filename, {
            type: "text/plain;charset=utf-8",
          })
        );
        job.completedBytes += 1;
        this.updateExportProgress(job);
        continue;
      }

      const parts = await this.readExportParts(record, job);
      this.throwIfExportCancelled(job);
      files.push(
        makeFileFromParts(
          parts,
          this.safeFilename(record.name) || "内容",
          record.mimeType || "application/octet-stream"
        )
      );
    }
    return files;
  }

  async readExportParts(record, job) {
    const metadata = await this.resolveLegacyReference(record);
    if (metadata.legacy) {
      const legacy = await this.db.getLegacyRecord(metadata.id);
      if (!legacy) {
        throw new Error("旧记录不存在");
      }
      const plain = await this.crypto.decrypt(
        legacy.ciphertext,
        legacy.iv,
        this.legacyKey
      );
      try {
        job.completedBytes += plain.byteLength;
        this.updateExportProgress(job);
        return [new Blob([plain], { type: metadata.mimeType })];
      } finally {
        plain.fill(0);
      }
    }

    const recordStart = job.completedBytes;
    return readOriginalBlobParts({
      db: this.db,
      crypto: this.crypto,
      key: this.crypto.masterKey,
      metadata,
      shouldAbort: () =>
        job.cancelled || this.destroyed,
      onProgress: ({ written }) => {
        job.completedBytes = recordStart + written;
        this.updateExportProgress(job);
      },
    });
  }

  async downloadIosRecords(records) {
    const totalBytes = records.reduce(
      (sum, record) =>
        sum + (record.kind === "text" ? 1 : Number(record.size) || 0),
      0
    );
    const job = { cancelled: false, totalBytes, completedBytes: 0 };
    this.exportJob = job;
    this.beginExportProgress();
    for (const record of records) {
      this.throwIfExportCancelled(job);
      if (record.kind === "text") {
        const content = record.title
          ? `${record.title}\n\n${record.body}`
          : record.body;
        const filename = `${
          this.safeFilename(record.title) || "文本"
        }.txt`;
        this.downloadBlob(
          new File([content], filename, {
            type: "text/plain;charset=utf-8",
          }),
          filename,
          true
        );
        job.completedBytes += 1;
        this.updateExportProgress(job);
        continue;
      }
      const parts = await this.readExportParts(record, job);
      this.throwIfExportCancelled(job);
      const blob = new Blob(parts, {
        type: record.mimeType || "application/octet-stream",
      });
      this.downloadBlob(
        blob,
        this.safeFilename(record.name) || "内容",
        true
      );
    }
  }

  beginExportProgress() {
    if (!this.elements?.exportProgress) {
      return;
    }
    this.elements.exportProgress.hidden = false;
    this.elements.exportBar.value = 0;
    this.elements.exportPercent.textContent = "0%";
    this.elements.exportLabel.textContent = exportProgressText(0, 0);
    this.elements.exportShareButton.hidden = true;
    this.elements.exportShareButton.disabled = false;
    this.elements.exportCancel.textContent = "取消";
    this.elements.exportCancel.disabled = false;
  }

  updateExportProgress(job) {
    if (!this.elements?.exportProgress || this.destroyed) {
      return;
    }
    const percent =
      job.totalBytes <= 0
        ? 100
        : Math.min(
            100,
            Math.round((job.completedBytes / job.totalBytes) * 100)
          );
    this.elements.exportBar.value = percent;
    this.elements.exportPercent.textContent = `${percent}%`;
    this.elements.exportLabel.textContent = exportProgressText(
      Math.min(job.completedBytes, job.totalBytes),
      job.totalBytes
    );
  }

  finishExportProgress() {
    if (this.elements?.exportProgress) {
      this.elements.exportProgress.hidden = true;
      this.elements.exportCancel.disabled = false;
      this.elements.exportShareButton.hidden = true;
      this.elements.exportShareButton.disabled = false;
    }
    this.elements?.exportCancel &&
      (this.elements.exportCancel.textContent = "取消");
  }

  cancelExport() {
    if (this.pendingShare) {
      const pending = this.pendingShare;
      this.pendingShare = null;
      pending.resolve({ status: "cancelled" });
      return;
    }
    if (!this.exportJob) {
      return;
    }
    this.exportJob.cancelled = true;
    this.elements.exportCancel.disabled = true;
    this.elements.exportCancel.textContent = "正在取消…";
    this.elements.exportLabel.textContent = "正在取消导出…";
  }

  throwIfExportCancelled(job) {
    if (job.cancelled || this.destroyed) {
      const error = new Error("导出已取消");
      error.name = "AbortError";
      throw error;
    }
  }

  async downloadRecords(records) {
    for (const record of records) {
      if (record.kind === "text") {
        const content = record.title
          ? `${record.title}\n\n${record.body}`
          : record.body;
        const filename = `${
          this.safeFilename(record.title) || "文本"
        }.txt`;
        this.downloadBlob(
          new File([content], filename, { type: "text/plain;charset=utf-8" }),
          filename
        );
      } else if (!record.legacy) {
        await this.downloadStreamingRecord(record);
      } else {
        this.downloadBlob(
          await this.readRecordBlob(record),
          record.name,
          isAppleMobile()
        );
      }
    }
    return records.length;
  }

  async downloadStreamingRecord(record) {
    if (isAppleMobile()) {
      throw new Error("iOS 不使用隐藏页面下载");
    }
    await navigator.serviceWorker.ready;
    const controller = await waitForController();
    const registration = this.makeMediaRegistration(record);
    if (!controller || !registration) {
      throw new Error("下载服务尚未就绪");
    }
    await this.sendWorkerMessage(controller, registration);
    const frame = document.createElement("iframe");
    frame.hidden = true;
    frame.tabIndex = -1;
    frame.setAttribute("aria-hidden", "true");
    frame.title = "文件下载";
    document.body.append(frame);
    this.downloadFrames.add(frame);
    frame.src = new URL(
      `./__media/${encodeURIComponent(record.id)}?download=1`,
      window.location.href
    ).href;
    window.setTimeout(() => {
      this.downloadFrames.delete(frame);
      frame.remove();
    }, 10 * 60_000);
    window.setTimeout(() => {
      controller.postMessage({
        type: "unregister-media",
        mediaId: record.id,
      });
    }, 30_000);
  }

  safeFilename(value) {
    const sanitized = String(value || "")
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
      .trim();
    if (sanitized.length <= 90) {
      return sanitized;
    }
    const { base, ext } = splitMediaName(sanitized);
    return ext
      ? `${base.slice(0, 90 - ext.length)}${ext}`
      : sanitized.slice(0, 90);
  }

  scheduleThumbnail(record, image) {
    if (this.thumbnailFailed.has(record.id)) {
      return;
    }
    const existing = this.thumbnailCache.get(record.id);
    if (existing) {
      image.src = existing;
      return;
    }
    if (
      this.thumbnailQueued.has(record.id) ||
      this.thumbnailLoading.has(record.id)
    ) {
      return;
    }
    this.thumbnailQueued.add(record.id);
    this.thumbnailQueue.push({ record, image });
    this.drainThumbnailQueue();
  }

  drainThumbnailQueue() {
    while (
      this.thumbnailWorkers < THUMBNAIL_CONCURRENCY &&
      this.thumbnailQueue.length > 0 &&
      !this.destroyed
    ) {
      const job = this.thumbnailQueue.shift();
      this.thumbnailQueued.delete(job.record.id);
      this.thumbnailLoading.add(job.record.id);
      this.thumbnailWorkers += 1;
      void this.loadThumbnail(job.record, job.image).finally(() => {
        this.thumbnailLoading.delete(job.record.id);
        this.thumbnailWorkers -= 1;
        this.drainThumbnailQueue();
      });
    }
  }

  async loadThumbnail(record, image) {
    try {
      let envelope;
      let key;
      if (record.legacy) {
        const legacy = await this.db.getLegacyRecord(record.id);
        if (legacy?.thumbnailIv && legacy?.thumbnailCiphertext) {
          envelope = {
            iv: legacy.thumbnailIv,
            ciphertext: legacy.thumbnailCiphertext,
          };
          key = this.legacyKey;
        } else {
          envelope = await this.db.getThumbnail(record.id);
          key = this.crypto.masterKey;
        }
      } else {
        envelope = await this.db.getThumbnail(record.id);
        key = this.crypto.masterKey;
      }
      const blob = await decryptThumbnail(this.crypto, key, envelope);
      if (!blob || this.destroyed) {
        if (!blob) {
          this.thumbnailFailed.add(record.id);
        }
        return;
      }
      const url = URL.createObjectURL(blob);
      if (!image.isConnected || this.destroyed) {
        URL.revokeObjectURL(url);
        return;
      }
      const protectedIds = this.nearViewportThumbnailIds();
      protectedIds.add(record.id);
      this.thumbnailCache.set(record.id, url, blob.size, protectedIds);
      for (const target of this.root?.querySelectorAll?.(
        "img[data-media-id]"
      ) || []) {
        if (target.dataset.mediaId === record.id) {
          target.src = url;
        }
      }
    } catch (error) {
      if (!this.destroyed) {
        console.error("缩略图解密失败", error);
        this.thumbnailFailed.add(record.id);
      }
    }
  }

  nearViewportThumbnailIds() {
    const ids = new Set();
    if (!this.elements?.body) {
      return ids;
    }
    const rect = this.elements.body.getBoundingClientRect();
    const top = rect.top - rect.height * 3;
    const bottom = rect.bottom + rect.height * 3;
    for (const image of this.elements.body.querySelectorAll(
      "img[data-media-id]"
    )) {
      const imageRect = image.getBoundingClientRect();
      if (imageRect.bottom >= top && imageRect.top <= bottom) {
        ids.add(image.dataset.mediaId);
      }
    }
    return ids;
  }

  handleThumbnailEviction(url, id) {
    URL.revokeObjectURL(url);
    if (this.destroyed) {
      return;
    }
    for (const image of this.root?.querySelectorAll?.(
      "img[data-media-id]"
    ) || []) {
      if (image.dataset.mediaId !== id || image.src !== url) {
        continue;
      }
      image.removeAttribute("src");
      this.thumbnailObserver?.unobserve(image);
      this.thumbnailObserver?.observe(image);
    }
  }

  releaseTrashThumbnails() {
    const ids = this.trashThumbnailIds;
    if (!ids || ids.size === 0) {
      return;
    }
    for (const id of ids) {
      this.thumbnailCache.delete(id);
    }
    this.thumbnailQueue = this.thumbnailQueue.filter((job) => {
      if (!ids.has(job.record.id)) {
        return true;
      }
      this.thumbnailQueued.delete(job.record.id);
      return false;
    });
    for (const image of this.elements?.trashList?.querySelectorAll?.(
      "img[data-media-id]"
    ) || []) {
      this.thumbnailObserver?.unobserve(image);
      image.removeAttribute("src");
    }
    this.elements?.trashList?.replaceChildren?.();
    ids.clear();
  }

  async startThumbnailBackfill() {
    if (
      this.thumbnailBackfillRunning ||
      this.destroyed ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }
    const pending = this.records.filter(
      (record) =>
        needsThumbnailBackfill(record) &&
        !this.thumbnailBackfillAttempted.has(record.id)
    );
    if (pending.length === 0) {
      return;
    }
    this.thumbnailBackfillRunning = true;
    try {
      await navigator.serviceWorker.ready;
      const controller = await waitForController();
      if (!controller) {
        return;
      }
      for (const record of pending) {
        if (this.destroyed) {
          return;
        }
        this.thumbnailBackfillAttempted.add(record.id);
        const registration = this.makeMediaRegistration(record);
        if (!registration) {
          continue;
        }
        try {
          await this.sendWorkerMessage(controller, registration);
          const result = await videoThumbnailFromUrl(
            new URL(
              `./__media/${encodeURIComponent(
                record.id
              )}?thumbnail=${Date.now()}`,
              window.location.href
            ).href
          );
          if (!result.frameCaptured || this.destroyed) {
            continue;
          }
          const metadata = await this.saveThumbnailBackfillResult(
            record,
            result
          );
          if (!metadata) {
            continue;
          }
          if (this.destroyed) {
            return;
          }
          this.records = this.records.map((item) =>
            item.id === record.id ? metadata : item
          );
          this.thumbnailFailed.delete(record.id);
          this.rebuildSearchIndex();
          this.renderGrid();
        } catch (error) {
          if (!this.destroyed) {
            console.error("视频缩略图补生成失败", error);
          }
        } finally {
          controller.postMessage({
            type: "unregister-media",
            mediaId: record.id,
          });
        }
      }
    } finally {
      this.thumbnailBackfillRunning = false;
      if (
        !this.destroyed &&
        this.records.some(
          (record) =>
            needsThumbnailBackfill(record) &&
            !this.thumbnailBackfillAttempted.has(record.id)
        )
      ) {
        window.setTimeout(() => {
          void this.startThumbnailBackfill();
        }, 0);
      }
    }
  }

  async saveThumbnailBackfillResult(record, result) {
    const currentEnvelope = await this.db.getMetaEnvelope(record.id);
    if (!currentEnvelope) {
      return null;
    }
    const trashedEnvelope = await this.db.getTrashMetaEnvelope?.(record.id);
    if (trashedEnvelope) {
      return null;
    }
    const current = await decryptMetadata(
      this.crypto,
      this.crypto.masterKey,
      currentEnvelope
    );
    const metadata = mergeThumbnailBackfillMetadata(current, result);
    const [thumbnailEnvelope, metadataEnvelope] = await Promise.all([
      encryptThumbnail(
        this.crypto,
        this.crypto.masterKey,
        record.id,
        result.blob
      ),
      encryptMetadata(this.crypto, this.crypto.masterKey, metadata),
    ]);
    await this.db.saveMedia(metadataEnvelope, thumbnailEnvelope);
    return metadata;
  }

  async importFiles(files) {
    const validFiles = files.filter((file) => inferKind(file));
    if (validFiles.length === 0) {
      this.showToast("请选择照片或视频");
      return;
    }

    const enoughSpace = await this.checkImportSpace(validFiles);
    if (!enoughSpace) {
      return;
    }

    if (validFiles.some((file) => file.size > LARGE_FILE_BYTES)) {
      this.showToast("较大文件将分块处理，请保持页面打开");
    }

    this.elements.mediaInput.disabled = true;
    this.elements.importProgress.hidden = false;
    this.elements.importBar.value = 0;
    this.elements.importPercent.textContent = "0%";
    this.elements.importLabel.textContent = "正在准备导入…";
    const totalBytes = validFiles.reduce((sum, file) => sum + file.size, 0);
    let completedBytes = 0;
    let imported = 0;

    try {
      for (let index = 0; index < validFiles.length; index += 1) {
        if (this.destroyed) {
          break;
        }
        const file = validFiles[index];
        const kind = inferKind(file);
        const mediaId = uid();
        this.currentImportId = mediaId;
        this.elements.importLabel.textContent = `正在加密：${
          file.name || `第 ${index + 1} 项`
        }`;

        try {
          const thumbnailResult = await createThumbnail(file, kind);
          const metadata = {
            name:
              file.name ||
              `${kind === "video" ? "视频" : "照片"}_${Date.now()}`,
            kind,
            mimeType: inferMimeType(file, kind),
            createdAt: Date.now(),
            type: "media",
            folderId: this.currentFolderId,
            duration:
              kind === "video" ? thumbnailResult.duration || null : null,
            thumbnailVersion:
              kind === "video" && thumbnailResult.frameCaptured ? 2 : 0,
          };
          const importedMetadata = await importFileInChunks({
            file,
            mediaId,
            key: this.crypto.masterKey,
            crypto: this.crypto,
            db: this.db,
            metadata,
            thumbnail: thumbnailResult.blob,
            shouldAbort: () => this.destroyed,
            onProgress: ({ written }) => {
              const current = completedBytes + written;
              const percent =
                totalBytes === 0
                  ? 100
                  : Math.min(100, Math.round((current / totalBytes) * 100));
              this.elements.importBar.value = percent;
              this.elements.importPercent.textContent = `${percent}%`;
              this.elements.importLabel.textContent = `已加密 ${formatSize(
                current
              )} / ${formatSize(totalBytes)} · ${file.name || "当前文件"}`;
            },
          });
          if (this.destroyed) {
            await this.db.deleteMedia(mediaId);
            break;
          }
          this.records.unshift({ ...importedMetadata, legacy: false });
          this.rebuildSearchIndex();
          imported += 1;
        } catch (error) {
          await this.db.deleteMedia(mediaId).catch(() => {});
          if (error?.name !== "AbortError" && !this.destroyed) {
            console.error("导入失败", error);
            this.showToast(
              `“${file.name || "所选文件"}”导入失败，其他文件会继续处理`
            );
          }
        } finally {
          completedBytes += file.size;
          this.currentImportId = null;
        }
      }
    } finally {
      this.elements.importProgress.hidden = true;
      this.elements.mediaInput.disabled = false;
    }

    if (this.destroyed) {
      return;
    }
    if (imported > 0) {
      this.records.sort(
        (left, right) => right.createdAt - left.createdAt
      );
      this.page = 0;
      this.renderGrid();
      this.renderFolders();
      this.showToast(`已导入 ${imported} 项`);
      void this.startThumbnailBackfill();
    }
  }

  async checkImportSpace(files) {
    if (
      !navigator.storage ||
      typeof navigator.storage.estimate !== "function"
    ) {
      return true;
    }
    try {
      const { quota = 0, usage = 0 } =
        await navigator.storage.estimate();
      if (!quota) {
        return true;
      }
      const required =
        files.reduce((sum, file) => sum + file.size, 0) * 1.03 +
        8 * 1024 * 1024;
      const available = Math.max(0, quota - usage);
      if (required > available) {
        const trashBytes = this.trashItems.reduce(
          (sum, item) => sum + (Number(item.storageSize) || 0),
          0
        );
        await showAlert(
          `可用空间约 ${formatSize(
            available
          )}，本次内容至少需要 ${formatSize(
            required
          )}。${
            trashBytes > 0
              ? `回收站约占 ${formatSize(
                  trashBytes
                )}，可清空回收站释放空间。`
              : "请先清理空间后再试。"
          }`,
          {
            title: "存储空间不足",
          }
        );
        return false;
      }
    } catch {
      // A failed estimate should not block local import.
    }
    return true;
  }

  async openViewer(record) {
    if (this.destroyed || record.kind === "text") {
      return;
    }
    this.closeViewer();
    record = await this.resolveLegacyReference(record);
    if (this.destroyed) {
      return;
    }
    this.viewerRecord = record;
    this.elements.viewerTitle.textContent = record.name;
    this.elements.viewerRename.hidden = record.legacy === true;
    this.resetViewerTransform();
    const isVideo = record.kind === "video";
    this.elements.viewer.classList.toggle("vplayer", isVideo);
    this.elements.viewer.classList.add("controls-visible");
    this.elements.viewerStage.className = isVideo
      ? "vstage"
      : "viewer-stage";
    this.elements.viewerStage.replaceChildren(
      this.makeViewerMessage("正在准备内容…")
    );
    this.elements.viewer.hidden = false;
    document.body.classList.add("panel-viewer-open");
    this.updateViewerNavigation();

    try {
      if (record.kind === "video" && !record.legacy) {
        await this.openStreamingVideo(record);
        return;
      }

      let blob;
      if (record.legacy) {
        const legacy = await this.db.getLegacyRecord(record.id);
        if (!legacy) {
          throw new Error("旧记录不存在");
        }
        const plain = await this.crypto.decrypt(
          legacy.ciphertext,
          legacy.iv,
          this.legacyKey
        );
        blob = new Blob([plain], { type: record.mimeType });
      } else {
        blob = await readOriginalBlob({
          db: this.db,
          crypto: this.crypto,
          key: this.crypto.masterKey,
          metadata: record,
          shouldAbort: () => this.destroyed,
        });
      }
      if (this.destroyed || this.viewerRecord?.id !== record.id) {
        return;
      }

      this.viewerBlob = blob;
      this.viewerOriginalUrl = URL.createObjectURL(blob);
      const media = document.createElement(isVideo ? "video" : "img");
      if (record.kind === "video") {
        media.playsInline = true;
        media.setAttribute("webkit-playsinline", "");
        media.autoplay = true;
        media.preload = "metadata";
      } else {
        media.alt = record.name;
        media.decoding = "async";
      }
      media.className = "viewer-media";
      media.src = this.viewerOriginalUrl;
      this.elements.viewerStage.replaceChildren(media);
      if (record.kind === "video") {
        this.bindVideoSeekControls(
          media,
          this.elements.viewerStage
        );
        this.mountPlyr(media);
      }
      this.resetViewerTransform();
    } catch (error) {
      console.error("内容准备失败", error);
      if (!this.destroyed) {
        this.elements.viewerStage.replaceChildren(
          this.makeViewerMessage("暂时无法打开此内容")
        );
      }
    }
  }

  async openStreamingVideo(record) {
    if (!("serviceWorker" in navigator)) {
      throw new Error("浏览器不支持流式预览");
    }
    await navigator.serviceWorker.ready;
    const controller = await waitForController();
    if (!controller) {
      throw new Error("播放服务尚未就绪，请重新打开应用");
    }

    const registration = this.makeMediaRegistration(record);
    if (!registration) {
      throw new Error("内容暂不可用");
    }
    await this.sendWorkerMessage(controller, registration);
    if (this.destroyed || this.viewerRecord?.id !== record.id) {
      return;
    }
    this.streamMediaId = record.id;
    this.streamPlaybackTime = 0;
    this.streamWasPlaying = true;
    this.streamRecoveryAttempts = 0;
    this.streamGeneration = 0;

    const video = document.createElement("video");
    video.className = "viewer-media";
    video.playsInline = true;
    video.setAttribute("webkit-playsinline", "");
    video.autoplay = true;
    video.preload = "metadata";
    video.addEventListener("timeupdate", () => {
      if (Number.isFinite(video.currentTime)) {
        this.streamPlaybackTime = video.currentTime;
      }
    });
    video.addEventListener("play", () => {
      this.streamWasPlaying = true;
    });
    video.addEventListener("pause", () => {
      this.streamWasPlaying = false;
    });
    video.addEventListener("error", () => {
      void this.recoverStreamingVideo(video, record);
    });
    video.src = `./__media/${encodeURIComponent(record.id)}`;
    const left = document.createElement("div");
    left.className = "vseek l";
    left.textContent = "−10 秒";
    left.setAttribute("aria-hidden", "true");
    const right = document.createElement("div");
    right.className = "vseek r";
    right.textContent = "+10 秒";
    right.setAttribute("aria-hidden", "true");
    this.elements.viewerStage.replaceChildren(video, left, right);
    this.bindVideoSeekControls(video, this.elements.viewerStage);
    this.mountPlyr(video);
  }

  mountPlyr(video) {
    if (typeof window.Plyr !== "function") {
      video.controls = true;
      return;
    }
    try {
      this.plyrPlayer?.destroy();
      const player = new window.Plyr(video, createPlyrOptions());
      this.plyrPlayer = player;
      player.on("controlshidden", () => {
        this.elements.viewer.classList.add("chrome-hidden");
      });
      player.on("controlsshown", () => {
        this.elements.viewer.classList.remove("chrome-hidden");
      });
    } catch (error) {
      console.error("视频播放器初始化失败", error);
      this.plyrPlayer = null;
      video.controls = true;
    }
  }

  bindVideoSeekControls(video, stage) {
    this.videoSeekAbortController?.abort();
    this.videoSeekAbortController = new AbortController();
    const { signal } = this.videoSeekAbortController;
    let lastTime = 0;
    let lastSide = "";
    const showBubble = (side) => {
      const bubble = stage.querySelector(`.vseek.${side}`);
      if (!bubble) {
        return;
      }
      bubble.classList.add("show");
      window.clearTimeout(bubble.showTimer);
      bubble.showTimer = window.setTimeout(() => {
        bubble.classList.remove("show");
      }, 500);
    };
    stage.addEventListener(
      "pointerup",
      (event) => {
        if (
          event.target.closest(
            ".plyr__controls,.plyr__menu__container,.plyr__control--overlaid"
          )
        ) {
          return;
        }
        const side = sideOf(
          event.clientX,
          stage.getBoundingClientRect()
        );
        const now = Date.now();
        if (side && side === lastSide && now - lastTime < 320) {
          const delta = side === "l" ? -10 : 10;
          const duration = Number.isFinite(video.duration)
            ? video.duration
            : 0;
          video.currentTime = Math.max(
            0,
            Math.min(duration, video.currentTime + delta)
          );
          showBubble(side);
          lastTime = 0;
          lastSide = "";
          return;
        }
        lastTime = now;
        lastSide = side;
      },
      { capture: true, signal }
    );
    stage.addEventListener(
      "dblclick",
      (event) => {
        if (
          sideOf(event.clientX, stage.getBoundingClientRect())
        ) {
          event.preventDefault();
          event.stopPropagation();
        }
      },
      { capture: true, signal }
    );
  }

  makeMediaRegistration(record) {
    if (
      !record ||
      record.kind === "text" ||
      record.legacy ||
      !this.crypto.masterKey
    ) {
      return null;
    }
    return {
      type: "register-media",
      mediaId: record.id,
      key: this.crypto.masterKey,
      metadata: {
        id: record.id,
        name: record.name,
        size: record.size,
        mimeType: record.mimeType,
        chunkSize: record.chunkSize,
        chunkCount: record.chunkCount,
      },
    };
  }

  waitForVideoMetadata(video) {
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        cleanup();
        reject(new Error("内容加载超时"));
      }, 6_000);
      const onLoaded = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error("内容暂不可用"));
      };
      const cleanup = () => {
        window.clearTimeout(timer);
        video.removeEventListener("loadedmetadata", onLoaded);
        video.removeEventListener("error", onError);
      };
      video.addEventListener("loadedmetadata", onLoaded, { once: true });
      video.addEventListener("error", onError, { once: true });
    });
  }

  async recoverStreamingVideo(video, record) {
    if (
      this.streamRecovering ||
      this.destroyed ||
      this.viewerRecord?.id !== record.id ||
      this.elements.viewerStage.querySelector(".viewer-media") !== video
    ) {
      return;
    }
    this.streamRecovering = true;
    const resumeAt = Math.max(
      this.streamPlaybackTime || 0,
      Number.isFinite(video.currentTime) ? video.currentTime : 0
    );
    const shouldPlay = this.streamWasPlaying || !video.paused;
    try {
      while (this.streamRecoveryAttempts < 3) {
        this.streamRecoveryAttempts += 1;
        const controller = await waitForController();
        const registration = this.makeMediaRegistration(record);
        if (!controller || !registration) {
          throw new Error("内容暂不可用");
        }
        await this.sendWorkerMessage(controller, registration);
        const loaded = this.waitForVideoMetadata(video);
        this.streamGeneration += 1;
        video.src = `./__media/${encodeURIComponent(
          record.id
        )}?recover=${this.streamGeneration}`;
        video.load();
        await loaded;
        if (
          this.destroyed ||
          this.viewerRecord?.id !== record.id
        ) {
          return;
        }
        if (resumeAt > 0 && Number.isFinite(video.duration)) {
          video.currentTime = Math.min(resumeAt, video.duration);
        }
        if (shouldPlay) {
          await video.play().catch(() => {});
        }
        this.streamRecoveryAttempts = 0;
        return;
      }
    } catch {
      if (this.streamRecoveryAttempts < 3) {
        window.setTimeout(() => {
          void this.recoverStreamingVideo(video, record);
        }, 250);
      } else if (
        !this.destroyed &&
        this.elements.viewerStage.querySelector(".viewer-media") === video
      ) {
        this.elements.viewerStage.replaceChildren(
          this.makeViewerMessage("暂时无法继续播放，请重新打开")
        );
      }
    } finally {
      this.streamRecovering = false;
    }
  }

  async sendWorkerMessage(controller, message) {
    const channel = new MessageChannel();
    await new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        reject(new Error("播放服务响应超时"));
      }, 4_000);
      channel.port1.onmessage = (event) => {
        window.clearTimeout(timer);
        if (event.data?.ok) {
          resolve();
        } else {
          reject(new Error(event.data?.error || "播放服务未就绪"));
        }
      };
      controller.postMessage(message, [channel.port2]);
    });
  }

  clearStream(mediaId = this.streamMediaId) {
    if (!mediaId || !("serviceWorker" in navigator)) {
      this.streamMediaId = null;
      return;
    }
    navigator.serviceWorker.controller?.postMessage({
      type: "unregister-media",
      mediaId,
    });
    this.streamMediaId = null;
    this.streamPlaybackTime = 0;
    this.streamRecoveryAttempts = 0;
  }

  updateViewerNavigation() {
    if (!this.elements?.viewerPrevious) {
      return;
    }
    const video = this.viewerRecord?.kind === "video";
    const records = this.viewerRecords();
    const index = records.findIndex(
      (record) => record.id === this.viewerRecord?.id
    );
    this.elements.viewerPrevious.hidden = video;
    this.elements.viewerNext.hidden = video;
    this.elements.viewerPrevious.disabled = index <= 0;
    this.elements.viewerNext.disabled =
      index < 0 || index >= records.length - 1;
  }

  async switchViewer(direction) {
    const records = this.viewerRecords();
    const index = records.findIndex(
      (record) => record.id === this.viewerRecord?.id
    );
    const target = records[index + direction];
    if (index < 0 || !target) {
      return;
    }
    await this.openViewer(target);
  }

  viewerRecords() {
    return this.visibleRecords().filter(
      (record) => record.kind !== "text"
    );
  }

  bindViewerGestures() {
    const stage = this.elements.viewerStage;
    let tapTimer = 0;
    stage.addEventListener("dblclick", (event) => {
      if (Date.now() < this.viewerSuppressDoubleClickUntil) {
        event.preventDefault();
        return;
      }
      if (
        this.viewerRecord?.kind === "image" &&
        event.target.closest(".viewer-media")
      ) {
        event.preventDefault();
        this.toggleViewerZoom();
      }
    });
    stage.addEventListener(
      "touchstart",
      (event) => {
        if (this.elements.viewer.hidden || this.destroyed) {
          return;
        }
        window.clearTimeout(tapTimer);
        if (event.touches.length === 2) {
          const [first, second] = event.touches;
          const distance = Math.hypot(
            second.clientX - first.clientX,
            second.clientY - first.clientY
          );
          this.viewerGesture = {
            mode: "pinch",
            startDistance: Math.max(1, distance),
            startScale: this.viewerScale,
            centerX: (first.clientX + second.clientX) / 2,
            centerY: (first.clientY + second.clientY) / 2,
            startTranslate: { ...this.viewerTranslate },
          };
          this.viewerTouchStart = null;
          event.preventDefault();
          return;
        }
        if (event.touches.length !== 1) {
          return;
        }
        const touch = event.touches[0];
        this.viewerTouchStart = {
          x: touch.clientX,
          y: touch.clientY,
          lastX: touch.clientX,
          lastY: touch.clientY,
          moved: false,
        };
        this.viewerGesture = {
          mode: this.viewerScale > 1 ? "pan" : "swipe",
          startTranslate: { ...this.viewerTranslate },
        };
      },
      { passive: false }
    );

    stage.addEventListener(
      "touchmove",
      (event) => {
        const gesture = this.viewerGesture;
        if (!gesture) {
          return;
        }
        if (gesture.mode === "pinch" && event.touches.length === 2) {
          const [first, second] = event.touches;
          const distance = Math.hypot(
            second.clientX - first.clientX,
            second.clientY - first.clientY
          );
          this.viewerScale = Math.min(
            5,
            Math.max(1, gesture.startScale * (distance / gesture.startDistance))
          );
          this.applyViewerTransform();
          event.preventDefault();
          return;
        }
        const touch = event.touches[0];
        const start = this.viewerTouchStart;
        if (!touch || !start) {
          return;
        }
        const dx = touch.clientX - start.x;
        const dy = touch.clientY - start.y;
        if (Math.hypot(dx, dy) > 8) {
          start.moved = true;
        }
        if (gesture.mode === "pan" && this.viewerScale > 1) {
          const stageRect = stage.getBoundingClientRect();
          const maxX = ((this.viewerScale - 1) * stageRect.width) / 2;
          const maxY = ((this.viewerScale - 1) * stageRect.height) / 2;
          this.viewerTranslate = {
            x: Math.max(
              -maxX,
              Math.min(maxX, gesture.startTranslate.x + dx)
            ),
            y: Math.max(
              -maxY,
              Math.min(maxY, gesture.startTranslate.y + dy)
            ),
          };
          this.applyViewerTransform();
          event.preventDefault();
        }
      },
      { passive: false }
    );

    stage.addEventListener(
      "touchend",
      (event) => {
        const start = this.viewerTouchStart;
        const gesture = this.viewerGesture;
        if (event.touches.length > 0) {
          if (event.touches.length === 1) {
            const touch = event.touches[0];
            this.viewerTouchStart = {
              x: touch.clientX,
              y: touch.clientY,
              lastX: touch.clientX,
              lastY: touch.clientY,
              moved: false,
            };
            this.viewerGesture = {
              mode: this.viewerScale > 1 ? "pan" : "swipe",
              startTranslate: { ...this.viewerTranslate },
            };
          }
          return;
        }
        this.viewerGesture = null;
        this.viewerTouchStart = null;
        if (this.viewerScale <= 1.02) {
          this.viewerScale = 1;
          this.viewerTranslate = { x: 0, y: 0 };
          this.applyViewerTransform();
        }
        if (!start || event.changedTouches.length !== 1) {
          return;
        }
        const touch = event.changedTouches[0];
        const distanceX = touch.clientX - start.x;
        const distanceY = touch.clientY - start.y;
        if (
          !start.moved &&
          this.viewerRecord?.kind === "image" &&
          Math.abs(distanceX) < 10 &&
          Math.abs(distanceY) < 10
        ) {
          const now = Date.now();
          if (now - this.viewerLastTap < 320) {
            this.viewerLastTap = 0;
            window.clearTimeout(tapTimer);
            this.viewerSuppressDoubleClickUntil = Date.now() + 600;
            event.preventDefault();
            this.toggleViewerZoom();
          } else {
            this.viewerLastTap = now;
            tapTimer = window.setTimeout(() => {
              this.toggleViewerControls();
            }, 300);
          }
          return;
        }
        if (
          this.viewerRecord?.kind === "image" &&
          this.viewerScale <= 1.02 &&
          Math.abs(distanceX) > 50 &&
          Math.abs(distanceX) > Math.abs(distanceY)
        ) {
          void this.switchViewer(distanceX < 0 ? 1 : -1);
        }
      },
      { passive: false }
    );
  }

  applyViewerTransform() {
    const media = this.elements.viewerStage.querySelector(".viewer-media");
    if (!media || this.viewerRecord?.kind !== "image") {
      return;
    }
    media.style.transform = `translate3d(${this.viewerTranslate.x}px, ${this.viewerTranslate.y}px, 0) scale(${this.viewerScale})`;
    this.elements.viewerStage.classList.toggle(
      "is-zoomed",
      this.viewerScale > 1.02
    );
  }

  toggleViewerZoom() {
    if (this.viewerScale > 1.02) {
      this.viewerScale = 1;
      this.viewerTranslate = { x: 0, y: 0 };
    } else {
      this.viewerScale = 2.2;
      this.viewerTranslate = { x: 0, y: 0 };
    }
    this.applyViewerTransform();
  }

  toggleViewerControls() {
    if (this.elements.viewer.hidden) {
      return;
    }
    this.viewerControlsVisible = !this.viewerControlsVisible;
    this.elements.viewer.classList.toggle(
      "controls-visible",
      this.viewerControlsVisible
    );
  }

  resetViewerTransform() {
    this.viewerScale = 1;
    this.viewerTranslate = { x: 0, y: 0 };
    this.viewerGesture = null;
    this.viewerTouchStart = null;
    this.viewerControlsVisible = true;
    this.elements?.viewer?.classList.add("controls-visible");
    this.applyViewerTransform();
  }

  makeViewerMessage(message) {
    const element = document.createElement("p");
    element.className = "viewer-message";
    element.textContent = message;
    return element;
  }

  closeViewer() {
    if (!this.elements?.viewer) {
      return;
    }
    this.videoSeekAbortController?.abort();
    this.videoSeekAbortController = null;
    try {
      this.plyrPlayer?.destroy();
    } catch {
      // A partially initialized Plyr instance may already be detached.
    }
    this.plyrPlayer = null;
    this.elements.viewer.hidden = true;
    this.elements.viewerStage.replaceChildren();
    this.elements.viewerStage.className = "viewer-stage";
    this.viewerRecord = null;
    this.viewerBlob = null;
    this.viewerTouchStart = null;
    this.viewerGesture = null;
    this.viewerLastTap = 0;
    this.viewerSuppressDoubleClickUntil = 0;
    this.viewerScale = 1;
    this.viewerTranslate = { x: 0, y: 0 };
    this.viewerControlsVisible = true;
    this.streamRecovering = false;
    this.elements.viewer.classList.remove(
      "controls-visible",
      "is-zoomed",
      "vplayer",
      "chrome-hidden"
    );
    this.elements.viewerPrevious.hidden = false;
    this.elements.viewerNext.hidden = false;
    this.clearStream();
    if (this.viewerOriginalUrl) {
      URL.revokeObjectURL(this.viewerOriginalUrl);
      this.viewerOriginalUrl = "";
    }
    document.body.classList.remove("panel-viewer-open");
  }

  async readRecordBlob(record) {
    if (
      this.viewerBlob &&
      this.viewerRecord?.id === record.id &&
      record.kind === this.viewerRecord.kind
    ) {
      return this.viewerBlob;
    }
    record = await this.resolveLegacyReference(record);
    if (record.legacy) {
      const legacy = await this.db.getLegacyRecord(record.id);
      if (!legacy) {
        throw new Error("旧记录不存在");
      }
      const plain = await this.crypto.decrypt(
        legacy.ciphertext,
        legacy.iv,
        this.legacyKey
      );
      return new Blob([plain], {
        type: record.mimeType || "application/octet-stream",
      });
    }
    return readOriginalBlob({
      db: this.db,
      crypto: this.crypto,
      key: this.crypto.masterKey,
      metadata: record,
      shouldAbort: () => this.destroyed,
    });
  }

  async resolveLegacyReference(record) {
    if (!record?.legacy) {
      return record;
    }
    if (await this.db.getLegacyRecord(record.id)) {
      return record;
    }
    const envelope = await this.db.getMetaEnvelope(record.id);
    if (!envelope) {
      return record;
    }
    try {
      const metadata = await decryptMetadata(
        this.crypto,
        this.crypto.masterKey,
        envelope
      );
      const resolved = { ...metadata, legacy: false };
      this.records = this.records.map((item) =>
        item.id === resolved.id ? resolved : item
      );
      this.rebuildSearchIndex();
      if (this.viewerRecord?.id === resolved.id) {
        this.viewerRecord = resolved;
      }
      return resolved;
    } catch {
      return record;
    }
  }

  downloadBlob(blob, filename, newContext = false) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename || "内容";
    anchor.rel = "noopener";
    if (newContext) {
      anchor.target = "_blank";
    }
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    this.exportUrls.add(url);
    window.setTimeout(() => {
      this.exportUrls.delete(url);
      URL.revokeObjectURL(url);
    }, 30_000);
  }

  async startLegacyMigration() {
    if (this.migrationStarted || this.destroyed) {
      return;
    }
    this.migrationStarted = true;

    try {
      const summaries = await this.db.getLegacySummaries();
      if (this.destroyed) {
        return;
      }
      if (summaries.length === 0) {
        await this.finalizeLegacyData({ notify: false });
        return;
      }
      if (!this.legacyKey) {
        this.elements.migrationLabel.textContent =
          "部分旧内容需要原解锁设置，暂未整理";
        return;
      }
      if (summaries.length > 0) {
        this.elements.migrationProgress.hidden = false;
      }
      let completed = 0;

      for (const summary of summaries) {
        if (this.destroyed) {
          return;
        }
        const record = await this.db.getLegacyRecord(summary.id);
        if (!record) {
          await this.db.deleteMedia(summary.id).catch(() => {});
          completed += 1;
          continue;
        }

        await this.db.putMigrationState({
          id: summary.id,
          status: "running",
          updatedAt: Date.now(),
        });
        this.elements.migrationLabel.textContent = `正在整理旧内容 ${
          completed + 1
        } / ${summaries.length}`;

        try {
          const migrated = await migrateLegacyRecord({
            legacy: record,
            legacyKey: this.legacyKey,
            masterKey: this.crypto.masterKey,
            crypto: this.crypto,
            db: this.db,
            shouldAbort: () => this.destroyed,
            onProgress: ({ written, total }) => {
              const before = summaries
                .slice(0, completed)
                .reduce((sum, item) => sum + Math.max(item.size, 1), 0);
              const allBytes = summaries.reduce(
                (sum, item) => sum + Math.max(item.size, 1),
                0
              );
              const percent = Math.min(
                100,
                Math.round(
                  ((before + written) /
                    Math.max(allBytes, 1)) *
                    100
                )
              );
              this.elements.migrationBar.value = percent;
              this.elements.migrationPercent.textContent = `${percent}%`;
            },
          });
          this.records = this.records.map((item) =>
            item.id === migrated.id
              ? { ...migrated, legacy: false }
              : item
          );
          this.rebuildSearchIndex();
          this.thumbnailFailed.clear();
          this.renderGrid();
          this.renderFolders();
          completed += 1;
        } catch (error) {
          if (error?.name === "AbortError" || this.destroyed) {
            return;
          }
          console.error("旧内容整理中断", error);
          await this.db
            .putMigrationState({
              id: summary.id,
              status: "pending",
              updatedAt: Date.now(),
            })
            .catch(() => {});
        }
      }

      if (this.destroyed) {
        return;
      }
      const remaining = await this.db.getLegacySummaries();
      if (remaining.length === 0) {
        await this.finalizeLegacyData();
      } else {
        this.elements.migrationLabel.textContent = "旧内容将在下次继续整理";
      }
    } catch (error) {
      console.error("旧内容整理失败", error);
    }
  }

  async finalizeLegacyData({ notify = true } = {}) {
    await this.db.finalizeLegacyMigration();
    let updatedAuth = this.auth;
    if (this.auth?.wrappedLegacyKey) {
      updatedAuth = { ...this.auth, wrappedLegacyKey: null };
      await this.db.replaceAuth(updatedAuth, this.auth);
      this.auth = updatedAuth;
      this.onAuthUpdated?.(updatedAuth);
    }
    this.legacyKey = null;
    this.elements.migrationBar.value = 100;
    this.elements.migrationPercent.textContent = "100%";
    await this.refreshRecords();
    if (this.destroyed) {
      return;
    }
    this.elements.migrationProgress.hidden = true;
    if (notify) {
      this.showToast("本地数据整理完成");
    }
  }

  updatePreferenceControls() {
    if (!this.elements) {
      return;
    }
    if (this.elements.showNamesToggle) {
      this.elements.showNamesToggle.checked =
        this.preferences.showNames;
    }
    this.renderGrid();
  }

  async updatePreferences(changes) {
    const previous = { ...this.preferences };
    const previousUnavailable = this.preferencesUnavailable;
    const albumThemeChanged =
      Object.prototype.hasOwnProperty.call(changes, "albumTheme") &&
      changes.albumTheme !== previous.albumTheme;
    const retentionSettingChanged = Object.prototype.hasOwnProperty.call(
      changes,
      "trashRetentionDays"
    );
    this.preferences = { ...this.preferences, ...changes };
    if (albumThemeChanged) {
      this.onAlbumThemeChanged?.(this.preferences.albumTheme);
    }
    this.renderGrid();
    try {
      this.preferences = await savePreferences({
        crypto: this.crypto,
        key: this.crypto.masterKey,
        db: this.db,
        preferences: this.preferences,
      });
      if (retentionSettingChanged) {
        this.preferencesUnavailable = false;
        await this.db.replaceTrashPurgeIndex(
          buildTrashPurgeEntries(
            this.trashItems,
            this.preferences.trashRetentionDays
          )
        );
      } else if (
        !previousUnavailable &&
        this.preferences.trashRetentionDays !==
          previous.trashRetentionDays
      ) {
        await this.db.replaceTrashPurgeIndex(
          buildTrashPurgeEntries(
            this.trashItems,
            this.preferences.trashRetentionDays
          )
        );
      }
      this.updatePreferenceControls();
    } catch (error) {
      console.error("保存列表偏好失败", error);
      this.preferences = previous;
      this.preferencesUnavailable = previousUnavailable;
      if (albumThemeChanged) {
        this.onAlbumThemeChanged?.(previous.albumTheme);
      }
      this.updatePreferenceControls();
      if (!this.destroyed) {
        this.showToast("设置保存失败，请重试");
      }
    }
  }

  updateTrashBadge() {
    if (!this.elements?.trashCount) {
      return;
    }
    const count = this.trashItems.length;
    this.elements.trashCount.textContent = String(count);
    this.elements.trashCount.hidden = count === 0;
  }

  openTrash() {
    if (this.destroyed) {
      return;
    }
    this.toastController?.hide();
    this.toastController = null;
    this.closeSettings();
    if (this.plusOpen) {
      this.closePlusMenu(true);
    }
    this.currentFolderId = null;
    this.activeTab = "trash";
    this.settingsSubpage = null;
    this.searchQuery = "";
    this.contentFilter = "all";
    this.searchOpen = false;
    this.elements.contentSearch.value = "";
    this.elements.clearSearchButton?.classList?.remove("show");
    this.closeSearch();
    this.selectionMode = false;
    this.selectedIds?.clear();
    this.selectedTrashIds?.clear();
    if (this.elements.album?.classList) {
      this.updatePageVisibility();
    }
    this.renderTrash();
    this.elements.trash.hidden = false;
    for (const button of this.elements.tabBar?.querySelectorAll?.(
      "[data-tab]"
    ) || []) {
      button.classList.toggle("on", button.dataset.tab === "trash");
    }
    this.updateShell();
  }

  renderTrash() {
    if (!this.elements?.trashList) {
      return;
    }
    const visibleItems = this.visibleTrashItems();
    const fragment = document.createDocumentFragment();
    for (const image of this.elements.trashList.querySelectorAll(
      "img[data-media-id]"
    )) {
      this.thumbnailObserver?.unobserve(image);
    }
    for (const item of visibleItems) {
      const row = document.createElement("div");
      const selected =
        this.selectionMode && this.selectedTrashIds.has(item.id);
      row.className = `row trow${selected ? " sel" : ""}`;
      row.dataset.trashId = item.id;
      row.dataset.flip = `trash:${item.id}`;
      if (this.selectionMode) {
        const lead = document.createElement("span");
        lead.className = "rsel";
        lead.innerHTML = selected ? ic("tick") : "";
        row.append(lead);
      }
      const icon = document.createElement("span");
      icon.className = "tthumb";
      if (item.trashType === "folder") {
        icon.innerHTML = ic("folder");
      } else if (item.kind === "text") {
        icon.innerHTML = ic("filetext");
      } else {
        const image = document.createElement("img");
        image.className = "tthumb-image";
        image.dataset.mediaId = item.id;
        image.alt = "";
        image.loading = "lazy";
        image.decoding = "async";
        image.draggable = false;
        icon.append(image);
        this.thumbnailObserver?.observe(image);
      }
      const copy = document.createElement("span");
      copy.className = "tmeta";
      const name = document.createElement("b");
      this.setHighlightedText(name, item.displayName || "内容");
      const detail = document.createElement("small");
      detail.textContent = trashRemainingLabel({
        item,
        retentionDays: this.preferences.trashRetentionDays,
        preferencesUnavailable: this.preferencesUnavailable,
      });
      copy.append(name, detail);
      const actions = document.createElement("div");
      actions.className = "tacts";
      const restore = document.createElement("button");
      restore.type = "button";
      restore.className = "txtbtn";
      restore.dataset.trashInline = "restore";
      restore.dataset.trashId = item.id;
      restore.textContent = "恢复";
      const purge = document.createElement("button");
      purge.type = "button";
      purge.className = "txtbtn danger";
      purge.dataset.trashInline = "purge";
      purge.dataset.trashId = item.id;
      purge.textContent = "删除";
      if (!this.selectionMode) {
        actions.append(restore, purge);
        row.append(icon, copy, actions);
      } else {
        row.append(icon, copy);
      }
      fragment.append(row);
    }
    this.elements.trashList.replaceChildren(fragment);
    this.elements.trashList.hidden = visibleItems.length === 0;
    this.elements.trashEmpty.hidden = visibleItems.length !== 0;
    const bytes = this.trashItems.reduce(
      (sum, item) => sum + (Number(item.storageSize) || 0),
      0
    );
    this.elements.trashSummary.textContent = this.trashItems.length
      ? `${visibleItems.length} 项 · 内容约 ${formatSize(bytes)}${
          this.preferencesUnavailable
            ? " · 自动清理已暂停"
            : this.preferences.trashRetentionDays === null
              ? " · 不会自动删除"
              : ` · ${this.preferences.trashRetentionDays} 天后清理`
        }`
      : "0 项";
    this.updateTrashSelectionUi();
    this.updateSelectionUi();
  }

  updateTrashSelectionUi() {
    if (!this.elements?.trash) {
      return;
    }
    for (const row of this.elements.trashList.querySelectorAll(
      "[data-trash-id]"
    )) {
      const selected = this.selectedTrashIds.has(row.dataset.trashId);
      row.classList.toggle("sel", selected);
      const mark = row.querySelector(".rsel");
      if (mark) {
        mark.innerHTML = selected ? ic("tick") : "";
      }
    }
  }

  async restoreTrashItem(id) {
    const item = this.trashItems.find((entry) => entry.id === id);
    if (!item || this.destroyed) {
      return;
    }
    try {
      await restoreTrashItems({
        crypto: this.crypto,
        key: this.crypto.masterKey,
        db: this.db,
        items: [item],
        existingFolderIds: new Set(
          this.folders.map((folder) => folder.id)
        ),
      });
      await this.refreshRecords();
      if (!this.destroyed) {
        this.showToast("已恢复");
      }
    } catch (error) {
      console.error("恢复回收站内容失败", error);
      if (!this.destroyed) {
        this.showToast("恢复失败，请重试");
      }
    }
  }

  async purgeTrashItem(id) {
    const item = this.trashItems.find((entry) => entry.id === id);
    if (!item || this.destroyed) {
      return;
    }
    const confirmed = await showConfirm("删除后无法恢复", {
      title: "永久删除？",
      confirmText: "删除",
      cancelText: "取消",
      danger: true,
    });
    if (!confirmed || this.destroyed) {
      return;
    }
    try {
      await purgeTrashItems({ db: this.db, items: [item] });
      await this.refreshRecords();
      if (!this.destroyed) {
        this.showToast("已删除");
      }
    } catch (error) {
      console.error("彻底删除失败", error);
      if (!this.destroyed) {
        this.showToast("删除失败，请重试");
      }
    }
  }

  toggleTrashSelection(id) {
    if (this.selectedTrashIds.has(id)) {
      this.selectedTrashIds.delete(id);
    } else {
      this.selectedTrashIds.add(id);
    }
    this.updateTrashSelectionUi();
    this.updateSelectionUi();
  }

  selectedTrashItems() {
    return this.trashItems.filter((item) =>
      this.selectedTrashIds.has(item.id)
    );
  }

  async restoreTrashWithUndo(items) {
    if (this.destroyed || items.length === 0) {
      return;
    }
    try {
      await restoreTrashItems({
        crypto: this.crypto,
        key: this.crypto.masterKey,
        db: this.db,
        items,
        existingFolderIds: new Set(
          this.folders.map((folder) => folder.id)
        ),
      });
      this.selectedTrashIds.clear();
      this.selectionMode = false;
      await this.refreshRecords();
      if (!this.destroyed) {
        this.showToast("已恢复");
      }
    } catch (error) {
      console.error("撤销删除失败", error);
      if (!this.destroyed) {
        this.showToast("恢复失败，请到回收站重试");
      }
    }
  }

  async restoreSelectedTrash() {
    const items = this.selectedTrashItems();
    if (items.length === 0 || this.destroyed) {
      return;
    }
    try {
      await restoreTrashItems({
        crypto: this.crypto,
        key: this.crypto.masterKey,
        db: this.db,
        items,
        existingFolderIds: new Set(
          this.folders.map((folder) => folder.id)
        ),
      });
      this.selectedTrashIds.clear();
      this.selectionMode = false;
      await this.refreshRecords();
      if (!this.destroyed) {
        this.showToast("已恢复");
      }
    } catch (error) {
      console.error("恢复回收站内容失败", error);
      if (!this.destroyed) {
        this.showToast("恢复失败，请重试");
      }
    }
  }

  async purgeSelectedTrash() {
    const items = this.selectedTrashItems();
    if (items.length === 0 || this.destroyed) {
      return;
    }
    const confirmed = await showConfirm("删除后无法恢复", {
      title: "永久删除？",
      confirmText: "删除",
      cancelText: "取消",
      danger: true,
    });
    if (!confirmed || this.destroyed) {
      return;
    }
    try {
      await purgeTrashItems({ db: this.db, items });
      this.selectedTrashIds.clear();
      this.selectionMode = false;
      await this.refreshRecords();
      if (!this.destroyed) {
        this.showToast("已删除");
      }
    } catch (error) {
      console.error("彻底删除失败", error);
      if (!this.destroyed) {
        this.showToast("彻底删除失败，请重试");
      }
    }
  }

  async emptyTrash() {
    if (this.trashItems.length === 0 || this.destroyed) {
      return;
    }
    const confirmed = await showConfirm(
      `将永久删除全部 ${this.trashItems.length} 个文件，无法恢复`,
      {
        title: "清空回收站？",
        confirmText: "清空",
        cancelText: "取消",
        danger: true,
      }
    );
    if (!confirmed || this.destroyed) {
      return;
    }
    try {
      await purgeTrashItems({
        db: this.db,
        items: this.trashItems,
      });
      this.selectedTrashIds.clear();
      this.selectionMode = false;
      await this.refreshRecords();
      if (!this.destroyed) {
        this.showToast("已清空");
      }
    } catch (error) {
      console.error("清空回收站失败", error);
      if (!this.destroyed) {
        this.showToast("清空失败，请重试");
      }
    }
  }

  closeSettings() {
    if (!this.elements?.settings) {
      return;
    }
    if (this.activeTab === "settings") {
      this.switchTab("home");
    } else {
      this.elements.settings.hidden = true;
    }
  }

  renderSettingsView() {
    if (!this.elements?.settings || this.destroyed) {
      return;
    }
    this.calcThemePreference = readCalcThemePreference();
    const themeRow = (kind, label, current) => `
      <div class="row segrow labeled">
        <span>${label}</span>
        <div class="seg">
          ${["system", "day", "night"]
            .map(
              (value) => `
                <button
                  type="button"
                  data-settings-action="theme"
                  data-theme-kind="${kind}"
                  data-theme-value="${value}"
                  class="${current === value ? "on" : ""}"
                  aria-pressed="${current === value}"
                >${
                  { system: "跟随系统", day: "白天", night: "黑夜" }[
                    value
                  ]
                }</button>`
            )
            .join("")}
        </div>
      </div>`;

    let content = "";
    if (this.settingsSubpage === "pin") {
      content = `
        <div class="page subpage">
          <div class="gh">解锁码</div>
          <div class="group">
            <label class="row frow" for="old-pin">
              <span class="lab">当前解锁码</span>
              <input id="old-pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="off" placeholder="请输入">
            </label>
            <label class="row frow" for="new-pin">
              <span class="lab">新解锁码</span>
              <input id="new-pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="new-password" placeholder="4–8 位数字">
            </label>
            <label class="row frow" for="new-pin-confirm">
              <span class="lab">确认新解锁码</span>
              <input id="new-pin-confirm" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="new-password" placeholder="再次输入">
            </label>
          </div>
          <p id="settings-error" class="ferr" role="alert" aria-live="assertive"></p>
          <p class="gf">解锁码为 4–8 位数字。在首页贷款金额中输入并点击计算即可进入。</p>
          <button id="change-pin-button" class="cta" type="submit">保存</button>
        </div>`;
    } else if (this.settingsSubpage === "wipe") {
      const configured = Boolean(this.destructRecord);
      content = `
        <div class="page subpage">
          <div class="gh">状态</div>
          <div class="group">
            <div class="row">
              <span>当前状态</span>
              <span class="v" id="destruct-status">${configured ? "已配置" : "未配置"}</span>
            </div>
          </div>
          <div class="infocard">配置后，在首页输入此码并点击计算，将清除本机所有内容，且无法恢复。须与解锁码不同。</div>
          <div class="gh">设置清除码</div>
          <div class="group">
            <label class="row frow" for="destruct-current-pin">
              <span class="lab">当前解锁码</span>
              <input id="destruct-current-pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="off" placeholder="请输入">
            </label>
            <label class="row frow" for="destruct-code">
              <span class="lab">清除码</span>
              <input id="destruct-code" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="new-password" placeholder="4–8 位数字">
            </label>
            <label class="row frow" for="destruct-confirm">
              <span class="lab">确认清除码</span>
              <input id="destruct-confirm" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="new-password" placeholder="再次输入">
            </label>
          </div>
          <p id="destruct-error" class="ferr" role="alert" aria-live="assertive"></p>
          <button id="save-destruct-button" class="cta" type="button" data-settings-action="save-destruct">保存</button>
          <button id="remove-destruct-button" class="dangerbtn" type="button" data-settings-action="remove-destruct" ${configured ? "" : "disabled"}>关闭紧急清除</button>
        </div>`;
    } else if (this.settingsSubpage === "retention") {
      content = `
        <div class="page subpage">
          <div class="gh">删除后保留</div>
          <div class="group">
            ${retentionOptions(this.preferences.trashRetentionDays)
              .map(
                (value) => `
                  <button type="button" class="row" data-settings-action="retention" data-retention-days="${value === null ? "never" : value}">
                    <span>${retentionLabel(value)}</span>
                    ${
                      value === this.preferences.trashRetentionDays
                        ? `<span class="ck">${ic("tick")}</span>`
                        : ""
                    }
                  </button>`
              )
              .join("")}
          </div>
          <p class="gf">到期的文件会在打开应用时自动删除</p>
        </div>`;
    } else {
      const configured = Boolean(this.destructRecord);
      content = `
        <div class="page">
          <div class="gh">外观</div>
          <div class="group">
            ${themeRow(
              "calc",
              "计算器外观",
              this.calcThemePreference
            )}
            ${themeRow(
              "album",
              "相册外观",
              this.preferences.albumTheme
            )}
          </div>
          <p class="gf">计算器外观只能在这里修改，建议设为固定，避免外观无故变化</p>
          <div class="gh">显示</div>
          <div class="group">
            <button id="show-names-toggle" type="button" class="row" data-settings-action="toggle-names" aria-pressed="${this.preferences.showNames}">
              <span>显示文件名称</span>
              <span class="toggle ${this.preferences.showNames ? "on" : ""}"></span>
            </button>
          </div>
          <div class="gh">回收站</div>
          <div class="group">
            <button type="button" class="row" data-settings-action="open-retention">
              <span>回收站保留时间</span>
              <span class="v">${retentionLabel(this.preferences.trashRetentionDays)}${ic("chev")}</span>
            </button>
          </div>
          <div class="gh">安全</div>
          <div class="group">
            <button type="button" class="row" data-settings-action="open-pin">
              <span>解锁码</span>
              <span class="v">修改${ic("chev")}</span>
            </button>
            <button type="button" class="row" data-settings-action="open-wipe">
              <span>紧急清除码</span>
              <span class="v">${configured ? "已配置" : "未配置"}${ic("chev")}</span>
            </button>
          </div>
          <div class="gh">数据</div>
          <div class="group">
            <button type="button" class="row danger-row" id="wipe-button" data-settings-action="wipe">
              <span>清除全部本地数据</span>
            </button>
          </div>
          <div class="gh">关于</div>
          <div class="group">
            <div class="row">
              <span>版本</span>
              <span id="app-version" class="v" aria-label="应用版本">${this.appVersion}</span>
            </div>
          </div>
        </div>`;
    }
    this.elements.settings.innerHTML = `
      <form id="settings-form" class="settings-form" autocomplete="off" novalidate>
        ${content}
      </form>`;
    this.captureSettingsElements();
    this.updatePageVisibility();
    this.updateShell();
  }

  async handleSettingsAction(button) {
    const action = button.dataset.settingsAction;
    if (action === "open-pin") {
      this.settingsSubpage = "pin";
      this.renderSettingsView();
      this.elements.body.scrollTop = 0;
      return;
    }
    if (action === "open-wipe") {
      this.settingsSubpage = "wipe";
      this.renderSettingsView();
      this.elements.body.scrollTop = 0;
      return;
    }
    if (action === "open-retention") {
      this.settingsSubpage = "retention";
      this.renderSettingsView();
      this.elements.body.scrollTop = 0;
      return;
    }
    if (action === "back") {
      this.settingsSubpage = null;
      this.renderSettingsView();
      this.elements.body.scrollTop = 0;
      return;
    }
    if (action === "theme") {
      const value = button.dataset.themeValue;
      if (button.dataset.themeKind === "calc") {
        this.calcThemePreference = value;
        if (!writeCalcThemePreference(globalThis.localStorage, value)) {
          this.showToast("计算器外观保存失败");
        }
        this.renderSettingsView();
      } else {
        await this.updatePreferences({ albumTheme: value });
        this.renderSettingsView();
      }
      return;
    }
    if (action === "toggle-names") {
      await this.updatePreferences({
        showNames: !this.preferences.showNames,
      });
      this.renderSettingsView();
      return;
    }
    if (action === "retention") {
      const value = button.dataset.retentionDays;
      await this.updatePreferences({
        trashRetentionDays:
          value === "never" ? null : Number(value),
      });
      this.renderSettingsView();
      return;
    }
    if (action === "save-destruct") {
      await this.saveDestructCode();
      return;
    }
    if (action === "remove-destruct") {
      await this.removeDestructCode();
      return;
    }
    if (action === "wipe") {
      await this.wipeAllData();
    }
  }

  updateDestructControls() {
    if (!this.elements?.destructStatus) {
      return;
    }
    this.elements.destructStatus.textContent = this.destructRecord
      ? "已配置"
      : "未配置";
    this.elements.removeDestructButton.hidden = !this.destructRecord;
  }

  showFormError(errorElement, message, fieldIds = []) {
    if (!errorElement) {
      return;
    }
    errorElement.textContent = message;
    const page = errorElement.closest(".page");
    for (const row of page?.querySelectorAll(".frow.err") || []) {
      row.classList.remove("err");
    }
    for (const id of fieldIds) {
      page
        ?.querySelector(`#${id}`)
        ?.closest(".frow")
        ?.classList.add("err");
    }
  }

  async saveDestructCode() {
    if (this.destroyed) {
      return;
    }
    const currentPin = this.elements.destructCurrentPin.value;
    const code = this.elements.destructCode.value;
    const confirmation = this.elements.destructConfirm.value;
    this.showFormError(this.elements.destructError, "");

    if (!/^\d{4,8}$/.test(currentPin)) {
      this.showFormError(
        this.elements.destructError,
        "请输入当前解锁码",
        ["destruct-current-pin"]
      );
      return;
    }
    if (!/^\d{4,8}$/.test(code)) {
      this.showFormError(
        this.elements.destructError,
        "清除码必须为 4–8 位数字",
        ["destruct-code"]
      );
      return;
    }
    if (code !== confirmation) {
      this.showFormError(
        this.elements.destructError,
        "两次输入的清除码不一致",
        ["destruct-code", "destruct-confirm"]
      );
      return;
    }
    if (code === currentPin) {
      this.showFormError(
        this.elements.destructError,
        "清除码不能与解锁码相同",
        ["destruct-code"]
      );
      return;
    }

    const button = this.elements.saveDestructButton;
    button.disabled = true;
    button.textContent = "正在验证…";
    try {
      const session = await this.crypto.unlock(currentPin, this.auth);
      if (!session || this.destroyed) {
        this.showFormError(
          this.elements.destructError,
          "当前解锁码不正确",
          ["destruct-current-pin"]
        );
        return;
      }
      const record = await this.crypto.createDestructRecord(
        code,
        currentPin
      );
      await this.db.saveSetting(record);
      if (this.destroyed) {
        return;
      }
      this.destructRecord = record;
      this.onDestructUpdated?.(record);
      this.elements.destructCurrentPin.value = "";
      this.elements.destructCode.value = "";
      this.elements.destructConfirm.value = "";
      this.renderSettingsView();
      this.showToast("清除码已保存");
    } catch (error) {
      console.error("保存清除码失败", error);
      if (!this.destroyed) {
        this.showFormError(
          this.elements.destructError,
          error.message.includes("不能与解锁码相同")
            ? "清除码不能与解锁码相同"
            : "保存失败，请重试",
          error.message.includes("不能与解锁码相同")
            ? ["destruct-code"]
            : []
        );
      }
    } finally {
      if (!this.destroyed) {
        button.disabled = false;
        button.textContent = "保存";
      }
    }
  }

  async removeDestructCode() {
    if (!this.destructRecord || this.destroyed) {
      return;
    }
    const currentPin = this.elements.destructCurrentPin.value;
    if (!/^\d{4,8}$/.test(currentPin)) {
      this.showFormError(
        this.elements.destructError,
        "请输入当前解锁码",
        ["destruct-current-pin"]
      );
      return;
    }
    const confirmed = await showConfirm("确定关闭应急清除码吗？", {
      title: "关闭清除码",
      confirmText: "关闭",
      cancelText: "取消",
      danger: true,
    });
    if (!confirmed || this.destroyed) {
      return;
    }
    try {
      const session = await this.crypto.unlock(currentPin, this.auth);
      if (!session || this.destroyed) {
        this.showFormError(
          this.elements.destructError,
          "当前解锁码不正确",
          ["destruct-current-pin"]
        );
        return;
      }
      await this.db.deleteSetting("destruct");
      if (this.destroyed) {
        return;
      }
      this.destructRecord = null;
      this.onDestructUpdated?.(null);
      this.elements.destructCurrentPin.value = "";
      this.renderSettingsView();
      this.showToast("清除码已关闭");
    } catch (error) {
      console.error("关闭清除码失败", error);
      if (!this.destroyed) {
        this.showFormError(
          this.elements.destructError,
          "关闭失败，请重试"
        );
      }
    }
  }

  async changeCode() {
    if (this.destroyed) {
      return;
    }

    const oldPin = this.elements.oldPin.value;
    const newPin = this.elements.newPin.value;
    const confirmation = this.elements.newPinConfirm.value;
    this.showFormError(this.elements.settingsError, "");

    if (!/^\d{4,8}$/.test(oldPin)) {
      this.showFormError(
        this.elements.settingsError,
        "当前解锁码必须为 4–8 位数字",
        ["old-pin"]
      );
      return;
    }
    if (!/^\d{4,8}$/.test(newPin)) {
      this.showFormError(
        this.elements.settingsError,
        "新解锁码必须为 4–8 位数字",
        ["new-pin"]
      );
      return;
    }
    if (newPin !== confirmation) {
      this.showFormError(
        this.elements.settingsError,
        "两次输入的新解锁码不一致",
        ["new-pin", "new-pin-confirm"]
      );
      return;
    }
    const submitButton = this.elements.changePinButton;
    submitButton.disabled = true;
    submitButton.textContent = "正在更新设置…";
    try {
      const result = await this.crypto.rewrapMasterKey(
        oldPin,
        newPin,
        this.auth,
        this.destructRecord
      );
      await this.db.replaceAuth(result.auth, this.auth);
      if (this.destroyed) {
        return;
      }
      this.auth = result.auth;
      this.crypto.installKey(result.key);
      this.onAuthUpdated(result.auth);
      this.settingsSubpage = null;
      this.renderSettingsView();
      this.showToast("解锁码已修改");
    } catch (error) {
      const expectedError =
        error.message === "原解锁码不正确" ||
        error.message === "新解锁码不能与清除码相同";
      if (!expectedError) {
        console.error("修改解锁码失败", error);
      }
      if (!this.destroyed) {
        if (expectedError) {
          this.showFormError(
            this.elements.settingsError,
            error.message,
            error.message === "原解锁码不正确"
              ? ["old-pin"]
              : ["new-pin"]
          );
        } else {
          this.showFormError(
            this.elements.settingsError,
            "更新失败，原设置未改变"
          );
        }
      }
    } finally {
      if (!this.destroyed) {
        submitButton.disabled = false;
        submitButton.textContent = "保存";
      }
    }
  }

  async wipeAllData() {
    const confirmed = await showConfirm(
      "确定清除全部本机内容吗？解锁设置和所有加密内容将被永久删除。",
      {
        title: "清除全部数据",
        confirmText: "清除",
        cancelText: "取消",
        danger: true,
      }
    );
    if (!confirmed) {
      return;
    }

    try {
      await this.db.wipe();
      this.onLock();
      window.location.reload();
    } catch (error) {
      console.error("清除数据失败", error);
      await showAlert("清除数据失败，请关闭其他应用窗口后重试。", {
        title: "操作未完成",
      });
    }
  }

  async requestPersistentStorage() {
    try {
      if (
        navigator.storage &&
        typeof navigator.storage.persist === "function" &&
        !(await navigator.storage.persisted())
      ) {
        await navigator.storage.persist();
      }
    } catch {
      // Persistence is best-effort.
    }
  }

  showToast(message, options = {}) {
    if (this.destroyed) {
      return null;
    }
    this.toastController?.hide();
    this.toastController = showUiToast(message, {
      ...options,
    });
    return this.toastController;
  }

  destroy() {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.longPress.destroy();
    window.clearTimeout(this.textSaveTimer);
    window.clearTimeout(this.documentFocusTimer);
    window.clearTimeout(this.searchTimer);
    window.clearTimeout(this.plusCloseTimer);
    this.textSaveTimer = 0;
    this.documentEditor?.destroy();
    this.documentEditor = null;
    this.textDraft = null;
    this.selectionMode = false;
    this.selectedIds.clear();
    this.selectedTrashIds.clear();
    if (this.pendingShare) {
      this.pendingShare.resolve({ status: "cancelled" });
      this.pendingShare = null;
    }
    if (this.exportJob) {
      this.exportJob.cancelled = true;
    }
    this.thumbnailObserver?.disconnect();
    this.loadObserver?.disconnect();
    this.thumbnailQueue.length = 0;
    this.thumbnailQueued.clear();
    this.thumbnailLoading.clear();
    this.trashThumbnailIds.clear();
    endSystemPanel();
    this.toastController?.hide();
    this.toastController = null;
    closeAllDialogs();
    window.removeEventListener("keydown", this.handleGlobalKey);
    window.visualViewport?.removeEventListener(
      "resize",
      this.handleDocumentViewportChange
    );
    window.visualViewport?.removeEventListener(
      "scroll",
      this.handleDocumentViewportChange
    );
    window.removeEventListener(
      "resize",
      this.handleDocumentViewportChange
    );
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.removeEventListener(
        "message",
        this.handleServiceWorkerMessage
      );
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        this.handleControllerChange
      );
    }

    this.clearStream();
    navigator.serviceWorker?.controller?.postMessage({
      type: "clear-media-keys",
    });
    if (this.currentImportId) {
      void this.db.deleteMedia(this.currentImportId).catch(() => {});
    }
    if (this.elements?.viewer) {
      this.closeViewer();
    }
    for (const url of this.exportUrls) {
      URL.revokeObjectURL(url);
    }
    for (const frame of this.downloadFrames) {
      frame.remove();
    }
    this.exportUrls.clear();
    this.downloadFrames.clear();
    this.thumbnailCache.clear();
    this.trashThumbnailIds.clear();
    this.records = [];
    this.folders = [];
    this.root = null;
    this.host.replaceChildren();
    document.body.classList.remove("panel-viewer-open");
    document.body.classList.remove("panel-selecting");
    document.body.classList.remove("document-open");
  }
}
