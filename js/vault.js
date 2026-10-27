import {
  beginSystemPanel,
  endSystemPanel,
} from "./system-panel.js";

const THUMBNAIL_SIZE = 480;
const THUMBNAIL_QUALITY = 0.82;
const LARGE_VIDEO_BYTES = 300 * 1024 * 1024;

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
      reject(new Error("媒体加载超时"));
    }, timeoutMs);

    const onEvent = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("媒体无法解码"));
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
  const canvasWidth = THUMBNAIL_SIZE;
  const canvasHeight = THUMBNAIL_SIZE;
  const scale = Math.max(
    canvasWidth / sourceWidth,
    canvasHeight / sourceHeight
  );
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  const x = (canvasWidth - width) / 2;
  const y = (canvasHeight - height) / 2;

  context.fillStyle = "#111113";
  context.fillRect(0, 0, canvasWidth, canvasHeight);
  context.drawImage(source, x, y, width, height);
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

  context.beginPath();
  context.arc(THUMBNAIL_SIZE / 2, 210, 72, 0, Math.PI * 2);
  context.fillStyle = "#ff9f0a";
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

    return {
      blob: await canvasToBlob(canvas),
      mimeType: "image/jpeg",
    };
  } catch {
    return {
      blob: await canvasToBlob(placeholderCanvas("照片")),
      mimeType: "image/jpeg",
    };
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
  const canvas = document.createElement("canvas");
  canvas.width = THUMBNAIL_SIZE;
  canvas.height = THUMBNAIL_SIZE;
  const context = canvas.getContext("2d");
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = objectUrl;

  try {
    await waitForMediaEvent(video, "loadeddata", 8_000);
    if (Number.isFinite(video.duration) && video.duration > 0.25) {
      try {
        video.currentTime = Math.min(0.15, video.duration / 10);
        await waitForMediaEvent(video, "seeked", 3_000);
      } catch {
        // The decoded first frame is still usable.
      }
    }

    if (video.videoWidth > 0 && video.videoHeight > 0) {
      drawCover(context, video, video.videoWidth, video.videoHeight);
    } else {
      throw new Error("视频没有可用画面");
    }

    return {
      blob: await canvasToBlob(canvas),
      mimeType: "image/jpeg",
    };
  } catch {
    return {
      blob: await canvasToBlob(placeholderCanvas("视频")),
      mimeType: "image/jpeg",
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
    video.removeAttribute("src");
    video.load();
  }
}

async function createThumbnail(file, kind) {
  if (typeof file.arrayBuffer !== "function") {
    return {
      blob: await canvasToBlob(placeholderCanvas(kind === "video" ? "视频" : "照片")),
      mimeType: "image/jpeg",
    };
  }

  return kind === "video"
    ? videoThumbnail(file)
    : imageThumbnail(file);
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

function sortRecords(records) {
  return records.sort((left, right) => right.createdAt - left.createdAt);
}

function formatSize(size) {
  if (size < 1_024) {
    return `${size} B`;
  }
  if (size < 1_048_576) {
    return `${(size / 1_024).toFixed(1)} KB`;
  }
  return `${(size / 1_048_576).toFixed(1)} MB`;
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

const VAULT_MARKUP = `
  <section class="vault" aria-label="私人金库">
    <header class="vault-header">
      <div>
        <p class="eyebrow">仅保存在此设备</p>
        <h1>私人金库</h1>
      </div>
      <div class="header-actions">
        <button class="header-button" type="button" data-vault-action="settings">设置</button>
        <button class="header-button header-button-primary" type="button" data-vault-action="lock">锁定</button>
      </div>
    </header>

    <main class="vault-main">
      <div class="vault-toolbar">
        <label class="import-button">
          <span aria-hidden="true">＋</span>
          导入照片或视频
          <input id="media-input" type="file" accept="image/*,video/*" multiple hidden>
        </label>
        <span id="media-count" class="media-count">0 项</span>
      </div>

      <div id="import-progress" class="import-progress" hidden>
        <div>
          <span id="import-label">正在加密导入…</span>
          <span id="import-percent">0%</span>
        </div>
        <progress id="import-bar" max="100" value="0">0%</progress>
      </div>

      <div id="media-grid" class="media-grid"></div>
      <div id="empty-state" class="empty-state">
        <div class="empty-icon" aria-hidden="true">
          <span></span>
        </div>
        <h2>金库还是空的</h2>
        <p>导入照片或视频后，它们会加密保存在此设备中。</p>
      </div>
    </main>

    <p class="originals-note">导入不会移动原文件。请稍后从“照片”中手动删除原始文件。</p>
  </section>

  <section id="settings-panel" class="vault-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" hidden>
    <form id="settings-form" class="vault-sheet" autocomplete="off" novalidate>
      <div class="sheet-header">
        <div>
          <p class="eyebrow">安全设置</p>
          <h2 id="settings-title">金库设置</h2>
        </div>
        <button class="icon-button" type="button" data-settings-action="close" aria-label="关闭设置">关闭</button>
      </div>

      <fieldset>
        <legend>修改 PIN</legend>
        <p class="field-help">需要原 PIN，并会重新加密全部媒体。</p>

        <label for="old-pin">原 PIN</label>
        <input id="old-pin" name="oldPin" type="password" inputmode="numeric" pattern="[0-9]*" minlength="4" maxlength="8" autocomplete="off" required>

        <label for="new-pin">新 PIN</label>
        <input id="new-pin" name="newPin" type="password" inputmode="numeric" pattern="[0-9]*" minlength="4" maxlength="8" autocomplete="new-password" required>

        <label for="new-pin-confirm">再次输入新 PIN</label>
        <input id="new-pin-confirm" name="newPinConfirm" type="password" inputmode="numeric" pattern="[0-9]*" minlength="4" maxlength="8" autocomplete="new-password" required>

        <p id="settings-error" class="settings-error" role="alert" aria-live="assertive"></p>
        <button id="change-pin-button" class="secondary-button" type="submit">更新 PIN</button>
      </fieldset>

      <div class="danger-zone">
        <h3>清除所有数据</h3>
        <p>永久删除 PIN 和全部加密媒体，无法恢复。</p>
        <button id="wipe-button" class="danger-button" type="button">清除金库数据</button>
      </div>
    </form>
  </section>

  <section id="media-viewer" class="media-viewer" role="dialog" aria-modal="true" aria-labelledby="viewer-title" hidden>
    <header class="viewer-header">
      <button class="viewer-close" type="button" data-viewer-action="close">关闭</button>
      <div class="viewer-heading">
        <h2 id="viewer-title"></h2>
        <p id="viewer-meta"></p>
      </div>
    </header>
    <div class="viewer-body">
      <button
        class="viewer-nav viewer-nav-previous"
        type="button"
        data-viewer-action="previous"
        aria-label="上一张"
      >‹</button>
      <div id="viewer-stage" class="viewer-stage"></div>
      <button
        class="viewer-nav viewer-nav-next"
        type="button"
        data-viewer-action="next"
        aria-label="下一张"
      >›</button>
    </div>
    <footer class="viewer-actions">
      <button class="secondary-button" type="button" data-viewer-action="export">存储/分享</button>
      <button class="danger-button" type="button" data-viewer-action="delete">删除</button>
    </footer>
  </section>

  <div id="vault-toast" class="vault-toast" role="status" aria-live="polite" hidden></div>
`;

export class Vault {
  constructor({ host, cryptoManager, database, auth, onLock, onAuthUpdated }) {
    this.host = host;
    this.crypto = cryptoManager;
    this.db = database;
    this.auth = auth;
    this.onLock = onLock;
    this.onAuthUpdated = onAuthUpdated;

    this.root = null;
    this.records = [];
    this.thumbnailUrls = new Map();
    this.viewerRecord = null;
    this.viewerBlob = null;
    this.viewerOriginalUrl = "";
    this.viewerTouchStart = null;
    this.exportUrls = new Set();
    this.toastTimer = 0;
    this.destroyed = false;
    this.handleGlobalKey = (event) => {
      if (event.key !== "Escape" || this.destroyed) {
        return;
      }
      if (!this.elements.viewer.hidden) {
        this.closeViewer();
      } else if (!this.elements.settings.hidden) {
        this.closeSettings();
      }
    };
  }

  async mount() {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = VAULT_MARKUP;
    this.root = wrapper;
    this.host.replaceChildren(wrapper);
    this.captureElements();
    this.bindEvents();
    window.addEventListener("keydown", this.handleGlobalKey);

    this.renderGrid();
    try {
      this.records = sortRecords(await this.db.getAllMedia());
      await this.loadThumbnails();
      this.renderGrid();
      await this.requestPersistentStorage();
    } catch (error) {
      console.error("读取金库失败", error);
      if (!this.destroyed) {
        this.showToast("部分媒体读取失败，请稍后重试");
      }
    }
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
      wipeButton: byId("wipe-button"),
      mediaInput: byId("media-input"),
      importButton: this.root.querySelector(".import-button"),
      mediaCount: byId("media-count"),
      mediaGrid: byId("media-grid"),
      emptyState: byId("empty-state"),
      importProgress: byId("import-progress"),
      importLabel: byId("import-label"),
      importPercent: byId("import-percent"),
      importBar: byId("import-bar"),
      viewer: byId("media-viewer"),
      viewerTitle: byId("viewer-title"),
      viewerMeta: byId("viewer-meta"),
      viewerStage: byId("viewer-stage"),
      viewerPrevious: this.root.querySelector('[data-viewer-action="previous"]'),
      viewerNext: this.root.querySelector('[data-viewer-action="next"]'),
      toast: byId("vault-toast"),
    };
  }

  bindEvents() {
    this.root.addEventListener("click", (event) => {
      const actionButton = event.target.closest("[data-vault-action]");
      if (actionButton) {
        if (actionButton.dataset.vaultAction === "lock") {
          this.onLock();
        } else if (actionButton.dataset.vaultAction === "settings") {
          this.openSettings();
        }
        return;
      }

      const settingsButton = event.target.closest("[data-settings-action]");
      if (settingsButton?.dataset.settingsAction === "close") {
        this.closeSettings();
        return;
      }

      const viewerButton = event.target.closest("[data-viewer-action]");
      if (viewerButton) {
        const action = viewerButton.dataset.viewerAction;
        if (action === "close") {
          this.closeViewer();
        } else if (action === "previous") {
          this.switchViewer(-1);
        } else if (action === "next") {
          this.switchViewer(1);
        } else if (action === "export") {
          void this.exportCurrentRecord();
        } else if (action === "delete") {
          void this.deleteCurrentRecord();
        }
        return;
      }

      const mediaButton = event.target.closest("[data-media-id]");
      if (mediaButton) {
        const record = this.records.find(
          (item) => item.id === mediaButton.dataset.mediaId
        );
        if (record) {
          void this.openViewer(record);
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
    this.elements.importButton.addEventListener("click", () => {
      beginSystemPanel();
    });

    this.elements.viewerStage.addEventListener(
      "touchstart",
      (event) => {
        if (event.touches.length !== 1) {
          this.viewerTouchStart = null;
          return;
        }
        const touch = event.touches[0];
        this.viewerTouchStart = { x: touch.clientX, y: touch.clientY };
      },
      { passive: true }
    );
    this.elements.viewerStage.addEventListener(
      "touchend",
      (event) => {
        const start = this.viewerTouchStart;
        this.viewerTouchStart = null;
        if (!start || event.changedTouches.length !== 1) {
          return;
        }
        const touch = event.changedTouches[0];
        const distanceX = touch.clientX - start.x;
        const distanceY = touch.clientY - start.y;
        if (
          Math.abs(distanceX) > 50 &&
          Math.abs(distanceX) > Math.abs(distanceY)
        ) {
          this.switchViewer(distanceX < 0 ? 1 : -1);
        }
      },
      { passive: true }
    );

    this.elements.settingsForm.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.changePin();
    });
    this.elements.wipeButton.addEventListener("click", () => {
      void this.wipeAllData();
    });
    this.elements.settings.addEventListener("click", (event) => {
      if (event.target === this.elements.settings) {
        this.closeSettings();
      }
    });
  }

  async loadThumbnails() {
    for (const record of this.records) {
      if (this.destroyed) {
        return;
      }

      try {
        if (!record.thumbnailCiphertext || !record.thumbnailIv) {
          throw new Error("缺少缩略图");
        }
        const plain = await this.crypto.decrypt(
          record.thumbnailCiphertext,
          record.thumbnailIv
        );
        const url = URL.createObjectURL(
          new Blob([plain], { type: record.thumbnailType || "image/jpeg" })
        );
        this.thumbnailUrls.set(record.id, url);
      } catch (error) {
        if (this.destroyed) {
          return;
        }
        console.error("缩略图解密失败", error);
        const placeholder = await canvasToBlob(
          placeholderCanvas(record.kind === "video" ? "视频" : "照片")
        );
        if (this.destroyed) {
          return;
        }
        this.thumbnailUrls.set(record.id, URL.createObjectURL(placeholder));
      }
    }
  }

  renderGrid() {
    if (!this.root || this.destroyed) {
      return;
    }

    this.elements.mediaCount.textContent = `${this.records.length} 项`;
    this.elements.emptyState.hidden = this.records.length !== 0;
    const fragment = document.createDocumentFragment();

    for (const record of this.records) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "media-card";
      button.dataset.mediaId = record.id;
      button.setAttribute("aria-label", `打开 ${record.name}`);

      const image = document.createElement("img");
      image.src = this.thumbnailUrls.get(record.id) || "";
      image.alt = "";
      image.loading = "lazy";
      image.draggable = false;
      button.append(image);

      if (record.kind === "video") {
        const badge = document.createElement("span");
        badge.className = "video-badge";
        badge.textContent = "视频";
        button.append(badge);
      }

      const date = document.createElement("span");
      date.className = "media-date";
      date.textContent = formatDate(record.createdAt);
      button.append(date);
      fragment.append(button);
    }

    this.elements.mediaGrid.replaceChildren(fragment);
  }

  async importFiles(files) {
    const validFiles = files.filter((file) => inferKind(file));
    if (validFiles.length === 0) {
      this.showToast("请选择照片或视频");
      return;
    }

    const hasLargeVideo = validFiles.some(
      (file) => inferKind(file) === "video" && file.size > LARGE_VIDEO_BYTES
    );
    if (
      hasLargeVideo &&
      !window.confirm(
        "文件较大，可能导致内存不足或导入失败，是否继续？"
      )
    ) {
      return;
    }

    this.elements.importProgress.hidden = false;
    this.elements.importBar.value = 0;
    this.elements.importPercent.textContent = "0%";
    let imported = 0;

    for (let index = 0; index < validFiles.length; index += 1) {
      if (this.destroyed) {
        return;
      }

      const file = validFiles[index];
      const kind = inferKind(file);
      this.elements.importLabel.textContent = `正在加密：${file.name || `第 ${
        index + 1
      } 项`}`;

      try {
        const original = await file.arrayBuffer();
        if (this.destroyed) {
          return;
        }
        const thumbnail = await createThumbnail(file, kind);
        const thumbnailData = await thumbnail.blob.arrayBuffer();
        if (this.destroyed) {
          return;
        }

        const encryptedMedia = await this.crypto.encrypt(original);
        const encryptedThumbnail = await this.crypto.encrypt(thumbnailData);
        if (this.destroyed) {
          return;
        }

        const record = {
          id: uid(),
          name: file.name || `${kind === "video" ? "视频" : "照片"}_${
            Date.now()
          }`,
          kind,
          mimeType: inferMimeType(file, kind),
          size: file.size,
          createdAt: Date.now(),
          iv: encryptedMedia.iv,
          ciphertext: encryptedMedia.ciphertext,
          thumbnailIv: encryptedThumbnail.iv,
          thumbnailCiphertext: encryptedThumbnail.ciphertext,
          thumbnailType: thumbnail.mimeType,
        };

        await this.db.addMedia(record);
        if (this.destroyed) {
          return;
        }

        this.records.unshift(record);
        this.thumbnailUrls.set(
          record.id,
          URL.createObjectURL(thumbnail.blob)
        );
        this.renderGrid();
        imported += 1;
      } catch (error) {
        console.error("导入失败", error);
        if (!this.destroyed) {
          this.showToast(
            `“${file.name || "所选文件"}”导入失败，其他文件会继续处理`
          );
        }
      }

      const percent = Math.round(((index + 1) / validFiles.length) * 100);
      this.elements.importBar.value = percent;
      this.elements.importPercent.textContent = `${percent}%`;
    }

    if (this.destroyed) {
      return;
    }
    this.elements.importProgress.hidden = true;
    if (imported > 0) {
      this.showToast(`已加密导入 ${imported} 项`);
    }
  }

  async openViewer(record) {
    if (this.destroyed) {
      return;
    }
    this.closeViewer();
    this.viewerRecord = record;
    this.elements.viewerTitle.textContent = record.name;
    this.elements.viewerMeta.textContent = `${formatSize(record.size)} · ${formatDate(
      record.createdAt
    )}`;
    this.elements.viewerStage.replaceChildren(
      this.makeViewerMessage("正在解密…")
    );
    this.elements.viewer.hidden = false;
    document.body.classList.add("vault-viewer-open");
    this.updateViewerNavigation();

    try {
      const plain = await this.crypto.decrypt(record.ciphertext, record.iv);
      if (this.destroyed || this.viewerRecord?.id !== record.id) {
        return;
      }

      this.viewerBlob = new Blob([plain], { type: record.mimeType });
      this.viewerOriginalUrl = URL.createObjectURL(this.viewerBlob);

      let media;
      if (record.kind === "video") {
        media = document.createElement("video");
        media.controls = true;
        media.playsInline = true;
        media.autoplay = true;
        media.preload = "metadata";
      } else {
        media = document.createElement("img");
        media.alt = record.name;
        media.decoding = "async";
      }

      media.className = "viewer-media";
      media.src = this.viewerOriginalUrl;
      this.elements.viewerStage.replaceChildren(media);
    } catch (error) {
      console.error("媒体解密失败", error);
      if (!this.destroyed) {
        this.elements.viewerStage.replaceChildren(
          this.makeViewerMessage("无法解密此媒体")
        );
      }
    }
  }

  updateViewerNavigation() {
    if (!this.elements?.viewerPrevious) {
      return;
    }
    const index = this.records.findIndex(
      (record) => record.id === this.viewerRecord?.id
    );
    const hasPrevious = index > 0;
    const hasNext = index >= 0 && index < this.records.length - 1;
    this.elements.viewerPrevious.disabled = !hasPrevious;
    this.elements.viewerNext.disabled = !hasNext;
  }

  switchViewer(direction) {
    const index = this.records.findIndex(
      (record) => record.id === this.viewerRecord?.id
    );
    const target = this.records[index + direction];
    if (index < 0 || !target) {
      return;
    }
    void this.openViewer(target);
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
    this.viewerRecord = null;
    this.viewerBlob = null;
    this.viewerTouchStart = null;
    if (this.viewerOriginalUrl) {
      URL.revokeObjectURL(this.viewerOriginalUrl);
      this.viewerOriginalUrl = "";
    }
    document.body.classList.remove("vault-viewer-open");
  }

  async exportCurrentRecord() {
    const record = this.viewerRecord;
    if (!record) {
      return;
    }

    try {
      let blob = this.viewerBlob;
      if (!blob) {
        const plain = await this.crypto.decrypt(record.ciphertext, record.iv);
        blob = new Blob([plain], { type: record.mimeType });
      }
      if (this.destroyed) {
        return;
      }

      const file = new File([blob], record.name, {
        type: record.mimeType,
      });
      let canShareFile = false;
      try {
        canShareFile = navigator.canShare?.({ files: [file] }) === true;
      } catch {
        canShareFile = false;
      }
      if (
        typeof navigator.share === "function" &&
        canShareFile
      ) {
        const panelToken = beginSystemPanel();
        this.showToast("请在分享面板中选择‘存储图像’或‘存储视频’");
        try {
          await navigator.share({ files: [file] });
          return;
        } catch (error) {
          if (error?.name === "AbortError") {
            return;
          }
          console.error("分享失败，尝试下载", error);
        } finally {
          endSystemPanel(panelToken);
        }
      }

      this.downloadBlob(blob, record.name);
      this.showToast("已开始导出，导出的文件不再加密");
    } catch (error) {
      console.error("导出失败", error);
      if (!this.destroyed) {
        this.showToast("导出失败，请重试");
      }
    }
  }

  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename || "媒体";
    anchor.rel = "noopener";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    this.exportUrls.add(url);
    window.setTimeout(() => {
      this.exportUrls.delete(url);
      URL.revokeObjectURL(url);
    }, 30_000);
  }

  async deleteCurrentRecord() {
    const record = this.viewerRecord;
    if (!record) {
      return;
    }
    const confirmed = window.confirm(
      `确定要永久删除“${record.name}”吗？此操作无法撤销。`
    );
    if (!confirmed) {
      return;
    }

    try {
      await this.db.deleteMedia(record.id);
      if (this.destroyed) {
        return;
      }
      const thumbnailUrl = this.thumbnailUrls.get(record.id);
      if (thumbnailUrl) {
        URL.revokeObjectURL(thumbnailUrl);
        this.thumbnailUrls.delete(record.id);
      }
      this.records = this.records.filter((item) => item.id !== record.id);
      this.closeViewer();
      this.renderGrid();
      this.showToast("已永久删除");
    } catch (error) {
      console.error("删除失败", error);
      if (!this.destroyed) {
        this.showToast("删除失败，请重试");
      }
    }
  }

  openSettings() {
    if (this.destroyed) {
      return;
    }
    this.elements.settingsError.textContent = "";
    this.elements.settingsForm.reset();
    this.elements.settings.hidden = false;
    window.setTimeout(() => this.elements.oldPin.focus(), 50);
  }

  closeSettings() {
    if (!this.elements?.settings) {
      return;
    }
    this.elements.settings.hidden = true;
    this.elements.settingsError.textContent = "";
    this.elements.settingsForm.reset();
  }

  async changePin() {
    if (this.destroyed) {
      return;
    }

    const oldPin = this.elements.oldPin.value;
    const newPin = this.elements.newPin.value;
    const confirmation = this.elements.newPinConfirm.value;
    this.elements.settingsError.textContent = "";

    if (!/^\d{4,8}$/.test(oldPin)) {
      this.elements.settingsError.textContent = "原 PIN 必须为 4–8 位数字";
      return;
    }
    if (!/^\d{4,8}$/.test(newPin)) {
      this.elements.settingsError.textContent = "新 PIN 必须为 4–8 位数字";
      return;
    }
    if (newPin !== confirmation) {
      this.elements.settingsError.textContent = "两次输入的新 PIN 不一致";
      return;
    }

    const submitButton = this.elements.changePinButton;
    submitButton.disabled = true;
    submitButton.textContent = "正在验证…";

    try {
      const oldKey = await this.crypto.verifyPin(oldPin, this.auth);
      if (!oldKey) {
        throw new Error("原 PIN 不正确");
      }
      if (this.destroyed) {
        return;
      }

      submitButton.textContent = "正在重新加密…";
      const { auth: newAuth, key: newKey } = await this.crypto.derivePin(newPin);
      const existingRecords = await this.db.getAllMedia();
      const reencryptedRecords = [];

      for (let index = 0; index < existingRecords.length; index += 1) {
        if (this.destroyed) {
          return;
        }

        const record = existingRecords[index];
        submitButton.textContent = `正在重新加密 ${
          index + 1
        } / ${existingRecords.length}`;
        const plain = await this.crypto.decrypt(
          record.ciphertext,
          record.iv,
          oldKey
        );
        const encrypted = await this.crypto.encrypt(plain, newKey);

        let thumbnailIv = null;
        let thumbnailCiphertext = null;
        if (record.thumbnailCiphertext && record.thumbnailIv) {
          const thumbnailPlain = await this.crypto.decrypt(
            record.thumbnailCiphertext,
            record.thumbnailIv,
            oldKey
          );
          const encryptedThumbnail = await this.crypto.encrypt(
            thumbnailPlain,
            newKey
          );
          thumbnailIv = encryptedThumbnail.iv;
          thumbnailCiphertext = encryptedThumbnail.ciphertext;
        }

        reencryptedRecords.push({
          ...record,
          iv: encrypted.iv,
          ciphertext: encrypted.ciphertext,
          thumbnailIv,
          thumbnailCiphertext,
        });
      }

      if (this.destroyed) {
        return;
      }
      await this.db.replaceAuthAndMedia(newAuth, reencryptedRecords);
      if (this.destroyed) {
        return;
      }

      this.crypto.installKey(newKey);
      this.auth = newAuth;
      this.records = sortRecords(reencryptedRecords);
      this.onAuthUpdated(newAuth);
      this.closeSettings();
      this.showToast("PIN 已更新");
    } catch (error) {
      console.error("修改 PIN 失败", error);
      if (!this.destroyed) {
        this.elements.settingsError.textContent =
          error.message === "原 PIN 不正确"
            ? "原 PIN 不正确"
            : "修改失败，原数据和 PIN 均未改变";
      }
    } finally {
      if (!this.destroyed) {
        submitButton.disabled = false;
        submitButton.textContent = "更新 PIN";
      }
    }
  }

  async wipeAllData() {
    const confirmed = window.confirm(
      "确定清除全部金库数据吗？PIN 和所有媒体将被永久删除。"
    );
    if (!confirmed) {
      return;
    }

    try {
      const wipePromise = this.db.wipe();
      this.onLock();
      await wipePromise;
      window.location.reload();
    } catch (error) {
      console.error("清除数据失败", error);
      window.alert("清除数据失败，请关闭其他金库窗口后重试。");
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
      // Persistence is best-effort and does not affect vault functionality.
    }
  }

  showToast(message) {
    if (this.destroyed || !this.elements?.toast) {
      return;
    }
    window.clearTimeout(this.toastTimer);
    this.elements.toast.textContent = message;
    this.elements.toast.hidden = false;
    this.toastTimer = window.setTimeout(() => {
      if (!this.destroyed) {
        this.elements.toast.hidden = true;
      }
    }, 3_600);
  }

  destroy() {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    endSystemPanel();
    window.clearTimeout(this.toastTimer);
    window.removeEventListener("keydown", this.handleGlobalKey);
    if (this.elements?.viewer) {
      this.closeViewer();
    }
    for (const url of this.thumbnailUrls.values()) {
      URL.revokeObjectURL(url);
    }
    for (const url of this.exportUrls) {
      URL.revokeObjectURL(url);
    }
    this.exportUrls.clear();
    this.thumbnailUrls.clear();
    this.records = [];
    this.root = null;
    this.host.replaceChildren();
    document.body.classList.remove("vault-viewer-open");
  }
}
