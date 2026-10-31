/**
 * 手动更新（DESIGN-NOTES §29 / §50）：
 * - App **永不自动切换版本**：Service Worker 不用 skipWaiting、不自动 reload；
 * - 联网且解锁后后台静默比对 version.json；有新版只提示，不下载激活；
 * - 用户点「点击更新」并确认 → 让新 SW 下载完成 → SKIP_WAITING → controllerchange 后 reload；
 * - 更新只换应用外壳，绝不触碰 IndexedDB 里的相册数据。
 */

import { APP_VERSION } from "../version.js";

const VERSION_URL = "version.json";

let registration = null;

export function currentVersion() { return APP_VERSION; }

/** 注册 Service Worker（首次安装即预缓存外壳；不自动激活新版本） */
export async function registerSW() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    registration = await navigator.serviceWorker.register("sw.js", { scope: "./" });
    return registration;
  } catch (err) {
    console.warn("Service Worker 注册失败", err);
    return null;
  }
}

/**
 * 等新 SW 进入 waiting（下载并安装完成）。返回 false 表示「这次没拿到新版本」：
 * - grace 毫秒内既没有 installing 也没有 waiting → update() 根本没拿到新脚本（离线 / 404）；
 * - 中途 installing 消失且没有 waiting → 安装失败（worker 变 redundant，预缓存没下全）。
 * 用轮询而不是监听 updatefound：update() 可能在监听挂上之前就已经把新 worker 装进 waiting，
 * 那样监听会永远等不到，白等满超时才误报「更新失败」。
 */
async function waitWaiting(reg, { grace = 1500, timeout = 20000 } = {}) {
  const t0 = Date.now();
  let sawWorker = false;
  for (;;) {
    if (reg.waiting) return true;
    if (reg.installing) sawWorker = true;
    else if (!reg.waiting) {
      if (sawWorker) return false;                  // install 掉了：预缓存失败
      if (Date.now() - t0 > grace) return false;    // 完全没有新 worker
    }
    if (Date.now() - t0 > timeout) return false;
    await new Promise((r) => setTimeout(r, 100));
  }
}

/**
 * 静默检查：返回 {available:boolean, version?:string}
 * 离线 / 404 / 解析失败一律当作「已是最新 / 无法检查」，不报错、不弹窗。
 */
export async function checkForUpdate() {
  try {
    const res = await fetch(VERSION_URL + "?t=" + Date.now(), { cache: "no-store" });
    if (!res.ok) return { available: false };
    const data = await res.json();
    const next = String(data && data.version || "").trim();
    if (!next || next === APP_VERSION) return { available: false };
    return { available: true, version: next };
  } catch {
    return { available: false };
  }
}

/** 等当前正在安装的 worker 有结论（进 waiting 或变 redundant），最多 ms 毫秒 */
async function waitInstallingSettled(reg, ms = 6000) {
  const t0 = Date.now();
  while (reg.installing && !reg.waiting && Date.now() - t0 < ms) {
    await new Promise((r) => setTimeout(r, 100));
  }
}

/**
 * 应用更新。成功时页面会 reload（不返回）；失败抛错，由调用方显示「更新失败，已保留原版本 X」。
 * 失败要**尽快**报出来（网络断了就别让用户盯着「正在更新」干等 20 秒）。
 */
export async function applyUpdate(onStage) {
  if (!("serviceWorker" in navigator)) throw new Error("当前环境不支持离线更新");
  const reg = registration || (await navigator.serviceWorker.getRegistration());
  if (!reg) throw new Error("未找到已安装的应用版本");
  onStage && onStage("checking");
  /* 浏览器可能正在装一个 worker（页面加载后的自动检查 / 上一次失败留下的）：
     先等它有结论，否则 update() 会立刻返回、我们却盯着那个 worker 的结果误判失败。 */
  if (reg.installing) await waitInstallingSettled(reg);
  if (!reg.waiting) {                       // 已经下载好在 waiting：直接激活，不需要网络
    try { await reg.update(); } catch { /* 网络失败：下面按「没有新 worker」处理 */ }
    const ready = await waitWaiting(reg);
    if (!ready || !reg.waiting) throw new Error("新版本下载未完成");
  }
  onStage && onStage("activating");
  await new Promise((resolve) => {
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    navigator.serviceWorker.addEventListener("controllerchange", finish, { once: true });
    reg.waiting.postMessage({ type: "SKIP_WAITING" });
    setTimeout(finish, 4000);
  });
  location.reload();
}
