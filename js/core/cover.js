/**
 * 视频首帧封面（2.1.4）。
 *
 * iOS / WebKit 实测（Playwright WebKit + 真机反馈）：
 *  - 元数据（duration / videoWidth）可以在未出画时就拿到 → 角标有时长、格子却是灰的；
 *  - 1×1 / opacity:0 / 未入 DOM 的 <video>，即使 seeked + play(60ms)，drawImage 仍是全黑；
 *  - 必须：入 DOM、给真实像素尺寸、muted+playsinline、先 play() 强制解码，
 *    再用 requestVideoFrameCallback（或足够长的 playing/canplay 等待）等到真正出帧后再 drawImage。
 *  - 本模块**只吃 File/Blob 或已授权的同源 URL**，绝不整份 arrayBuffer；失败只影响封面。
 */

const DEFAULT_TIMEOUT = 12000;
/** 生成算法世代：升级后清掉本会话「失败不再试」的记忆，让旧失败条目自动重试 */
export const COVER_GEN = 4;

function withTimeout(promise, ms, fallback) {
  return new Promise((resolve) => {
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; resolve(fallback); } }, ms);
    promise.then((v) => { if (!done) { done = true; clearTimeout(t); resolve(v); } },
      () => { if (!done) { done = true; clearTimeout(t); resolve(fallback); } });
  });
}

/** 首帧取帧位置：0.1s，但不超过时长的 1/10，避免极短视频越界 */
export function frameTime(dur) {
  const d = Number.isFinite(dur) && dur > 0 ? dur : 0;
  if (!d) return 0.1;
  return Math.min(0.1, Math.max(0, d * 0.1));
}

function waitEvent(el, names, ms) {
  return withTimeout(new Promise((resolve) => {
    const ok = () => { names.forEach((n) => el.removeEventListener(n, ok)); resolve(true); };
    names.forEach((n) => el.addEventListener(n, ok, { once: true }));
  }), ms, false);
}

/** 等到视频真正产出一帧（WebKit 关键路径） */
function waitForFrame(video, ms) {
  if (typeof video.requestVideoFrameCallback === "function") {
    return withTimeout(new Promise((resolve) => {
      try {
        video.requestVideoFrameCallback(() => resolve(true));
      } catch {
        resolve(false);
      }
    }), ms, false);
  }
  return waitEvent(video, ["loadeddata", "canplay", "playing", "timeupdate"], ms);
}

function drawToJpeg(source, w, h) {
  const MAX = 320;
  const scale = Math.min(1, MAX / Math.max(w || 1, h || 1));
  const tw = Math.max(1, Math.round((w || 1) * scale));
  const th = Math.max(1, Math.round((h || 1) * scale));
  const canvas = document.createElement("canvas");
  canvas.width = tw; canvas.height = th;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  try { ctx.drawImage(source, 0, 0, tw, th); } catch { return Promise.resolve({ thumb: null, bright: 0 }); }
  let bright = 0;
  let variance = 0;
  try {
    const d = ctx.getImageData(0, 0, tw, th).data;
    let sum = 0;
    const samples = [];
    for (let i = 0; i < d.length; i += 16) { // 抽样，避免大图耗时
      const v = (d[i] + d[i + 1] + d[i + 2]) / 3;
      sum += v; samples.push(v);
    }
    bright = samples.length ? sum / samples.length : 0;
    let ss = 0;
    for (const v of samples) { const dv = v - bright; ss += dv * dv; }
    variance = samples.length ? ss / samples.length : 0;
  } catch { bright = 1; variance = 1; }
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) return resolve({ thumb: null, bright, variance });
      blob.arrayBuffer().then(
        (buf) => resolve({ thumb: new Uint8Array(buf), bright, variance }),
        () => resolve({ thumb: null, bright, variance }),
      );
    }, "image/jpeg", 0.72);
  });
}

/** 全黑 / 未出画：亮度极低且几乎无方差。暗画面但有内容（variance 大）算成功。 */
function isBlankFrame(shot) {
  if (!shot || !shot.thumb) return true;
  if (shot.bright >= 2) return false;
  return !(shot.variance >= 4);
}

/**
 * 构造用于取帧的 <video>：一开始就挂进 DOM，给真实像素尺寸。
 * WebKit 对 1×1 / opacity:0 / 未入 DOM 的元素不会解码出可绘制帧。
 */
