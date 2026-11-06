/**
 * 视频首帧封面（2.1.2）。
 *
 * 背景（2.1.0/2.1.1 的问题，实测原因见 NOTES-212-import.md §1）：
 *  - 旧实现先 `await file.arrayBuffer()` 把整段视频读进内存（300 MB 视频 = 明文 + Blob 两份），
 *    再 `new Blob([buffer])` 给 `<video>`；大视频在手机上直接 OOM / 卡住，封面与整条导入一起没；
 *  - 旧实现给 src 加了 `#t=0.1`，media fragment 在 metadata 阶段**已经**把 currentTime 设成 0.1
 *    并触发过 `seeked`；随后再 `video.currentTime = 0.1`，值没变 → 不会再触发 seeked，
 *    而 `onseeked` 是这之后才挂上的 → 只能等 2.5 s 超时。每个视频固定多等 2.5 秒。
 *
 * 本模块的约定：
 *  - **只吃 File/Blob**，绝不整份 arrayBuffer；objectURL 由 File 直接创建，用完立刻 revoke；
 *  - seek 事件先挂监听再改 currentTime，并且用 `readyState/currentTime` 判断「已经在目标位置」时不空等；
 *  - 任何一步超时 / 解码失败 / 抛错都只返回 `thumb:null`，**不影响导入本身**；
 *  - 取到的 JPEG 字节交给仓储的加密 thumbs store（调用方负责），明文只在内存里短暂存在。
 */

const DEFAULT_TIMEOUT = 8000;

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

function drawToJpeg(source, w, h) {
  const MAX = 320;
  const scale = Math.min(1, MAX / Math.max(w || 1, h || 1));
  const tw = Math.max(1, Math.round((w || 1) * scale));
  const th = Math.max(1, Math.round((h || 1) * scale));
  const canvas = document.createElement("canvas");
  canvas.width = tw; canvas.height = th;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(source, 0, 0, tw, th);
  // 全黑帧（iOS 上未出画时常见）视为失败，交给调用方决定是否兜底
  let bright = 0;
  try {
    const d = ctx.getImageData(0, 0, tw, th).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += (d[i] + d[i + 1] + d[i + 2]) / 3;
    bright = sum / (d.length / 4);
  } catch { bright = 1; }              // 读不到像素（理论上同源不会发生）就不做判断
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) return resolve({ thumb: null, bright });
      blob.arrayBuffer().then((buf) => resolve({ thumb: new Uint8Array(buf), bright }), () => resolve({ thumb: null, bright }));
    }, "image/jpeg", 0.72);
  });
}

/** 等待某个媒体事件，已满足条件时立刻返回（不空等超时） */
function waitEvent(el, names, ms) {
  return withTimeout(new Promise((resolve) => {
    const ok = () => { names.forEach((n) => el.removeEventListener(n, ok)); resolve(true); };
    names.forEach((n) => el.addEventListener(n, ok, { once: true }));
  }), ms, false);
}

/**
 * 从 File/Blob 提取视频首帧 + 尺寸 + 时长。
 * @returns {Promise<{w:number,h:number,dur:number|null,thumb:Uint8Array|null,reason?:string}>}
 *          永不抛错；失败了只是 thumb === null。
 */
