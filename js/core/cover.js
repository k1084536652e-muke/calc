/**
 * 视频封面（2.1.6）
 *
 * 设计（与用户确认一致）：
 *  1. **导入时**从原始 File 的 blob: URL 取一帧小 JPEG（与照片缩略图同级），加密进 thumbs；
 *     绝不为封面去「整段播放」大视频。
 *  2. **懒补**只服务旧条目：一次一个、每种算法世代只试一次（coverFailGen），
 *     优先小文件整份 / 流式 URL seek 到 ~0.1s（Range 只拉开头几块），成功或失败都落盘标记。
 *
 * iOS / WebKit 要点（真机 + Playwright 证据）：
 *  - 时长/宽高可以在未出画时就有 → 角标有、格子灰；
 *  - 取帧必须：入 DOM、真实像素尺寸、muted+playsinline；
 *  - 文件选择回调里尽快 video.play()，否则丢掉用户手势后自动播放被拒 → 黑帧；
 *  - requestVideoFrameCallback 等到真正出帧再 drawImage。
 */

export const COVER_GEN = 6;
const DEFAULT_TIMEOUT = 12000;
/** 懒补时允许整份解密取帧的上限（legacy 或退回路径） */
export const LEGACY_INLINE_MAX = 12 * 1024 * 1024;
/** 流式取帧：seek 到此秒，SW Range 只需开头几块 */
const FRAME_AT = 0.1;

function withTimeout(promise, ms, fallback) {
  return new Promise((resolve) => {
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; resolve(fallback); } }, ms);
    promise.then(
      (v) => { if (!done) { done = true; clearTimeout(t); resolve(v); } },
      () => { if (!done) { done = true; clearTimeout(t); resolve(fallback); } },
    );
  });
}

export function frameTime(dur) {
  const d = Number.isFinite(dur) && dur > 0 ? dur : 0;
  if (!d) return FRAME_AT;
  return Math.min(FRAME_AT, Math.max(0, d * 0.1));
}

function waitEvent(el, names, ms) {
  return withTimeout(new Promise((resolve) => {
    const ok = () => { names.forEach((n) => el.removeEventListener(n, ok)); resolve(true); };
    names.forEach((n) => el.addEventListener(n, ok, { once: true }));
  }), ms, false);
}

