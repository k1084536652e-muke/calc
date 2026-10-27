export const THUMBNAIL_SIZE = 480;

function defaultWaitForEvent(target, eventName, timeoutMs, environment) {
  return new Promise((resolve, reject) => {
    const timer = environment.setTimeout(() => {
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
      environment.clearTimeout(timer);
      target.removeEventListener(eventName, onEvent);
      target.removeEventListener("error", onError);
    };
    target.addEventListener(eventName, onEvent, { once: true });
    target.addEventListener("error", onError, { once: true });
  });
}

function canvasToBlob(canvas, type = "image/jpeg", quality = 0.82) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("无法生成缩略图"));
        }
      },
      type,
      quality
    );
  });
}

/**
 * Captures roughly the first decoded frame. The caller decides whether the
 * source is a local File object URL or the streaming __media URL.
 */
export async function captureVideoThumbnail({
  source,
  drawFrame,
  createPlaceholder,
  cleanupSource = () => {},
  environment = globalThis,
  timeoutMs = 8_000,
}) {
  const video = environment.document.createElement("video");
  const canvas = environment.document.createElement("canvas");
  canvas.width = THUMBNAIL_SIZE;
  canvas.height = THUMBNAIL_SIZE;
  const context = canvas.getContext("2d");
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.preload = "auto";

  const waitForEvent = (target, name, timeout) =>
    defaultWaitForEvent(target, name, timeout, environment);
  let duration = 0;
  try {
    const loaded = waitForEvent(video, "loadeddata", timeoutMs);
    video.src = source;
    video.load();
    await loaded;
    duration =
      Number.isFinite(video.duration) && video.duration > 0
        ? video.duration
        : 0;
    if (duration > 0.2) {
      const targetTime = Math.min(0.1, duration / 10);
      try {
        const seeked = waitForEvent(
          video,
          "seeked",
          Math.min(3_000, timeoutMs)
        );
        video.currentTime = targetTime;
        await seeked;
      } catch {
        // The decoded first frame is still usable if seeking is unavailable.
      }
    }
    if (video.videoWidth <= 0 || video.videoHeight <= 0) {
      throw new Error("视频没有可用画面");
    }
    drawFrame(
      context,
      video,
      video.videoWidth,
      video.videoHeight,
      THUMBNAIL_SIZE
    );
    return {
      blob: await canvasToBlob(canvas),
      duration,
      frameCaptured: true,
    };
  } catch {
    const placeholder = createPlaceholder("视频");
    return {
      blob: await canvasToBlob(placeholder),
      duration,
      frameCaptured: false,
    };
  } finally {
    cleanupSource();
    video.removeAttribute("src");
    video.load();
  }
}