export async function captureCover(file, { mime, timeout, at } = {}) {
  const out = { w: 0, h: 0, dur: null, thumb: null };
  if (!file || typeof document === "undefined") return { ...out, reason: "nofile" };
  const type = mime || file.type || "";
  // 大文件在 iOS 上取 metadata 更慢；给足时间，但仍有上限，失败只影响封面不影响导入
  const size = Number(file.size) || 0;
  const budget = timeout != null ? timeout
    : (size > 500 * 1024 * 1024 ? 25000 : size > 80 * 1024 * 1024 ? 15000 : DEFAULT_TIMEOUT);
  let url = null;
  let video = null;
  try {
    url = URL.createObjectURL(file);            // 直接用 File，不做整份 arrayBuffer
    video = document.createElement("video");
    video.preload = "auto";                     // metadata 不够：取帧需要数据
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    /* 不要设 crossOrigin：blob: URL 上设了会让 canvas 被污染，toBlob/getImageData 失败 → 封面永远为空（iOS 尤甚） */
    video.style.cssText = "position:fixed;left:-2px;top:-2px;width:1px;height:1px;opacity:0;pointer-events:none;";
    video.src = url;
    video.load && video.load();

    const metaOk = await waitEvent(video, ["loadedmetadata", "loadeddata"], Math.min(budget, 12000));
    out.w = video.videoWidth || 0;
    out.h = video.videoHeight || 0;
    out.dur = Number.isFinite(video.duration) ? video.duration : null;
    if (!metaOk || !out.w || !out.h) return { ...out, reason: metaOk ? "nocodec" : "metatimeout" };

    const target = at == null ? frameTime(out.dur) : at;
    // 事件先挂、再改时间；已经在该位置（部分浏览器会因 src 片段自动 seek）就不等
    const seeked = waitEvent(video, ["seeked", "loadeddata"], Math.min(budget, 6000));
    try { video.currentTime = target; } catch { /* 某些编码不可 seek，用当前帧 */ }
    await seeked;
    if (video.readyState < 2) await waitEvent(video, ["loadeddata", "canplay"], 1500);

    let shot = await drawToJpeg(video, out.w, out.h);
    if ((!shot.thumb || shot.bright < 2) && !document.hidden) {
      // iOS 常见：detached / 未播放过的 <video> 画不出帧。挂到文档里短暂静音播一下拿到第一帧。
      try {
        document.body.appendChild(video);
        video.currentTime = target;
        await video.play();
        await new Promise((r) => setTimeout(r, 60));
        video.pause();
        shot = await drawToJpeg(video, out.w, out.h);
      } catch { /* 自动播放被拒 → 保留第一张（可能为空） */ }
    }
    out.thumb = shot && shot.thumb ? shot.thumb : null;
    if (!out.thumb) out.reason = "blank";
    return out;
  } catch (err) {
    out.reason = (err && err.name) || "error";
    return out;
  } finally {
    try { if (video) { video.pause(); video.removeAttribute("src"); video.load(); video.remove(); } } catch { /* ignore */ }
    try { if (url) URL.revokeObjectURL(url); } catch { /* ignore */ }
    void type;   // 编码/封装是否被支持由浏览器判定，不在这里猜
  }
}

/**
 * legacy（2.1.1 及更早）单 blob 视频「顺序整份解密」的安全上限。
 *
 * 理由（写进 NOTES/DONE-REPORT，别改成拍脑袋的数）：
 *  - 这条路必须把整份明文读进内存（旧格式就是一个加密 blob，没有 Range 能力），
 *    峰值 ≈ 明文字节 + 交给 `<video>` 的 Blob 快照 ≈ 2 × size，短时间还要再叠一张 320px 封面；
 *  - iOS Safari 单个标签页的实际可用堆在几百 MB 级，且锁屏/切后台随时可能被系统回收；
 *  - 12 MiB 覆盖「相册里随手拍的几秒~几十秒短片」，峰值 ~24 MiB，属于移动端安全区；
 *    超过它的旧视频**绝不**为了封面去额外解密整份文件，改为等用户自己打开播放时
 *    复用 media 缓存里已经存在的 blob URL（见 mediaUrl 参数），零额外解密、零额外复制。
 */
export const LEGACY_INLINE_MAX = 12 * 1024 * 1024;

/* 本会话内已经尝试过、确实失败的条目（编码不支持等）：不重复烧电、不重复解密。
   只在内存里，刷新页面 / 换新版本后自然重试（不写任何持久标记）。 */
const sessionFailed = new Set();

/** 该条目的「已解密 URL」（用户打开播放时 media 缓存里的 blob:/虚拟 URL）；没有则返回 null */
function cachedUrl(media, id) {
  if (!media || typeof media.url !== "function") return null;
  try { return media.url("video", id) || null; } catch { return null; }
}

/**
 * 已导入但没有封面的视频：懒补封面。**不重导入、不动原件、不重写 blob/chunk 数据。**
 *
 * 三条路径：
 *  1. 分块条目（2.1.2 新导入）→ `Stream.urlFor()` 虚拟 Range URL，逐块解密，不整份进内存；
 *  2. legacy 单 blob 且 size ≤ LEGACY_INLINE_MAX → 顺序整份解密一次取帧（峰值有界，见上）；
 *  3. legacy 单 blob 且更大 → **不额外解密**：只在用户已经打开播放、media 缓存里已有该条目的
 *     blob URL 时复用它取帧；否则计入 `deferred`，下次（再次解锁 / 用户打开该视频）继续尝试。
 *
 * 未取到封面（编码不支持 / 解码超时 / 取到全黑帧）一律 `failed` 且**不写 hasThumb**，
 * 不假装成功；同一会话内不再重试同一项。
 *
 * @returns {Promise<{fixed:number,skipped:number,failed:number,deferred:number,remaining:number,unavailable:boolean}>}
 *          remaining = 本次结束后仍缺封面的视频数（>0 表示调用方应在下次机会继续跑）
 */