function makeCaptureVideo() {
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.setAttribute("muted", "");
  video.controls = false;
  video.disablePictureInPicture = true;
  try { video.disableRemotePlayback = true; } catch { /* ignore */ }
  video.style.cssText = "position:fixed;left:0;top:0;width:160px;height:90px;opacity:0.01;pointer-events:none;z-index:-1;border:0;";
  document.body.appendChild(video);
  return video;
}

async function grabFrame(video, { target, budget }) {
  // 1) 先 play 强制解码（iOS 没播过的 video drawImage 必黑）
  let played = false;
  try {
    const p = video.play();
    if (p && typeof p.then === "function") await p;
    played = true;
  } catch {
    // 自动播放被拒：仍尝试后续 seek；部分环境 seeked 后也能出帧
  }

  await waitForFrame(video, Math.min(budget, 4000));

  // 2) seek 到目标时间，再等一帧
  const seekMs = Math.min(budget, 5000);
  const seeked = waitEvent(video, ["seeked"], seekMs);
  try { video.currentTime = target; } catch { /* 不可 seek 就用当前帧 */ }
  await seeked;
  await waitForFrame(video, Math.min(budget, 4000));

  if (played) {
    try { video.pause(); } catch { /* ignore */ }
  }

  if (video.readyState < 2) await waitEvent(video, ["loadeddata", "canplay"], 1500);

  let shot = await drawToJpeg(video, video.videoWidth || 160, video.videoHeight || 90);
  if (isBlankFrame(shot) && played) {
    // 再短播一截兜底（某些编码 seek 后第一帧仍黑）
    try {
      await video.play();
      await waitForFrame(video, 2500);
      video.pause();
      shot = await drawToJpeg(video, video.videoWidth || 160, video.videoHeight || 90);
    } catch { /* keep first */ }
  }
  return shot;
}

function cleanupVideo(video, url) {
  try {
    if (video) {
      try { video.pause(); } catch { /* ignore */ }
      video.removeAttribute("src");
      try { video.load(); } catch { /* ignore */ }
      video.remove();
    }
  } catch { /* ignore */ }
  try { if (url) URL.revokeObjectURL(url); } catch { /* ignore */ }
}

/**
 * 从 File/Blob 提取视频首帧 + 尺寸 + 时长。
 * @returns {Promise<{w:number,h:number,dur:number|null,thumb:Uint8Array|null,reason?:string}>}
 */
export async function captureCover(file, { mime, timeout, at } = {}) {
  const out = { w: 0, h: 0, dur: null, thumb: null };
  if (!file || typeof document === "undefined") return { ...out, reason: "nofile" };
  if (typeof document.body === "undefined" || !document.body) return { ...out, reason: "nobody" };
  const type = mime || file.type || "";
  const size = Number(file.size) || 0;
  const budget = timeout != null ? timeout
    : (size > 500 * 1024 * 1024 ? 30000 : size > 80 * 1024 * 1024 ? 20000 : DEFAULT_TIMEOUT);

  let url = null;
  let video = null;
  try {
    url = URL.createObjectURL(file);
    video = makeCaptureVideo();
    video.src = url;
    if (video.load) video.load();

    const metaOk = await waitEvent(video, ["loadedmetadata"], Math.min(budget, 15000));
    out.w = video.videoWidth || 0;
    out.h = video.videoHeight || 0;
    out.dur = Number.isFinite(video.duration) ? video.duration : null;
    if (!metaOk) return { ...out, reason: "metatimeout" };
    if (!out.w || !out.h) return { ...out, reason: "nocodec" };

    const target = at == null ? frameTime(out.dur) : at;
    const shot = await grabFrame(video, { target, budget });
    if (isBlankFrame(shot)) return { ...out, reason: "blank" };
    out.thumb = shot.thumb;
    return out;
  } catch (err) {
    out.reason = (err && err.name) || "error";
    return out;
  } finally {
    cleanupVideo(video, url);
    void type;
  }
}

/**
 * 同 captureCover，输入是已存在的同源 URL（blob: 或 /__media/ 流式 URL）。
 * 导出给 backfill / 测试使用。
 */
export async function captureCoverFromUrl(src, mime, { timeout = DEFAULT_TIMEOUT, at } = {}) {
  const out = { w: 0, h: 0, dur: null, thumb: null };
  if (!src || typeof document === "undefined" || !document.body) return { ...out, reason: "nofile" };
  let video = null;
  try {
    video = makeCaptureVideo();
    video.src = src;
    if (video.load) video.load();

    const metaOk = await waitEvent(video, ["loadedmetadata"], Math.min(timeout, 15000));
    out.w = video.videoWidth || 0;
    out.h = video.videoHeight || 0;
    out.dur = Number.isFinite(video.duration) ? video.duration : null;
    if (!metaOk) return { ...out, reason: "metatimeout" };
    if (!out.w || !out.h) return { ...out, reason: "nocodec" };

    const target = at == null ? frameTime(out.dur) : at;
    const shot = await grabFrame(video, { target, budget: timeout });
    if (isBlankFrame(shot)) return { ...out, reason: "blank" };
    out.thumb = shot.thumb;
    void mime;
    return out;
  } catch (err) {
    out.reason = (err && err.name) || "error";
    return out;
  } finally {
    cleanupVideo(video, null);
  }
}

