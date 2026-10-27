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
  removeFolder,
  saveFolder,
  saveText,
} from "./content.js";
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
  purgeExpiredTrash,
  purgeTrashItems,
  restoreTrashItems,
  trashContentRecords,
  trashRemainingDays,
} from "./trash.js";

const THUMBNAIL_QUALITY = 0.82;
const PAGE_SIZE = 48;
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

function formatDuration(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(value / 3_600);
  const minutes = Math.floor((value % 3_600) / 60);
  const remainder = value % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(
        remainder
      ).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(
        2,
        "0"
      )}`;
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
  <section class="panel" aria-label="本地内容">
    <header class="panel-header">
      <div>
        <p class="eyebrow">仅保存在此设备</p>
        <h1>本地内容</h1>
      </div>
      <div class="header-actions">
        <button class="header-button" type="button" data-panel-action="select">选择</button>
        <button class="header-button" type="button" data-panel-action="settings">设置</button>
        <button class="header-button header-button-primary" type="button" data-panel-action="lock">锁定</button>
      </div>
    </header>

    <main class="panel-main">
      <div class="panel-toolbar">
        <label class="import-button">
          <span aria-hidden="true">＋</span>
          导入照片或视频
          <input id="media-input" type="file" accept="image/*,video/*" multiple hidden>
        </label>
        <button id="new-text-button" class="toolbar-action" type="button">新建文本</button>
        <button id="new-folder-button" class="toolbar-action" type="button">新建文件夹</button>
        <button id="trash-button" class="toolbar-action" type="button" data-panel-action="trash">回收站 <span id="trash-count">0</span></button>
        <label class="name-toggle">
          <span>显示名称</span>
          <input id="show-names-toggle" type="checkbox" checked>
          <i aria-hidden="true"></i>
        </label>
        <span id="media-count" class="media-count">0 项</span>
      </div>

      <nav id="folder-breadcrumb" class="folder-breadcrumb" aria-label="当前位置" hidden>
        <button id="folder-back" type="button">返回</button>
        <strong id="folder-title"></strong>
      </nav>

      <section class="library-search" aria-label="搜索和筛选">
        <label class="search-field" for="content-search">
          <span aria-hidden="true">⌕</span>
          <input id="content-search" type="search" placeholder="搜索名称、标题或正文" autocomplete="off" spellcheck="false">
        </label>
        <nav id="content-filters" class="content-filters" aria-label="内容类型">
          <button class="is-active" type="button" data-content-filter="all" aria-pressed="true">全部</button>
          <button type="button" data-content-filter="image" aria-pressed="false">图片</button>
          <button type="button" data-content-filter="video" aria-pressed="false">视频</button>
          <button type="button" data-content-filter="document" aria-pressed="false">文档</button>
        </nav>
      </section>

      <section id="folder-section" class="folder-section" aria-label="文件夹">
        <div class="section-heading">
          <h2>文件夹</h2>
          <span id="folder-count">0 个</span>
        </div>
        <div id="folder-grid" class="folder-grid"></div>
      </section>

      <div id="migration-progress" class="import-progress migration-progress" hidden>
        <div>
          <span id="migration-label">正在整理旧数据…</span>
          <span id="migration-percent">0%</span>
        </div>
        <progress id="migration-bar" max="100" value="0">0%</progress>
        <p class="progress-note">可随时离开，下次解锁后会继续。</p>
      </div>

      <div id="import-progress" class="import-progress" hidden>
        <div>
          <span id="import-label">正在加密导入…</span>
          <span id="import-percent">0%</span>
        </div>
        <progress id="import-bar" max="100" value="0">0%</progress>
        <p class="progress-note">请勿离开此页面。写入中的分块会在中断时清理。</p>
      </div>

      <div id="export-progress" class="import-progress export-progress" hidden>
        <div>
          <span id="export-label">正在准备导出…</span>
          <span id="export-percent">0%</span>
          <button id="export-cancel" class="inline-cancel" type="button">取消</button>
          <button id="export-share-button" class="inline-cancel inline-share" type="button" hidden>打开分享面板</button>
        </div>
        <progress id="export-bar" max="100" value="0">0%</progress>
        <p class="progress-note">正在逐块解密并准备文件，可随时取消。</p>
      </div>

      <div id="media-grid" class="media-grid"></div>
      <nav id="media-pager" class="media-pager" aria-label="内容分页" hidden>
        <button id="page-previous" class="pager-button" type="button">上一页</button>
        <span id="page-status">第 1 / 1 页</span>
        <button id="page-next" class="pager-button" type="button">下一页</button>
      </nav>
      <div id="empty-state" class="empty-state">
        <div class="empty-icon" aria-hidden="true"><span></span></div>
        <h2>这里还是空的</h2>
        <p>新建文本或导入照片、视频后，内容会加密保存在此设备中。</p>
      </div>
    </main>

    <footer id="selection-actions" class="selection-actions" hidden>
      <button id="select-all-button" type="button">全选</button>
      <button type="button" data-selection-action="export">存储/分享</button>
      <button type="button" data-selection-action="move">移动到…</button>
      <button class="is-danger" type="button" data-selection-action="delete">删除</button>
    </footer>
  </section>

  <section id="settings-panel" class="panel-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" hidden>
    <form id="settings-form" class="panel-sheet" autocomplete="off" novalidate>
      <div class="sheet-header">
        <div>
          <p class="eyebrow">安全设置</p>
          <h2 id="settings-title">本地设置</h2>
        </div>
        <button class="icon-button" type="button" data-settings-action="close" aria-label="关闭设置">关闭</button>
      </div>

      <fieldset>
        <legend>修改解锁码</legend>
        <p class="field-help">建议使用 6–8 位数字。更新只改解锁设置，本地内容无需重新加密。</p>

        <label for="old-pin">原解锁码</label>
        <input id="old-pin" name="oldPin" type="password" inputmode="numeric" maxlength="8" autocomplete="off">

        <label for="new-pin">新解锁码</label>
        <input id="new-pin" name="newPin" type="password" inputmode="numeric" maxlength="8" autocomplete="new-password">

        <label for="new-pin-confirm">再次输入新解锁码</label>
        <input id="new-pin-confirm" name="newPinConfirm" type="password" inputmode="numeric" maxlength="8" autocomplete="new-password">

        <p id="settings-error" class="settings-error" role="alert" aria-live="assertive"></p>
        <button id="change-pin-button" class="secondary-button" type="submit">更新解锁码</button>
      </fieldset>

      <fieldset class="settings-block">
        <legend>列表与回收站</legend>
        <label for="trash-retention">回收站保留时间</label>
        <select id="trash-retention" name="trashRetention">
          <option value="7">7 天</option>
          <option value="15">15 天</option>
          <option value="30">30 天（默认）</option>
          <option value="60">60 天</option>
          <option value="90">90 天</option>
          <option value="never">从不自动清理</option>
        </select>
        <p class="field-help">过期内容会在每次打开应用时自动彻底删除。</p>
      </fieldset>

      <fieldset class="settings-block">
        <legend>应急清除码</legend>
        <p class="field-help">设置后，在首页输入该数字并计算会清除本机内容。此操作无法恢复。</p>
        <label for="destruct-current-pin">当前解锁码</label>
        <input id="destruct-current-pin" name="destructCurrentPin" type="password" inputmode="numeric" maxlength="8" autocomplete="off">
        <label for="destruct-code">清除码（4–8 位数字，不能与解锁码相同）</label>
        <input id="destruct-code" name="destructCode" type="password" inputmode="numeric" maxlength="8" autocomplete="new-password">
        <label for="destruct-confirm">再次输入清除码</label>
        <input id="destruct-confirm" name="destructConfirm" type="password" inputmode="numeric" maxlength="8" autocomplete="new-password">
        <p id="destruct-status" class="field-help"></p>
        <p id="destruct-error" class="settings-error" role="alert" aria-live="assertive"></p>
        <button id="save-destruct-button" class="secondary-button" type="button">保存清除码</button>
        <button id="remove-destruct-button" class="secondary-button settings-secondary" type="button" hidden>关闭清除码</button>
      </fieldset>

      <div class="danger-zone">
        <h3>清除所有数据</h3>
        <p>永久删除解锁设置、元数据和全部加密内容，无法恢复。</p>
        <button id="wipe-button" class="danger-button" type="button">清除全部本地数据</button>
      </div>
    </form>
  </section>

  <section id="trash-panel" class="panel-modal" role="dialog" aria-modal="true" aria-labelledby="trash-title" hidden>
    <div class="panel-sheet trash-sheet">
      <div class="sheet-header">
        <div>
          <p class="eyebrow">可恢复内容</p>
          <h2 id="trash-title">回收站</h2>
        </div>
        <button class="icon-button" type="button" data-trash-action="close" aria-label="关闭回收站">关闭</button>
      </div>
      <p id="trash-summary" class="field-help">0 项</p>
      <div id="trash-list" class="trash-list"></div>
      <div id="trash-empty" class="trash-empty">回收站是空的</div>
      <div class="trash-actions">
        <button type="button" data-trash-action="restore" disabled>恢复</button>
        <button type="button" data-trash-action="purge" class="is-danger" disabled>彻底删除</button>
        <button type="button" data-trash-action="empty" class="is-danger" hidden>清空回收站</button>
      </div>
    </div>
  </section>

  <section id="media-viewer" class="media-viewer" role="dialog" aria-modal="true" aria-labelledby="viewer-title" hidden>
    <h2 id="viewer-title" class="visually-hidden"></h2>
    <button class="viewer-close viewer-back" type="button" data-viewer-action="close">返回</button>
    <div class="viewer-body">
      <button class="viewer-nav viewer-nav-previous" type="button" data-viewer-action="previous" aria-label="上一张">‹</button>
      <div id="viewer-stage" class="viewer-stage"></div>
      <button class="viewer-nav viewer-nav-next" type="button" data-viewer-action="next" aria-label="下一张">›</button>
    </div>
  </section>

  <section id="text-editor-panel" class="text-editor-panel" role="dialog" aria-modal="true" aria-labelledby="text-editor-title" hidden>
    <header class="text-editor-header">
      <button class="header-button" type="button" data-text-action="close">返回</button>
      <strong id="text-editor-title">文本</strong>
      <span id="text-save-status" class="text-save-status">自动保存</span>
    </header>
    <div class="text-editor-body">
      <input id="text-title-input" class="text-title-input" type="text" maxlength="120" placeholder="标题（可选）" autocomplete="off">
      <textarea id="text-body-input" class="text-body-input" maxlength="200000" placeholder="输入正文" spellcheck="false"></textarea>
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
    onLock,
    onAuthUpdated,
    onDestructUpdated,
  }) {
    this.host = host;
    this.crypto = cryptoManager;
    this.db = database;
    this.auth = auth;
    this.legacyKey = legacyKey;
    this.onLock = onLock;
    this.onAuthUpdated = onAuthUpdated;
    this.onDestructUpdated = onDestructUpdated;

    this.root = null;
    this.records = [];
    this.searchIndex = new Map();
    this.folders = [];
    this.trashItems = [];
    this.selectedTrashIds = new Set();
    this.preferences = { showNames: true, trashRetentionDays: 30 };
    this.searchQuery = "";
    this.contentFilter = "all";
    this.searchTimer = 0;
    this.currentFolderId = null;
    this.selectionMode = false;
    this.selectedIds = new Set();
    this.selectAll = false;
    this.folderIdFilter = new Set();
    this.page = 0;
    this.thumbnailUrls = new Map();
    this.thumbnailQueue = [];
    this.thumbnailQueued = new Set();
    this.thumbnailLoading = new Set();
    this.thumbnailFailed = new Set();
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
    this.longPressTimer = 0;
    this.longPressStart = null;
    this.longPressTriggered = false;
    this.textDraft = null;
    this.textSaveTimer = 0;
    this.textSavePromise = Promise.resolve();
    this.destructRecord = null;
    this.toastController = null;
    this.destroyed = false;
    this.handleGlobalKey = (event) => {
      if (event.key !== "Escape" || this.destroyed) {
        return;
      }
      if (!this.elements.viewer.hidden) {
        this.closeViewer();
      } else if (!this.elements.textEditor.hidden) {
        void this.closeTextEditor();
      } else if (!this.elements.trash.hidden) {
        this.closeTrash();
      } else if (!this.elements.settings.hidden) {
        this.closeSettings();
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
      settings: byId("settings-panel"),
      settingsForm: byId("settings-form"),
      settingsError: byId("settings-error"),
      oldPin: byId("old-pin"),
      newPin: byId("new-pin"),
      newPinConfirm: byId("new-pin-confirm"),
      changePinButton: byId("change-pin-button"),
      trashRetention: byId("trash-retention"),
      destructCurrentPin: byId("destruct-current-pin"),
      destructCode: byId("destruct-code"),
      destructConfirm: byId("destruct-confirm"),
      destructStatus: byId("destruct-status"),
      destructError: byId("destruct-error"),
      saveDestructButton: byId("save-destruct-button"),
      removeDestructButton: byId("remove-destruct-button"),
      wipeButton: byId("wipe-button"),
      mediaInput: byId("media-input"),
      importButton: this.root.querySelector(".import-button"),
      mediaCount: byId("media-count"),
      newTextButton: byId("new-text-button"),
      newFolderButton: byId("new-folder-button"),
      trashButton: byId("trash-button"),
      trashCount: byId("trash-count"),
      showNamesToggle: byId("show-names-toggle"),
      contentSearch: byId("content-search"),
      contentFilters: byId("content-filters"),
      folderBreadcrumb: byId("folder-breadcrumb"),
      folderBack: byId("folder-back"),
      folderTitle: byId("folder-title"),
      folderSection: byId("folder-section"),
      folderGrid: byId("folder-grid"),
      folderCount: byId("folder-count"),
      mediaGrid: byId("media-grid"),
      mediaPager: byId("media-pager"),
      pagePrevious: byId("page-previous"),
      pageNext: byId("page-next"),
      pageStatus: byId("page-status"),
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
      selectionActions: byId("selection-actions"),
      selectAllButton: byId("select-all-button"),
      trash: byId("trash-panel"),
      trashSummary: byId("trash-summary"),
      trashList: byId("trash-list"),
      trashEmpty: byId("trash-empty"),
      textEditor: byId("text-editor-panel"),
      textTitleInput: byId("text-title-input"),
      textBodyInput: byId("text-body-input"),
      textSaveStatus: byId("text-save-status"),
    };
  }

  bindEvents() {
    this.root.addEventListener("click", (event) => {
      const actionButton = event.target.closest("[data-panel-action]");
      if (actionButton) {
        const action = actionButton.dataset.panelAction;
        if (action === "lock") {
          this.onLock();
        } else if (action === "settings") {
          this.openSettings();
        } else if (action === "trash") {
          this.openTrash();
        } else if (action === "select") {
          this.toggleSelectionMode();
        }
        return;
      }

      const settingsButton = event.target.closest("[data-settings-action]");
      if (settingsButton?.dataset.settingsAction === "close") {
        this.closeSettings();
        return;
      }

      const trashButton = event.target.closest("[data-trash-action]");
      if (trashButton) {
        const action = trashButton.dataset.trashAction;
        if (action === "close") {
          this.closeTrash();
        } else if (action === "restore") {
          void this.restoreSelectedTrash();
        } else if (action === "purge") {
          void this.purgeSelectedTrash();
        } else if (action === "empty") {
          void this.emptyTrash();
        }
        return;
      }

      const trashItem = event.target.closest("[data-trash-id]");
      if (trashItem) {
        this.toggleTrashSelection(trashItem.dataset.trashId);
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
        }
        return;
      }

      const textButton = event.target.closest("[data-text-action]");
      if (textButton?.dataset.textAction === "close") {
        void this.closeTextEditor();
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
        } else if (action === "move") {
          void this.moveSelected();
        } else if (action === "delete") {
          void this.deleteSelected();
        }
        return;
      }

      const mediaButton = event.target.closest("[data-media-id]");
      if (mediaButton) {
        const record = this.records.find(
          (item) => item.id === mediaButton.dataset.mediaId
        );
        if (record) {
          if (this.longPressTriggered) {
            this.longPressTriggered = false;
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
    this.elements.importButton.addEventListener("click", () => {
      beginSystemPanel();
    });
    this.elements.newTextButton.addEventListener("click", () => {
      void this.openTextEditor(null);
    });
    this.elements.newFolderButton.addEventListener("click", () => {
      void this.createFolder();
    });
    this.elements.contentSearch.addEventListener("input", () => {
      window.clearTimeout(this.searchTimer);
      this.searchTimer = window.setTimeout(() => {
        this.searchQuery = this.elements.contentSearch.value
          .trim()
          .toLocaleLowerCase("zh-CN");
        this.page = 0;
        this.renderGrid();
      }, SEARCH_DEBOUNCE_MS);
    });
    this.elements.showNamesToggle.addEventListener("change", () => {
      void this.updatePreferences({
        showNames: this.elements.showNamesToggle.checked,
      });
    });
    this.elements.trashRetention.addEventListener("change", () => {
      const value = this.elements.trashRetention.value;
      void this.updatePreferences({
        trashRetentionDays: value === "never" ? null : Number(value),
      });
    });
    this.elements.folderBack.addEventListener("click", () => {
      this.openFolder(null);
    });
    this.elements.selectAllButton.addEventListener("click", () => {
      this.toggleSelectAll();
    });

    this.elements.pagePrevious.addEventListener("click", () => {
      if (this.page > 0) {
        this.page -= 1;
        this.renderGrid();
        this.elements.mediaGrid.closest(".panel-main").scrollTop = 0;
      }
    });
    this.elements.pageNext.addEventListener("click", () => {
      if ((this.page + 1) * PAGE_SIZE < this.visibleRecords().length) {
        this.page += 1;
        this.renderGrid();
        this.elements.mediaGrid.closest(".panel-main").scrollTop = 0;
      }
    });

    this.bindViewerGestures();
    this.root.addEventListener("pointerdown", (event) => {
      const item = event.target.closest("[data-media-id]");
      if (!item || this.selectionMode || event.button > 0) {
        return;
      }
      this.longPressTriggered = false;
      this.longPressStart = { x: event.clientX, y: event.clientY };
      window.clearTimeout(this.longPressTimer);
      const id = item.dataset.mediaId;
      this.longPressTimer = window.setTimeout(() => {
        this.longPressTriggered = true;
        this.enterSelection(id);
      }, 520);
    });
    this.root.addEventListener("pointermove", (event) => {
      if (
        this.longPressStart &&
        Math.hypot(
          event.clientX - this.longPressStart.x,
          event.clientY - this.longPressStart.y
        ) > 10
      ) {
        window.clearTimeout(this.longPressTimer);
      }
    });
    this.root.addEventListener("pointerup", () => {
      window.clearTimeout(this.longPressTimer);
      this.longPressStart = null;
    });
    this.root.addEventListener("pointercancel", () => {
      window.clearTimeout(this.longPressTimer);
      this.longPressStart = null;
    });
    this.root.addEventListener("contextmenu", (event) => {
      if (event.target.closest("[data-media-id]")) {
        event.preventDefault();
      }
    });

    this.elements.settingsForm.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.changeCode();
    });
    this.elements.saveDestructButton.addEventListener("click", () => {
      void this.saveDestructCode();
    });
    this.elements.removeDestructButton.addEventListener("click", () => {
      void this.removeDestructCode();
    });
    this.elements.textTitleInput.addEventListener("input", () => {
      this.queueTextSave();
    });
    this.elements.textBodyInput.addEventListener("input", () => {
      this.queueTextSave();
    });
    this.elements.wipeButton.addEventListener("click", () => {
      void this.wipeAllData();
    });
    this.elements.exportCancel.addEventListener("click", () => {
      this.cancelExport();
    });
    this.elements.exportShareButton.addEventListener("click", () => {
      void this.sharePreparedExport();
    });
    this.elements.settings.addEventListener("click", (event) => {
      if (event.target === this.elements.settings) {
        this.closeSettings();
      }
    });
    this.elements.trash.addEventListener("click", (event) => {
      if (event.target === this.elements.trash) {
        this.closeTrash();
      }
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
            const record = this.records.find((item) => item.id === mediaId);
            if (record) {
              this.scheduleThumbnail(record, image);
            }
          } else {
            const url = image.src;
            if (url.startsWith("blob:")) {
              URL.revokeObjectURL(url);
              this.thumbnailUrls.delete(mediaId);
              image.removeAttribute("src");
            }
          }
        }
      },
      { root: this.elements.mediaGrid.closest(".panel-main"), rootMargin: "280px 0px" }
    );
  }

  async refreshRecords() {
    if (this.destroyed) {
      return;
    }
    this.thumbnailFailed.clear();
    try {
      this.preferences = await loadPreferences({
        crypto: this.crypto,
        key: this.crypto.masterKey,
        db: this.db,
      });
      await purgeExpiredTrash({
        crypto: this.crypto,
        key: this.crypto.masterKey,
        db: this.db,
        retentionDays: this.preferences.trashRetentionDays,
      });
      const [
        envelopes,
        legacySummaries,
        textEnvelopes,
        folderEnvelopes,
        destructRecord,
        trashItems,
      ] = await Promise.all([
        this.db.getMetaEnvelopes(),
        this.db.getLegacySummaries(),
        this.db.getTextEnvelopes(),
        this.db.getFolderEnvelopes(),
        this.db.getSetting("destruct"),
        getTrashItems({
          crypto: this.crypto,
          key: this.crypto.masterKey,
          db: this.db,
        }),
      ]);
      await this.db.replaceTrashPurgeIndex(
        buildTrashPurgeEntries(
          trashItems,
          this.preferences.trashRetentionDays
        )
      );
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
      this.page = Math.min(
        this.page,
        Math.max(
          0,
          Math.ceil(this.visibleRecords().length / PAGE_SIZE) - 1
        )
      );
      this.renderGrid();
      this.renderFolders();
      this.updatePreferenceControls();
      this.updateDestructControls();
      this.renderTrash();
      this.updateTrashBadge();
      void this.startThumbnailBackfill();
    } catch (error) {
      console.error("读取本地内容失败", error);
      if (!this.destroyed) {
        this.showToast("部分内容读取失败，请稍后重试");
      }
    }
  }

  renderGrid() {
    if (!this.root || this.destroyed) {
      return;
    }

    for (const url of this.thumbnailUrls.values()) {
      URL.revokeObjectURL(url);
    }
    this.thumbnailUrls.clear();
    this.thumbnailQueue.length = 0;
    this.thumbnailQueued.clear();
    this.thumbnailObserver?.disconnect();

    const visibleRecords = this.visibleRecords();
    const inFolder = this.currentFolderId !== null;
    const searchActive =
      this.searchQuery.length > 0 || this.contentFilter !== "all";
    const currentFolder = this.folders.find(
      (folder) => folder.id === this.currentFolderId
    );
    this.elements.folderBreadcrumb.hidden = !inFolder || searchActive;
    this.elements.folderTitle.textContent = currentFolder?.name || "";
    this.elements.folderSection.hidden = inFolder || searchActive;
    this.elements.newFolderButton.hidden = inFolder || searchActive;
    this.elements.mediaCount.textContent = `${visibleRecords.length} 项`;
    this.elements.emptyState.hidden =
      visibleRecords.length !== 0 ||
      (!inFolder && this.folders.length > 0 && !searchActive);
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
    this.elements.mediaGrid.hidden = visibleRecords.length === 0;
    this.elements.mediaPager.hidden = visibleRecords.length <= PAGE_SIZE;

    const start = this.page * PAGE_SIZE;
    const pageRecords = visibleRecords.slice(start, start + PAGE_SIZE);
    const fragment = document.createDocumentFragment();
    for (const record of pageRecords) {
      const button = document.createElement("button");
      button.type = "button";
      button.className =
        record.kind === "text" ? "media-card text-card" : "media-card";
      button.classList.toggle("hide-names", !this.preferences.showNames);
      button.dataset.mediaId = record.id;
      button.classList.toggle("is-selected", this.selectedIds.has(record.id));
      button.setAttribute(
        "aria-label",
        this.selectionMode
          ? `选择 ${record.name || record.title || "文本"}`
          : `打开 ${record.name || record.title || "文本"}`
      );

      if (record.kind === "text") {
        const title = document.createElement("strong");
        title.className = "text-card-title";
        title.textContent = record.title.trim() || "无标题";
        const preview = document.createElement("span");
        preview.className = "text-card-preview";
        preview.textContent = record.body.trim() || "空白文本";
        button.append(title, preview);
      } else {
        const image = document.createElement("img");
        image.dataset.mediaId = record.id;
        image.alt = "";
        image.loading = "lazy";
        image.decoding = "async";
        image.draggable = false;
        button.append(image);

        if (record.kind === "video") {
          const badge = document.createElement("span");
          badge.className = "video-badge";
          const play = document.createElement("span");
          play.className = "video-play";
          play.setAttribute("aria-hidden", "true");
          const duration = document.createElement("span");
          duration.textContent = record.duration
            ? formatDuration(record.duration)
            : "视频";
          badge.append(play, duration);
          button.append(badge);
        }
      }

      if (record.kind !== "text") {
        const name = document.createElement("span");
        name.className = "media-name";
        name.textContent = record.name || "未命名";
        button.append(name);
      }
      if (searchActive) {
        const folder = document.createElement("span");
        folder.className = "media-folder";
        folder.textContent = record.folderId
          ? this.folders.find((item) => item.id === record.folderId)?.name ||
            "文件夹"
          : "未归类";
        button.append(folder);
      }

      const date = document.createElement("span");
      date.className = "media-date";
      date.textContent = formatDate(record.updatedAt || record.createdAt);
      button.append(date);
      if (this.selectionMode) {
        const check = document.createElement("span");
        check.className = "selection-check";
        check.setAttribute(
          "aria-hidden",
          String(!this.selectedIds.has(record.id))
        );
        check.textContent = this.selectedIds.has(record.id) ? "✓" : "";
        button.append(check);
      }
      fragment.append(button);
    }
    this.elements.mediaGrid.replaceChildren(fragment);

    const pageCount = Math.max(
      1,
      Math.ceil(visibleRecords.length / PAGE_SIZE)
    );
    this.elements.pageStatus.textContent = `第 ${this.page + 1} / ${pageCount} 页`;
    this.elements.pagePrevious.disabled = this.page === 0;
    this.elements.pageNext.disabled = this.page + 1 >= pageCount;

    for (const image of this.elements.mediaGrid.querySelectorAll("img")) {
      const record = this.records.find(
        (item) => item.id === image.dataset.mediaId
      );
      if (record) {
        this.thumbnailObserver.observe(image);
      }
    }
    this.updateSelectionUi();
  }

  visibleRecords() {
    const searchActive =
      this.searchQuery.length > 0 || this.contentFilter !== "all";
    return this.records.filter((record) => {
      if (!searchActive) {
        const inCurrentFolder =
          this.currentFolderId === null
            ? (record.folderId ?? null) === null
            : record.folderId === this.currentFolderId;
        if (!inCurrentFolder) {
          return false;
        }
      }
      if (
        this.contentFilter !== "all" &&
        this.recordCategory(record) !== this.contentFilter
      ) {
        return false;
      }
      if (!this.searchQuery) {
        return true;
      }
      return (
        this.searchIndex.get(record.id)?.includes(this.searchQuery) === true
      );
    });
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
    if (!["all", "image", "video", "document"].includes(filter)) {
      return;
    }
    this.contentFilter = filter;
    this.page = 0;
    for (const button of this.elements.contentFilters.querySelectorAll(
      "[data-content-filter]"
    )) {
      const active = button.dataset.contentFilter === filter;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    }
    this.renderGrid();
  }

  renderFolders() {
    if (!this.root || this.destroyed) {
      return;
    }
    const fragment = document.createDocumentFragment();
    for (const folder of this.folders) {
      const count = this.records.filter(
        (record) => record.folderId === folder.id
      ).length;
      const card = document.createElement("div");
      card.className = "folder-card";
      card.dataset.folderId = folder.id;
      card.innerHTML = `
        <button class="folder-open" type="button" data-folder-action="open" data-folder-id="${folder.id}">
          <span class="folder-icon" aria-hidden="true"></span>
          <span class="folder-copy"><strong></strong><small></small></span>
        </button>
        <div class="folder-actions">
          <button type="button" data-folder-action="rename" data-folder-id="${folder.id}">重命名</button>
          <button type="button" data-folder-action="delete" data-folder-id="${folder.id}">删除</button>
        </div>
      `;
      card.querySelector(".folder-copy strong").textContent = folder.name;
      card.querySelector(".folder-copy small").textContent = `${count} 项`;
      fragment.append(card);
    }
    this.elements.folderGrid.replaceChildren(fragment);
    this.elements.folderCount.textContent = `${this.folders.length} 个`;
  }

  openFolder(folderId) {
    if (
      folderId !== null &&
      !this.folders.some((folder) => folder.id === folderId)
    ) {
      return;
    }
    this.currentFolderId = folderId;
    this.page = 0;
    this.exitSelection();
    this.renderGrid();
    this.renderFolders();
    this.elements.mediaGrid.closest(".panel-main").scrollTop = 0;
  }

  toggleSelectionMode() {
    if (this.selectionMode) {
      this.exitSelection();
    } else {
      this.selectionMode = true;
      this.selectedIds.clear();
      this.renderGrid();
    }
  }

  enterSelection(id) {
    this.selectionMode = true;
    if (id) {
      this.selectedIds.add(id);
    }
    this.renderGrid();
  }

  exitSelection() {
    this.selectionMode = false;
    this.selectedIds.clear();
    this.selectAll = false;
    if (this.root && !this.destroyed) {
      this.renderGrid();
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

  toggleSelectAll() {
    const visible = this.visibleRecords();
    if (visible.every((record) => this.selectedIds.has(record.id))) {
      this.selectedIds.clear();
      this.selectAll = false;
    } else {
      for (const record of visible) {
        this.selectedIds.add(record.id);
      }
      this.selectAll = true;
    }
    this.updateRecordSelectionUi();
  }

  updateRecordSelectionUi() {
    if (!this.elements || this.destroyed) {
      return;
    }
    for (const card of this.elements.mediaGrid.querySelectorAll(
      ".media-card[data-media-id]"
    )) {
      const id = card.dataset.mediaId;
      const record = this.records.find((item) => item.id === id);
      const selected = this.selectedIds.has(id);
      card.classList.toggle("is-selected", selected);
      if (record) {
        card.setAttribute(
          "aria-label",
          this.selectionMode
            ? `选择 ${record.name || record.title || "文本"}`
            : `打开 ${record.name || record.title || "文本"}`
        );
      }
      let check = card.querySelector(".selection-check");
      if (this.selectionMode && !check) {
        check = document.createElement("span");
        check.className = "selection-check";
        card.append(check);
      }
      if (check) {
        check.setAttribute("aria-hidden", String(!selected));
        check.textContent = selected ? "✓" : "";
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
      selectButton.textContent = this.selectionMode ? "完成" : "选择";
    }
    this.elements.selectionActions.hidden = !this.selectionMode;
    const visible = this.visibleRecords();
    const allSelected =
      visible.length > 0 &&
      visible.every((record) => this.selectedIds.has(record.id));
    this.elements.selectAllButton.textContent = allSelected
      ? "取消全选"
      : "全选";
    for (const button of this.elements.selectionActions.querySelectorAll(
      "[data-selection-action]"
    )) {
      button.disabled = this.selectedIds.size === 0;
    }
  }

  selectedRecords() {
    return this.records.filter((record) =>
      this.selectedIds.has(record.id)
    );
  }

  async createFolder() {
    if (this.destroyed || this.currentFolderId !== null) {
      return;
    }
    const name = await showPrompt("输入文件夹名称", {
      title: "新建文件夹",
      placeholder: "文件夹名称",
      maxLength: 80,
      theme: "panel",
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
      theme: "panel",
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
        theme: "panel",
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
          retentionDays: this.preferences.trashRetentionDays,
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

  async openTextEditor(record) {
    if (this.destroyed) {
      return;
    }
    this.closeViewer();
    this.closeSettings();
    this.textDraft = record
      ? { ...record }
      : {
          id: contentId(),
          type: "text",
          kind: "text",
          title: "",
          body: "",
          folderId: this.currentFolderId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          legacy: false,
        };
    this.textDraft.isNew = !record;
    this.elements.textTitleInput.value = this.textDraft.title;
    this.elements.textBodyInput.value = this.textDraft.body;
    this.elements.textSaveStatus.textContent = "自动保存";
    this.elements.textEditor.hidden = false;
    document.body.classList.add("text-editor-open");
    window.setTimeout(() => {
      (this.textDraft?.title
        ? this.elements.textBodyInput
        : this.elements.textTitleInput
      ).focus();
    }, 50);
  }

  queueTextSave() {
    if (!this.textDraft || this.destroyed) {
      return;
    }
    window.clearTimeout(this.textSaveTimer);
    this.elements.textSaveStatus.textContent = "正在保存…";
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
    const title = this.elements.textTitleInput.value;
    const body = this.elements.textBodyInput.value;
    if (!draft.isNew && title === draft.title && body === draft.body) {
      return;
    }
    if (draft.isNew && !title.trim() && !body.trim()) {
      this.elements.textSaveStatus.textContent = "自动保存";
      return;
    }

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
            body,
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
        this.textDraft = { ...saved, isNew: false };
        this.elements.textSaveStatus.textContent = "已保存";
        this.renderGrid();
      });

    try {
      await this.textSavePromise;
    } catch (error) {
      console.error("文本保存失败", error);
      if (!this.destroyed) {
        this.elements.textSaveStatus.textContent = "保存失败";
      }
    }
  }

  async closeTextEditor() {
    if (!this.elements?.textEditor || this.elements.textEditor.hidden) {
      return;
    }
    await this.flushTextDraft();
    await this.textSavePromise.catch(() => {});
    this.elements.textEditor.hidden = true;
    this.elements.textTitleInput.value = "";
    this.elements.textBodyInput.value = "";
    this.elements.textSaveStatus.textContent = "自动保存";
    this.textDraft = null;
    document.body.classList.remove("text-editor-open");
    this.renderGrid();
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
        theme: "panel",
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
    const records = this.selectedRecords();
    if (records.length === 0 || this.destroyed) {
      return;
    }
    try {
      const trashed = await trashContentRecords({
        crypto: this.crypto,
        key: this.crypto.masterKey,
        db: this.db,
        records,
        retentionDays: this.preferences.trashRetentionDays,
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
          theme: "panel",
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
        theme: "panel",
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
            theme: "panel",
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
    return String(value || "")
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
      .trim()
      .slice(0, 90);
  }

  scheduleThumbnail(record, image) {
    if (this.thumbnailFailed.has(record.id)) {
      return;
    }
    const existing = this.thumbnailUrls.get(record.id);
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
      const previous = this.thumbnailUrls.get(record.id);
      if (previous) {
        URL.revokeObjectURL(previous);
      }
      this.thumbnailUrls.set(record.id, url);
      image.src = url;
    } catch (error) {
      if (!this.destroyed) {
        console.error("缩略图解密失败", error);
        this.thumbnailFailed.add(record.id);
      }
    }
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
            theme: "panel",
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
    this.resetViewerTransform();
    this.elements.viewer.classList.add("controls-visible");
    this.elements.viewerStage.classList.toggle(
      "is-video",
      record.kind === "video"
    );
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
      const media = document.createElement(
        record.kind === "video" ? "video" : "img"
      );
      if (record.kind === "video") {
        media.controls = true;
        media.playsInline = true;
        media.autoplay = true;
      } else {
        media.alt = record.name;
        media.decoding = "async";
      }
      media.className = "viewer-media";
      media.src = this.viewerOriginalUrl;
      this.elements.viewerStage.replaceChildren(media);
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
    video.controls = true;
    video.playsInline = true;
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
    this.elements.viewerStage.replaceChildren(video);
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
    const records = this.viewerRecords();
    const index = records.findIndex(
      (record) => record.id === this.viewerRecord?.id
    );
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
    this.elements.viewer.hidden = true;
    this.elements.viewerStage.replaceChildren();
    this.elements.viewerStage.classList.remove("is-video", "is-zoomed");
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
    this.elements.viewer.classList.remove("controls-visible", "is-zoomed");
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
    this.elements.showNamesToggle.checked = this.preferences.showNames;
    this.elements.trashRetention.value =
      this.preferences.trashRetentionDays === null
        ? "never"
        : String(this.preferences.trashRetentionDays);
    this.renderGrid();
  }

  async updatePreferences(changes) {
    const previous = { ...this.preferences };
    this.preferences = { ...this.preferences, ...changes };
    this.renderGrid();
    try {
      this.preferences = await savePreferences({
        crypto: this.crypto,
        key: this.crypto.masterKey,
        db: this.db,
        preferences: this.preferences,
      });
      if (
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
    this.elements.trashCount.textContent = String(this.trashItems.length);
  }

  openTrash() {
    if (this.destroyed) {
      return;
    }
    this.toastController?.hide();
    this.toastController = null;
    this.closeSettings();
    this.selectedTrashIds.clear();
    this.renderTrash();
    this.elements.trash.hidden = false;
  }

  closeTrash() {
    if (!this.elements?.trash) {
      return;
    }
    this.elements.trash.hidden = true;
    this.selectedTrashIds.clear();
  }

  renderTrash() {
    if (!this.elements?.trashList) {
      return;
    }
    const fragment = document.createDocumentFragment();
    for (const item of this.trashItems) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "trash-item";
      button.dataset.trashId = item.id;
      button.classList.toggle(
        "is-selected",
        this.selectedTrashIds.has(item.id)
      );

      const icon = document.createElement("span");
      icon.className = "trash-item-icon";
      icon.textContent =
        item.trashType === "folder"
          ? "文件夹"
          : item.kind === "video"
            ? "视频"
            : item.kind === "image"
              ? "图片"
              : "文档";
      const copy = document.createElement("span");
      copy.className = "trash-item-copy";
      const name = document.createElement("strong");
      name.textContent = item.displayName || "内容";
      const detail = document.createElement("small");
      const remaining = trashRemainingDays(
        item,
        this.preferences.trashRetentionDays
      );
      detail.textContent = [
        `删除于 ${formatDate(item.trashedAt)}`,
        remaining === null ? "不自动清理" : `剩余 ${remaining} 天`,
        item.storageSize ? formatSize(item.storageSize) : "",
      ]
        .filter(Boolean)
        .join(" · ");
      copy.append(name, detail);
      const check = document.createElement("span");
      check.className = "trash-item-check";
      check.textContent = this.selectedTrashIds.has(item.id) ? "✓" : "";
      button.append(icon, copy, check);
      fragment.append(button);
    }
    this.elements.trashList.replaceChildren(fragment);
    this.elements.trashEmpty.hidden = this.trashItems.length !== 0;
    const bytes = this.trashItems.reduce(
      (sum, item) => sum + (Number(item.storageSize) || 0),
      0
    );
    this.elements.trashSummary.textContent =
      `${this.trashItems.length} 项 · 内容约 ${formatSize(bytes)} · ` +
      (this.preferences.trashRetentionDays === null
        ? "不自动清理"
        : `${this.preferences.trashRetentionDays} 天后自动清理`);
    this.updateTrashSelectionUi();
  }

  updateTrashSelectionUi() {
    if (!this.elements?.trash) {
      return;
    }
    for (const button of this.elements.trashList.querySelectorAll(
      "[data-trash-id]"
    )) {
      const selected = this.selectedTrashIds.has(button.dataset.trashId);
      button.classList.toggle("is-selected", selected);
      const check = button.querySelector(".trash-item-check");
      if (check) {
        check.textContent = selected ? "✓" : "";
      }
    }
    for (const button of this.elements.trash.querySelectorAll(
      '[data-trash-action="restore"], [data-trash-action="purge"]'
    )) {
      button.disabled = this.selectedTrashIds.size === 0;
    }
    const empty = this.elements.trash.querySelector(
      '[data-trash-action="empty"]'
    );
    empty.hidden = this.trashItems.length === 0;
    empty.disabled = this.trashItems.length === 0;
  }

  toggleTrashSelection(id) {
    if (this.selectedTrashIds.has(id)) {
      this.selectedTrashIds.delete(id);
    } else {
      this.selectedTrashIds.add(id);
    }
    this.updateTrashSelectionUi();
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
      await this.refreshRecords();
      if (!this.destroyed) {
        this.showToast("已从回收站恢复");
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
      await this.refreshRecords();
      if (!this.destroyed) {
        this.showToast(`已恢复 ${items.length} 项`);
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
    const confirmed = await showConfirm(
      `确定彻底删除选中的 ${items.length} 项吗？所有加密分块和缩略图都会清除，无法恢复。`,
      {
        title: "彻底删除",
        confirmText: "彻底删除",
        cancelText: "取消",
        danger: true,
        theme: "panel",
      }
    );
    if (!confirmed || this.destroyed) {
      return;
    }
    try {
      await purgeTrashItems({ db: this.db, items });
      this.selectedTrashIds.clear();
      await this.refreshRecords();
      if (!this.destroyed) {
        this.showToast("已彻底删除");
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
      `确定清空回收站中的 ${this.trashItems.length} 项吗？所有加密分块和缩略图都会清除，无法恢复。`,
      {
        title: "清空回收站",
        confirmText: "清空",
        cancelText: "取消",
        danger: true,
        theme: "panel",
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
      await this.refreshRecords();
      if (!this.destroyed) {
        this.showToast("回收站已清空");
      }
    } catch (error) {
      console.error("清空回收站失败", error);
      if (!this.destroyed) {
        this.showToast("清空失败，请重试");
      }
    }
  }

  openSettings() {
    if (this.destroyed) {
      return;
    }
    this.elements.settingsError.textContent = "";
    this.elements.destructError.textContent = "";
    this.elements.settingsForm.reset();
    this.updatePreferenceControls();
    this.updateDestructControls();
    this.elements.settings.hidden = false;
    window.setTimeout(() => this.elements.oldPin.focus(), 50);
  }

  closeSettings() {
    if (!this.elements?.settings) {
      return;
    }
    this.elements.settings.hidden = true;
    this.elements.settingsError.textContent = "";
    this.elements.destructError.textContent = "";
    this.elements.settingsForm.reset();
  }

  updateDestructControls() {
    if (!this.elements?.destructStatus) {
      return;
    }
    this.elements.destructStatus.textContent = this.destructRecord
      ? "已设置。输入清除码并计算会立即清除本机内容。"
      : "尚未设置。";
    this.elements.removeDestructButton.hidden = !this.destructRecord;
  }

  async saveDestructCode() {
    if (this.destroyed) {
      return;
    }
    const currentPin = this.elements.destructCurrentPin.value;
    const code = this.elements.destructCode.value;
    const confirmation = this.elements.destructConfirm.value;
    this.elements.destructError.textContent = "";

    if (!/^\d{4,8}$/.test(currentPin)) {
      this.elements.destructError.textContent = "请输入当前解锁码";
      return;
    }
    if (!/^\d{4,8}$/.test(code)) {
      this.elements.destructError.textContent = "清除码必须为 4–8 位数字";
      return;
    }
    if (code !== confirmation) {
      this.elements.destructError.textContent = "两次输入的清除码不一致";
      return;
    }
    if (code === currentPin) {
      this.elements.destructError.textContent = "清除码不能与解锁码相同";
      return;
    }

    const button = this.elements.saveDestructButton;
    button.disabled = true;
    button.textContent = "正在验证…";
    try {
      const session = await this.crypto.unlock(currentPin, this.auth);
      if (!session || this.destroyed) {
        this.elements.destructError.textContent = "当前解锁码不正确";
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
      this.updateDestructControls();
      this.showToast("清除码已保存");
    } catch (error) {
      console.error("保存清除码失败", error);
      if (!this.destroyed) {
        this.elements.destructError.textContent =
          error.message.includes("不能与解锁码相同")
            ? "清除码不能与解锁码相同"
            : "保存失败，请重试";
      }
    } finally {
      if (!this.destroyed) {
        button.disabled = false;
        button.textContent = "保存清除码";
      }
    }
  }

  async removeDestructCode() {
    if (!this.destructRecord || this.destroyed) {
      return;
    }
    const currentPin = this.elements.destructCurrentPin.value;
    if (!/^\d{4,8}$/.test(currentPin)) {
      this.elements.destructError.textContent = "请输入当前解锁码";
      return;
    }
    const confirmed = await showConfirm("确定关闭应急清除码吗？", {
      title: "关闭清除码",
      confirmText: "关闭",
      cancelText: "取消",
      danger: true,
      theme: "panel",
    });
    if (!confirmed || this.destroyed) {
      return;
    }
    try {
      const session = await this.crypto.unlock(currentPin, this.auth);
      if (!session || this.destroyed) {
        this.elements.destructError.textContent = "当前解锁码不正确";
        return;
      }
      await this.db.deleteSetting("destruct");
      if (this.destroyed) {
        return;
      }
      this.destructRecord = null;
      this.onDestructUpdated?.(null);
      this.elements.destructCurrentPin.value = "";
      this.updateDestructControls();
      this.showToast("清除码已关闭");
    } catch (error) {
      console.error("关闭清除码失败", error);
      if (!this.destroyed) {
        this.elements.destructError.textContent = "关闭失败，请重试";
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
    this.elements.settingsError.textContent = "";

    if (!/^\d{4,8}$/.test(oldPin)) {
      this.elements.settingsError.textContent = "原解锁码必须为 4–8 位数字";
      return;
    }
    if (!/^\d{4,8}$/.test(newPin)) {
      this.elements.settingsError.textContent = "新解锁码必须为 4–8 位数字";
      return;
    }
    if (newPin !== confirmation) {
      this.elements.settingsError.textContent = "两次输入的新解锁码不一致";
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
      this.closeSettings();
      this.showToast("解锁码已更新");
    } catch (error) {
      const expectedError =
        error.message === "原解锁码不正确" ||
        error.message === "新解锁码不能与清除码相同";
      if (!expectedError) {
        console.error("修改解锁码失败", error);
      }
      if (!this.destroyed) {
        if (expectedError) {
          this.elements.settingsError.textContent = error.message;
        } else {
          this.elements.settingsError.textContent =
            "更新失败，原设置未改变";
        }
      }
    } finally {
      if (!this.destroyed) {
        submitButton.disabled = false;
        submitButton.textContent = "更新解锁码";
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
        theme: "panel",
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
        theme: "panel",
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
      theme: "panel",
      ...options,
    });
    return this.toastController;
  }

  destroy() {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    window.clearTimeout(this.longPressTimer);
    window.clearTimeout(this.textSaveTimer);
    window.clearTimeout(this.searchTimer);
    this.longPressTimer = 0;
    this.longPressStart = null;
    this.longPressTriggered = false;
    this.textSaveTimer = 0;
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
    this.thumbnailQueue.length = 0;
    this.thumbnailQueued.clear();
    endSystemPanel();
    this.toastController?.hide();
    this.toastController = null;
    closeAllDialogs();
    window.removeEventListener("keydown", this.handleGlobalKey);
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
    for (const url of this.thumbnailUrls.values()) {
      URL.revokeObjectURL(url);
    }
    for (const url of this.exportUrls) {
      URL.revokeObjectURL(url);
    }
    for (const frame of this.downloadFrames) {
      frame.remove();
    }
    this.exportUrls.clear();
    this.downloadFrames.clear();
    this.thumbnailUrls.clear();
    this.records = [];
    this.folders = [];
    this.root = null;
    this.host.replaceChildren();
    document.body.classList.remove("panel-viewer-open");
    document.body.classList.remove("text-editor-open");
  }
}