function waitForFrame(video, ms) {
  if (typeof video.requestVideoFrameCallback === "function") {
    return withTimeout(new Promise((resolve) => {
      try { video.requestVideoFrameCallback(() => resolve(true)); }
      catch { resolve(false); }
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
  try { ctx.drawImage(source, 0, 0, tw, th); }
  catch { return Promise.resolve({ thumb: null, bright: 0, variance: 0 }); }
  let bright = 0, variance = 0;
  try {
    const d = ctx.getImageData(0, 0, tw, th).data;
    const samples = [];
    let sum = 0;
    for (let i = 0; i < d.length; i += 16) {
      const v = (d[i] + d[i + 1] + d[i + 2]) / 3;
      samples.push(v); sum += v;
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

/** 纯黑/近匀色/过小 JPEG 一律当失败（不落盘当封面） */
function isBlankFrame(shot) {
  if (!shot || !shot.thumb) return true;
  if (shot.thumb.length < 280) return true;          /* 极小 JPEG ≈ 空图 */
  if (shot.variance < 4) return true;                /* 近匀色（含白/灰/黑） */
  return false;
}

/** 已存缩略图是否「像真封面」：字节、尺寸、方差 */
export function thumbLooksValid(insp) {
  if (!insp || !insp.bytes) return false;
  if (insp.bytes < 280) return false;
  if (insp.w < 8 || insp.h < 8) return false;
  if (insp.variance < 4) return false;
  return true;
}

/**
 * 分析已解密缩略图字节：mime 嗅探 + 解码宽高 + 平均色/方差 + 可展示的 blob URL。
 * 调用方负责 revoke previewUrl。
 */
export async function inspectThumbBytes(bytes) {
  const empty = {
    bytes: 0, mime: null, w: 0, h: 0,
    avgR: 0, avgG: 0, avgB: 0, bright: 0, variance: 0,
    uniform: true, tiny: true, ok: false, previewUrl: null, decodeOk: false,
  };
  if (!bytes || !bytes.length) return empty;
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let mime = "application/octet-stream";
  if (u8.length >= 3 && u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff) mime = "image/jpeg";
  else if (u8.length >= 8 && u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4e && u8[3] === 0x47) mime = "image/png";
  else if (u8.length >= 12 && u8[0] === 0x52 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x46) mime = "image/webp";
  const blob = new Blob([u8], { type: mime === "application/octet-stream" ? "image/jpeg" : mime });
  const previewUrl = URL.createObjectURL(blob);
  const out = {
    bytes: u8.length, mime, w: 0, h: 0,
    avgR: 0, avgG: 0, avgB: 0, bright: 0, variance: 0,
    uniform: true, tiny: u8.length < 280, ok: false, previewUrl, decodeOk: false,
  };
  try {
    let bmp = null;
    if (typeof createImageBitmap === "function") {
      try { bmp = await createImageBitmap(blob); } catch { bmp = null; }
    }
    if (bmp) {
      out.w = bmp.width; out.h = bmp.height; out.decodeOk = true;
      const c = document.createElement("canvas");
      const tw = Math.min(64, bmp.width || 1);
      const th = Math.min(64, bmp.height || 1);
      c.width = tw; c.height = th;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(bmp, 0, 0, tw, th);
      try { bmp.close(); } catch { /* */ }
      const d = ctx.getImageData(0, 0, tw, th).data;
      let sr = 0, sg = 0, sb = 0, n = 0;
      const lum = [];
      for (let i = 0; i < d.length; i += 4) {
        sr += d[i]; sg += d[i + 1]; sb += d[i + 2];
        lum.push((d[i] + d[i + 1] + d[i + 2]) / 3);
        n++;
      }
      out.avgR = n ? Math.round(sr / n) : 0;
      out.avgG = n ? Math.round(sg / n) : 0;
      out.avgB = n ? Math.round(sb / n) : 0;
      out.bright = lum.length ? lum.reduce((a, b) => a + b, 0) / lum.length : 0;
      let ss = 0;
      for (const v of lum) { const dv = v - out.bright; ss += dv * dv; }
      out.variance = lum.length ? ss / lum.length : 0;
      out.uniform = out.variance < 4;
    } else {
      /* 无 createImageBitmap：用 Image 解码拿尺寸（方差暂未知，按能解码算候选） */
      await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          out.w = img.naturalWidth; out.h = img.naturalHeight; out.decodeOk = true;
          resolve();
        };
        img.onerror = () => resolve();
        img.src = previewUrl;
      });
      if (out.decodeOk) { out.uniform = false; out.variance = 999; }
    }
  } catch { /* */ }
  out.ok = thumbLooksValid(out) && out.decodeOk;
  return out;
}

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
  try { video.disablePictureInPicture = true; } catch { /* */ }
  try { video.disableRemotePlayback = true; } catch { /* */ }
  /* iOS：opacity≈0 / 离屏时常不出可绘帧。用全不透明 + 同尺寸遮罩盖住，用户看不见播放画面。 */
  const wrap = document.createElement("div");
  wrap.setAttribute("data-cover-cap", "1");
  wrap.style.cssText = "position:fixed;left:0;top:0;width:176px;height:100px;z-index:2147483000;overflow:hidden;pointer-events:none;";
  const shield = document.createElement("div");
  shield.style.cssText = "position:absolute;inset:0;background:#0a0a0a;z-index:1;";
  video.style.cssText = "position:absolute;left:0;top:0;width:176px;height:100px;opacity:1;z-index:0;border:0;object-fit:contain;background:#000;";
  wrap.appendChild(video);
  wrap.appendChild(shield);
  if (document.body) document.body.appendChild(wrap);
  video._capWrap = wrap;
  return video;
}

function cleanupVideo(video, url) {
  try {
    if (video) {
      try { video.pause(); } catch { /* */ }
      video.removeAttribute("src");
      try { video.load(); } catch { /* */ }
      const wrap = video._capWrap;
      if (wrap && wrap.parentNode) wrap.remove();
      else video.remove();
    }
  } catch { /* */ }
  try { if (url) URL.revokeObjectURL(url); } catch { /* */ }
}

/** 多帧 rVFC：给 iOS 多几次真正出帧的机会 */
async function waitFrames(video, n, eachMs) {
  for (let i = 0; i < n; i++) {
    const ok = await waitForFrame(video, eachMs);
    if (!ok) break;
  }
}

/** drawImage；若空白再试 createImageBitmap(video) */
async function drawFromVideo(video, w, h) {
  let shot = await drawToJpeg(video, w, h);
  if (!isBlankFrame(shot)) return shot;
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(video);
      try {
        shot = await drawToJpeg(bmp, bmp.width || w, bmp.height || h);
      } finally {
        try { bmp.close(); } catch { /* */ }
      }
    } catch { /* */ }
  }
  return shot;
}

/**
 * 空白则换时间点重试：~0.1s → 0.5s → 1s，并多等几帧。
 * 仍只读开头几秒，绝不整段播放大视频。
 */
async function captureShots(video, out, budget) {
  const dur = out.dur;
  const cand = [frameTime(dur), 0.5, 1.0];
  const times = [];
  for (const t of cand) {
    if (times.includes(t)) continue;
    if (Number.isFinite(dur) && dur > 0 && t >= dur) continue;
    times.push(t);
  }
  let last = null;
  for (const t of times) {
    const seeked = waitEvent(video, ["seeked"], Math.min(budget, 5000));
    try { video.currentTime = t; } catch { /* */ }
    await seeked;
    await waitFrames(video, 3, Math.min(budget, 1500));
    try { video.pause(); } catch { /* */ }
    last = await drawFromVideo(video, out.w, out.h);
    if (!isBlankFrame(last)) return last;
    try {
      await video.play();
      await waitFrames(video, 3, 1200);
      video.pause();
      last = await drawFromVideo(video, out.w, out.h);
      if (!isBlankFrame(last)) return last;
    } catch { /* */ }
  }
  return last;
}

/**
 * 在**当前调用栈**里尽快挂上 src 并 play()——文件选择的用户手势还在时最关键。
 * 返回句柄，稍后 await finishCapture(handle)。
 */
export function beginCapture(file, { mime } = {}) {
  const type = mime || (file && file.type) || "";
  const size = Number(file && file.size) || 0;
  const budget = size > 500 * 1024 * 1024 ? 30000
    : size > 80 * 1024 * 1024 ? 20000 : DEFAULT_TIMEOUT;
  const out = { w: 0, h: 0, dur: null, thumb: null, t0: Date.now() };
  if (!file || typeof document === "undefined" || !document.body) {
    return { promise: Promise.resolve({ ...out, reason: "nofile" }), cancel() {} };
  }
  /* 测试/异常路径可能塞进非 Blob；createObjectURL 会直接抛 */
  if (typeof Blob === "undefined" || !(file instanceof Blob)) {
    return { promise: Promise.resolve({ ...out, reason: "nofile" }), cancel() {} };
  }
  let url;
  try { url = URL.createObjectURL(file); }
  catch {
    return { promise: Promise.resolve({ ...out, reason: "nofile" }), cancel() {} };
  }
  const video = makeCaptureVideo();
  let cancelled = false;
  // 同步挂 src；立刻尝试 play（手势窗口）
  video.src = url;
  if (type) try { video.setAttribute("type", type); } catch { /* */ }
  if (video.load) video.load();
  let playP = null;
  try { playP = video.play(); } catch { playP = null; }

  const promise = (async () => {
    try {
      if (playP && typeof playP.then === "function") {
        try { await playP; } catch { /* 自动播放被拒：后面还有 seek 路径 */ }
      }
      /* 元数据可能在挂监听之前就到了（本地 File 极快）——先看 readyState，再等事件 */
      if (!(video.readyState >= 1 && video.videoWidth)) {
        const metaOk = await waitEvent(video, ["loadedmetadata", "loadeddata"], Math.min(budget, 15000));
        if (!metaOk && !(video.readyState >= 1 && video.videoWidth)) {
          out.w = video.videoWidth || 0;
          out.h = video.videoHeight || 0;
          out.dur = Number.isFinite(video.duration) ? video.duration : null;
          return { ...out, reason: "metatimeout" };
        }
      }
      if (cancelled) return { ...out, reason: "cancelled" };
      out.w = video.videoWidth || 0;
      out.h = video.videoHeight || 0;
      out.dur = Number.isFinite(video.duration) ? video.duration : null;
      if (!out.w || !out.h) return { ...out, reason: "nocodec" };

      let shot = await captureShots(video, out, budget);
      if (isBlankFrame(shot)) return { ...out, reason: "blank", ms: Date.now() - out.t0 };
      out.thumb = shot.thumb;
      out.ms = Date.now() - out.t0;
      return out;
    } catch (err) {
      return { ...out, reason: (err && err.name) || "error", ms: Date.now() - out.t0 };
    } finally {
      cleanupVideo(video, url);
    }
  })();

  return {
    promise,
    cancel() { cancelled = true; cleanupVideo(video, url); },
  };
}

/** 兼容旧调用：内部走 beginCapture（若已过手势窗口，仍尽量取帧） */
export async function captureCover(file, { mime, timeout, at } = {}) {
  void at; void timeout;
  const h = beginCapture(file, { mime });
  return h.promise;
}

/** 已有同源 URL（blob: / 流式）：同样入 DOM + 短 play + seek 0.1s */
export async function captureCoverFromUrl(src, mime, { timeout = DEFAULT_TIMEOUT, at } = {}) {
  const out = { w: 0, h: 0, dur: null, thumb: null, t0: Date.now() };
  if (!src || typeof document === "undefined" || !document.body) return { ...out, reason: "nofile" };
  let video = null;
  try {
    video = makeCaptureVideo();
    video.src = src;
    if (mime) try { video.setAttribute("type", mime); } catch { /* */ }
    if (video.load) video.load();
    try { const p = video.play(); if (p && p.then) await p; } catch { /* */ }

    if (!(video.readyState >= 1 && video.videoWidth)) {
      const metaOk = await waitEvent(video, ["loadedmetadata", "loadeddata"], Math.min(timeout, 15000));
      if (!metaOk && !(video.readyState >= 1 && video.videoWidth)) {
        out.w = video.videoWidth || 0;
        out.h = video.videoHeight || 0;
        out.dur = Number.isFinite(video.duration) ? video.duration : null;
        return { ...out, reason: "metatimeout" };
      }
    }
    out.w = video.videoWidth || 0;
    out.h = video.videoHeight || 0;
    out.dur = Number.isFinite(video.duration) ? video.duration : null;
    if (!out.w || !out.h) return { ...out, reason: "nocodec" };

    /* at 显式指定时只试该点；否则走 0.1/0.5/1s 多点重试 */
    let shot;
    if (at != null) {
      const seeked = waitEvent(video, ["seeked"], Math.min(timeout, 5000));
      try { video.currentTime = at; } catch { /* */ }
      await seeked;
      await waitFrames(video, 3, Math.min(timeout, 1500));
      try { video.pause(); } catch { /* */ }
      shot = await drawFromVideo(video, out.w, out.h);
      if (isBlankFrame(shot)) {
        try {
          await video.play();
          await waitFrames(video, 3, 1200);
          video.pause();
          shot = await drawFromVideo(video, out.w, out.h);
        } catch { /* */ }
      }
    } else {
      shot = await captureShots(video, out, timeout);
    }
    if (isBlankFrame(shot)) return { ...out, reason: "blank", ms: Date.now() - out.t0 };
    out.thumb = shot.thumb;
    out.ms = Date.now() - out.t0;
    return out;
  } catch (err) {
    return { ...out, reason: (err && err.name) || "error", ms: Date.now() - out.t0 };
  } finally {
    cleanupVideo(video, null);
  }
}

const sessionFailed = new Set();
let sessionGen = COVER_GEN;
function ensureSessionGen() {
  if (sessionGen !== COVER_GEN) { sessionFailed.clear(); sessionGen = COVER_GEN; }
}

function cachedUrl(media, id) {
  if (!media || typeof media.url !== "function") return null;
  try { return media.url("video", id) || null; } catch { return null; }
}

/** 本算法世代是否已试过（成功有 hasThumb；失败有 coverFailGen） */
function alreadyTried(it) {
  if (it.hasThumb) return true;
  const g = Number(it.coverFailGen) || 0;
  return g >= COVER_GEN;
}

/**
 * 懒补：一次最多 limit 条（调用方应传 1），每种算法世代每条只试一次。
 * 后台（hidden）直接跳过，不读媒体。
 */
export async function backfillVideoCovers(vault, {
  limit = 1, onOne, media, legacyMaxBytes = LEGACY_INLINE_MAX,
} = {}) {
  ensureSessionGen();
  const res = {
    fixed: 0, skipped: 0, failed: 0, deferred: 0, remaining: 0, unavailable: false, tried: 0,
  };
  const all = (vault.items || []).filter((it) => it.kind === "video" && !it.hasThumb && !it.trashedAt);
  const pending = all.filter((it) => !alreadyTried(it) && !sessionFailed.has(it.id));
  res.remaining = pending.length;
  if (!pending.length) return res;
  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    res.skipped = pending.length;
    return res;
  }

  let Stream = null;
  try { Stream = await import("./stream.js"); } catch { /* */ }
  const streamOk = !!(Stream && typeof Stream.urlFor === "function");
  const batch = pending.slice(0, Math.max(1, limit));

  for (const it of batch) {
    let release = null;
    res.tried++;
    try {
      if (document.visibilityState === "hidden") { res.skipped++; break; }
      const size = Number(it.size) || 0;
      let cover = null;
      let chunked = false;
      try { chunked = await vault.isChunked(it.id); } catch { chunked = false; }

      if (chunked) {
        // 小分块：拼成 Blob URL 取帧（有界）；大分块：流式 URL 只 seek 0.1s
        if (size > 0 && size <= legacyMaxBytes && typeof vault.readForExport === "function") {
          const bytes = await vault.readForExport(it.id);
          if (bytes && bytes.length) {
            cover = await captureCover(new Blob([bytes], { type: it.mime || "video/mp4" }), { mime: it.mime });
          }
        }
        if ((!cover || !cover.thumb) && streamOk) {
          const url = await Stream.urlFor(it.id);
          if (!url) { res.unavailable = true; res.skipped++; continue; }
          cover = await captureCoverFromUrl(url, it.mime);
          release = () => { try { Stream.releaseItem(it.id); } catch { /* */ } };
        } else if (!cover || !cover.thumb) {
          if (!streamOk) res.unavailable = true;
          res.skipped++;
          continue;
        }
      } else {
        const hot = cachedUrl(media, it.id);
        if (hot) cover = await captureCoverFromUrl(hot, it.mime);
        else if (size && size <= legacyMaxBytes) {
          const bytes = await vault.readBlob(it.id);
          if (!bytes) { res.skipped++; continue; }
          cover = await captureCover(new Blob([bytes], { type: it.mime || "video/mp4" }), { mime: it.mime });
        } else {
          // 大 legacy：等用户打开播放后 media 里有 URL 再补；本轮记 deferred，不写 coverFail
          res.deferred++;
          continue;
        }
      }

      if (!cover || !cover.thumb) {
        res.failed++;
        sessionFailed.add(it.id);
        it.coverFail = (cover && cover.reason) || "blank";
        it.coverFailAt = Date.now();
        it.coverFailGen = COVER_GEN;
        it.coverFailMs = cover && cover.ms || null;
        try { await vault.saveItem(it); } catch { /* */ }
        continue;
      }

      await vault.putThumb(it.id, cover.thumb);
      it.hasThumb = true;
      it.w = it.w || cover.w; it.h = it.h || cover.h;
      if (it.dur == null && cover.dur != null) it.dur = cover.dur;
      delete it.coverFail; delete it.coverFailAt; delete it.coverFailGen; delete it.coverFailMs;
      await vault.saveItem(it);
      res.fixed++;
      onOne && onOne(it);
    } catch (err) {
      res.failed++;
      sessionFailed.add(it.id);
      try {
        it.coverFail = (err && err.name) || "error";
        it.coverFailAt = Date.now();
        it.coverFailGen = COVER_GEN;
        await vault.saveItem(it);
      } catch { /* */ }
    } finally { if (release) release(); }
  }

  res.remaining = (vault.items || []).filter(
    (it) => it.kind === "video" && !it.hasThumb && !it.trashedAt && !alreadyTried(it),
  ).length;
  return res;
}