export async function backfillVideoCovers(vault, { limit = 8, onOne, media, legacyMaxBytes = LEGACY_INLINE_MAX } = {}) {
  const res = { fixed: 0, skipped: 0, failed: 0, deferred: 0, remaining: 0, unavailable: false };
  const all = (vault.items || []).filter((it) => it.kind === "video" && !it.hasThumb && !it.trashedAt);
  res.remaining = all.length;
  if (!all.length) return res;
  const todo = all.filter((it) => !sessionFailed.has(it.id));
  if (!todo.length) return res;
  const batch = todo.slice(0, limit);

  let Stream = null;
  try { Stream = await import("./stream.js"); } catch { /* 离线/旧 SW：分块条目暂时补不了 */ }
  const streamOk = !!(Stream && typeof Stream.urlFor === "function");

  for (const it of batch) {
    let url = null, release = null;
    try {
      const size = Number(it.size) || 0;
      let cover = null;
      let chunked = false;
      try { chunked = await vault.isChunked(it.id); } catch { chunked = false; }

      if (chunked) {
        if (!streamOk) { res.unavailable = true; res.skipped++; continue; }
        url = await Stream.urlFor(it.id);
        if (!url) { res.skipped++; continue; }
        cover = await captureCoverFromUrl(url, it.mime);
        release = () => { try { Stream.releaseItem(it.id); } catch { /* ignore */ } };
      } else {
        // legacy 单 blob：优先复用「用户已经打开播放」时缓存的 URL（不解密、不复制）
        const hot = cachedUrl(media, it.id);
        if (hot) cover = await captureCoverFromUrl(hot, it.mime);
        else if (size && size <= legacyMaxBytes) {
          const bytes = await vault.readBlob(it.id);           // 只读，绝不回写 → 原字节/EXIF 不变
          if (!bytes) { res.skipped++; continue; }
          cover = await captureCover(new Blob([bytes], { type: it.mime || "video/mp4" }), { mime: it.mime });
        } else {
          // 大 legacy / 尺寸未知：不为封面额外整份解密，留给「打开播放」或下次解锁
          res.deferred++;
          continue;
        }
      }

      if (!cover || !cover.thumb) {
        res.failed++;
        sessionFailed.add(it.id);                 // 编码不支持 / 全黑帧：本会话不再重试，不谎报成功
        continue;
      }
      await vault.putThumb(it.id, cover.thumb);   // 加密存储（AES-GCM，AAD 绑定 itemId）
      it.hasThumb = true;
      it.w = it.w || cover.w; it.h = it.h || cover.h;
      if (it.dur == null && cover.dur != null) it.dur = cover.dur;
      await vault.saveItem(it);                   // 只更新元数据字段，blob/chunks 原样不动
      res.fixed++;
      onOne && onOne(it);
    } catch {
      res.failed++;
      sessionFailed.add(it.id);
    } finally { if (release) release(); }
  }
  res.remaining = Math.max(0, res.remaining - res.fixed - res.failed);
  return res;
}

/** 测试/诊断用：清空「本会话已失败」的记忆（不写持久状态） */
export function _resetBackfillSession() { sessionFailed.clear(); }

/** 同 captureCover，但输入是已存在的 URL（虚拟流式 URL），不负责 revoke */
async function captureCoverFromUrl(src, mime) {
  const out = { w: 0, h: 0, dur: null, thumb: null };
  let video = null;
  try {
    video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.style.cssText = "position:fixed;left:-2px;top:-2px;width:1px;height:1px;opacity:0;pointer-events:none;";
    video.src = src;
    const ok = await waitEvent(video, ["loadedmetadata", "loadeddata"], 6000);
    out.w = video.videoWidth || 0; out.h = video.videoHeight || 0;
    out.dur = Number.isFinite(video.duration) ? video.duration : null;
    if (!ok || !out.w || !out.h) return out;
    const target = frameTime(out.dur);
    const seeked = waitEvent(video, ["seeked", "loadeddata"], 4000);
    try { video.currentTime = target; } catch { /* ignore */ }
    await seeked;
    if (video.readyState < 2) await waitEvent(video, ["loadeddata", "canplay"], 1500);
    const shot = await drawToJpeg(video, out.w, out.h);
    out.thumb = shot && shot.thumb ? shot.thumb : null;
    void mime;
    return out;
  } catch { return out; }
  finally {
    try { if (video) { video.pause(); video.removeAttribute("src"); video.load(); video.remove(); } } catch { /* ignore */ }
  }
}