export const LEGACY_INLINE_MAX = 12 * 1024 * 1024;

/* 本会话内已失败的条目；COVER_GEN 变化时整表清空，升级后自动重试 */
const sessionFailed = new Set();
let sessionGen = COVER_GEN;
function ensureSessionGen() {
  if (sessionGen !== COVER_GEN) { sessionFailed.clear(); sessionGen = COVER_GEN; }
}

function cachedUrl(media, id) {
  if (!media || typeof media.url !== "function") return null;
  try { return media.url("video", id) || null; } catch { return null; }
}

/**
 * 已导入但没有封面的视频：懒补封面。不重导入、不动原件。
 * 失败时把 reason 写入 item.coverFail（仅元数据，无 UI），便于真机诊断；不阻止下次升级后重试。
 */
export async function backfillVideoCovers(vault, { limit = 8, onOne, media, legacyMaxBytes = LEGACY_INLINE_MAX } = {}) {
  ensureSessionGen();
  const res = { fixed: 0, skipped: 0, failed: 0, deferred: 0, remaining: 0, unavailable: false };
  const all = (vault.items || []).filter((it) => it.kind === "video" && !it.hasThumb && !it.trashedAt);
  res.remaining = all.length;
  if (!all.length) return res;
  const todo = all.filter((it) => !sessionFailed.has(it.id));
  if (!todo.length) return res;
  const batch = todo.slice(0, limit);

  let Stream = null;
  try { Stream = await import("./stream.js"); } catch { /* 离线/旧 SW */ }
  const streamOk = !!(Stream && typeof Stream.urlFor === "function");

  for (const it of batch) {
    let release = null;
    try {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        res.skipped++;
        continue; // 后台不取帧：iOS 会挂起媒体，且 grant 可能已 revoke
      }
      const size = Number(it.size) || 0;
      let cover = null;
      let chunked = false;
      try { chunked = await vault.isChunked(it.id); } catch { chunked = false; }

      if (chunked) {
        if (!streamOk) { res.unavailable = true; res.skipped++; continue; }
        const url = await Stream.urlFor(it.id);
        if (!url) { res.skipped++; continue; }
        cover = await captureCoverFromUrl(url, it.mime);
        release = () => { try { Stream.releaseItem(it.id); } catch { /* ignore */ } };
      } else {
        const hot = cachedUrl(media, it.id);
        if (hot) cover = await captureCoverFromUrl(hot, it.mime);
        else if (size && size <= legacyMaxBytes) {
          const bytes = await vault.readBlob(it.id);
          if (!bytes) { res.skipped++; continue; }
          cover = await captureCover(new Blob([bytes], { type: it.mime || "video/mp4" }), { mime: it.mime });
        } else {
          res.deferred++;
          continue;
        }
      }

      if (!cover || !cover.thumb) {
        res.failed++;
        sessionFailed.add(it.id);
        try {
          it.coverFail = (cover && cover.reason) || "blank";
          it.coverFailAt = Date.now();
          it.coverFailGen = COVER_GEN;
          await vault.saveItem(it);
        } catch { /* 诊断字段写失败不影响主流程 */ }
        continue;
      }
      await vault.putThumb(it.id, cover.thumb);
      it.hasThumb = true;
      it.w = it.w || cover.w; it.h = it.h || cover.h;
      if (it.dur == null && cover.dur != null) it.dur = cover.dur;
      if (it.coverFail) { delete it.coverFail; delete it.coverFailAt; delete it.coverFailGen; }
      await vault.saveItem(it);
      res.fixed++;
      onOne && onOne(it);
    } catch {
      res.failed++;
      sessionFailed.add(it.id);
    } finally { if (release) release(); }
  }
  res.remaining = Math.max(0, (vault.items || []).filter((it) => it.kind === "video" && !it.hasThumb && !it.trashedAt).length);
  return res;
}

export function _resetBackfillSession() { sessionFailed.clear(); sessionGen = COVER_GEN; }