export function _resetBackfillSession() { sessionFailed.clear(); sessionGen = COVER_GEN; }

/**
 * 诊断：对每条视频读出缩略图字节并分析（不含明文视频、不含密钥）。
 * 返回的 previewUrl 由调用方在关闭对话框时 revoke。
 */
export async function diagnoseCovers(vault) {
  const items = (vault && vault.items) || [];
  const videos = items.filter((it) => it.kind === "video" && !it.trashedAt);
  const rows = [];
  for (const it of videos) {
    let insp = null;
    let readErr = null;
    if (it.hasThumb) {
      try {
        const bytes = await vault.readThumb(it.id);
        insp = await inspectThumbBytes(bytes);
      } catch (err) {
        readErr = (err && err.name) || "readerr";
        insp = await inspectThumbBytes(null);
      }
    } else {
      insp = await inspectThumbBytes(null);
    }
    const valid = !!(insp && insp.ok);
    rows.push({
      id: it.id,
      name: it.name,
      size: it.size,
      mime: it.mime,
      hasThumb: !!it.hasThumb,
      validCover: valid,
      dur: it.dur,
      w: it.w, h: it.h,
      coverFail: it.coverFail || null,
      coverFailGen: it.coverFailGen || null,
      coverFailAt: it.coverFailAt || null,
      coverFailMs: it.coverFailMs || null,
      thumbBytes: insp ? insp.bytes : 0,
      thumbMime: insp ? insp.mime : null,
      thumbW: insp ? insp.w : 0,
      thumbH: insp ? insp.h : 0,
      avgR: insp ? insp.avgR : 0,
      avgG: insp ? insp.avgG : 0,
      avgB: insp ? insp.avgB : 0,
      bright: insp ? Math.round(insp.bright) : 0,
      variance: insp ? Math.round(insp.variance) : 0,
      uniform: !!(insp && insp.uniform),
      tiny: !!(insp && insp.tiny),
      decodeOk: !!(insp && insp.decodeOk),
      previewUrl: insp ? insp.previewUrl : null,
      readErr,
      hypothesis: !it.hasThumb ? "no-record"
        : readErr ? "decrypt-fail"
        : !(insp && insp.decodeOk) ? "bad-bytes-or-mime"
        : (insp && insp.tiny) ? "tiny"
        : (insp && insp.uniform) ? "uniform-blank"
        : valid ? "ok-should-show" : "unknown",
    });
  }
  const withRecord = rows.filter((r) => r.hasThumb).length;
  const withValid = rows.filter((r) => r.validCover).length;
  return {
    coverGen: COVER_GEN,
    totalVideos: videos.length,
    withThumb: withValid,          /* 「有可用封面」= 能解码且非匀色/非极小 */
    withRecord,                    /* 元数据 hasThumb=true 的条数（可能是坏图） */
    missing: videos.length - withValid,
    rows,
  };
}

/**
 * 把「有记录但匀色/极小/解不出」的封面作废，让本世代重新取帧。
 * 返回作废条数。
 */
export async function invalidateBadThumbs(vault) {
  const items = (vault && vault.items) || [];
  let n = 0;
  for (const it of items) {
    if (it.kind !== "video" || it.trashedAt || !it.hasThumb) continue;
    let insp;
    try {
      const bytes = await vault.readThumb(it.id);
      insp = await inspectThumbBytes(bytes);
      if (insp.previewUrl) try { URL.revokeObjectURL(insp.previewUrl); } catch { /* */ }
    } catch {
      insp = { ok: false };
    }
    if (insp && insp.ok) continue;
    try {
      if (typeof vault.deleteThumb === "function") await vault.deleteThumb(it.id);
      else {
        const DB = await import("./db.js");
        await DB.del("thumbs", it.id);
      }
    } catch { /* */ }
    it.hasThumb = false;
    delete it.coverFail; delete it.coverFailAt; delete it.coverFailGen; delete it.coverFailMs;
    try { await vault.saveItem(it); } catch { /* */ }
    n++;
  }
  return n;
}
