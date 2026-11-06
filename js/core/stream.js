/**
 * 流式媒体 URL（页面侧，2.1.2）。
 *
 * 对外只暴露一个「给播放器用的 URL」——`urlFor(itemId)`：
 *   - 分块存储的条目 → 同源虚拟 URL `/__media/<token>/<itemId>`，由 sw.js + stream-sw.js
 *     按 HTTP Range 逐块解密；**不解密整份文件**，也不产生大 Blob。
 *   - 未解锁 / 无 SW → 返回 null（调用方退回旧路径）。
 * UI 层不需要知道这些：`media.ensure("video", id)` 依旧返回一个可以直接塞给 `<video src>` 的字符串。
 *
 * 生命周期（务必与 repo 的锁定流程连通，见 app.js）：
 *   解锁后首次取 URL → 懒授权（把**不可导出的** DEK 交给 SW，只在 SW 内存里）
 *   锁定 / visibilitychange=hidden / pagehide → revoke：SW 丢弃 key 并中止在途 stream
 *   SW 被浏览器重启 → grants 清空 → 403（fail-closed），页面下次取 URL 时自动重新授权
 *
 * 密钥边界：DEK 通过 postMessage 结构化克隆交给 SW，保持 non-extractable；
 * 本模块**不写** IndexedDB / localStorage / Cache / console；token 是随机 128 位、只在内存。
 */

import * as Chunks from "./chunks.js";

const ACK_TIMEOUT = 4000;

/**
 * 媒体虚拟 URL 必须落在当前页面所在目录（= SW scope）之下。
 * 线上是 .../calc/__media/...；根路径部署/测试仍是 .../__media/...。
 * 绝不能写成 location.origin + "/__media/"——那会跳出 /calc/ 作用域，SW 拦不到。
 */
function mediaHref(token, itemId) {
  const base = new URL("./", location.href);
  return new URL("__media/" + token + "/" + encodeURIComponent(itemId), base).href;
}

const state = {
  vault: null,
  media: null,
  token: null,
  ready: false,
  linking: null,
  gen: 0,              // 授权世代：revoke() 自增，用来判定「在途授权是否已过期」
  attached: false,
  lastRevokeReason: "",
  invalidators: new Set(),
};

function unlocked() {
  return !!(state.vault && state.vault.dekKey);
}

function hidden() {
  try { return typeof document !== "undefined" && document.visibilityState === "hidden"; }
  catch { return false; }
}

/** 通知订阅者（media 缓存）：所有虚拟 URL 已失效，必须重新 ensure 才能拿新 token */
function invalidateAll(reason) {
  for (const fn of [...state.invalidators]) {
    try { fn(reason); } catch { /* 订阅者自己的问题，不影响撤销 */ }
  }
}

/** 订阅「授权被撤销」：media cache 用它丢掉已缓存的旧 token URL（否则回前台永远 403） */
export function onInvalidate(fn) {
  if (typeof fn !== "function") return () => {};
  state.invalidators.add(fn);
  return () => state.invalidators.delete(fn);
}

function randomToken() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function controller() {
  try {
    return navigator.serviceWorker && navigator.serviceWorker.controller ? navigator.serviceWorker.controller : null;
  } catch { return null; }
}

/** 带 ACK 的 postMessage；超时/无控制器返回 null（调用方据此 fail-closed） */
function ask(msg) {
  const ctrl = controller();
  if (!ctrl) return Promise.resolve(null);
  return new Promise((resolve) => {
    const ch = new MessageChannel();
    const timer = setTimeout(() => resolve(null), ACK_TIMEOUT);
    ch.port1.onmessage = (ev) => { clearTimeout(timer); resolve(ev.data || null); };
    try { ctrl.postMessage(msg, [ch.port2]); }
    catch { clearTimeout(timer); resolve(null); }
  });
}

/** 等待 SW 可用（首次安装/激活时 controller 可能还没就绪） */
async function ensureController(timeout = 6000) {
  if (controller()) return true;
  if (!("serviceWorker" in navigator)) return false;
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { await navigator.serviceWorker.ready; } catch { /* ignore */ }
    if (controller()) return true;
    // ready 不会因 controller 变化而再次 resolve：新激活的 SW 由 controllerchange 通知，
    // 这里只需要短暂轮询即可（clients.claim 已在 activate 里调用）。
    await new Promise((r) => setTimeout(r, 100));
  }
  return !!controller();
}

/** 懒授权：把当前 DEK 交给 SW（只在解锁状态下可能成功） */
async function ensureGrant() {
  if (!unlocked()) return null;
  if (state.ready && state.token && controller()) return state.token;
  if (state.linking) return state.linking;
  const gen = state.gen;
  const stale = () => gen !== state.gen || !unlocked() || hidden();
  state.linking = (async () => {
    try {
      if (!(await ensureController())) return null;
      // 关键：ensureController / ACK 之间可能已经锁定、切后台或被 revoke。
      // 此时**绝不能再把 key 交给 SW**，也不能恢复旧授权（否则锁屏后 SW 仍持有 DEK）。
      if (stale()) return null;
      const key = state.vault.dekKey;
      if (!key) return null;
      const token = randomToken();
      const ack = await ask({ type: "dsm/grant", token, key });
      if (stale()) {
        // 授权消息已经在路上/已落地：立刻收回（幂等），保持 fail-closed
        try { controller()?.postMessage({ type: "dsm/revoke" }); } catch { /* ignore */ }
        return null;
      }
      if (!ack || !ack.ok) return null;
      state.token = token;
      state.ready = true;
      state.gen++;                       // 本次授权成为当前世代
      return token;
    } finally {
      state.linking = null;
    }
  })();
  return state.linking;
}

/**
 * 取某条目的虚拟 URL（同源、可 Range、SW 流式解密）。
 * 返回 null 表示当前不可用（未解锁 / 无 SW）——调用方应退回 legacy 路径或放弃。
 */
export async function urlFor(itemId, { mime } = {}) {
  const id = String(itemId || "");
  if (!id) return null;
  let chunked = false;
  try { chunked = await Chunks.isChunked(id); } catch { chunked = false; }
  if (!chunked) return null;
  const token = await ensureGrant();
  if (!token) return null;
  let ack = await ask({ type: "dsm/allow", token, id });
  if (!ack || !ack.ok) {
    // SW 可能刚被浏览器重启（内存授权全丢）：丢掉缓存 token，重新授权一次再试
    state.ready = false;
    state.token = null;
    const fresh = await ensureGrant();
    if (!fresh) return null;
    ack = await ask({ type: "dsm/allow", token: fresh, id });
    if (!ack || !ack.ok) { state.ready = false; return null; }
    void mime;
    return mediaHref(fresh, id);
  }
  void mime;   // Content-Type 由 chunkmeta 里的加密元数据决定，页面不额外传明文类型
  return mediaHref(token, id);
}

/** 释放单个条目的播放授权（查看器关闭 / 删除条目时） */
export function releaseItem(itemId) {
  const id = String(itemId || "");
  if (!state.token) return;
  void ask({ type: "dsm/drop", token: state.token, id });
}

/**
 * 撤销全部授权：SW 丢弃 key 并中止在途 stream。
 * 锁定、页面隐藏、pagehide 立即调用（不等 ACK —— 页面可能马上被杀）。
 */
export function revoke(reason = "manual") {
  state.lastRevokeReason = reason;
  state.ready = false;
  state.token = null;
  state.gen++;                       // 让在途 grant 失效（见 ensureGrant 的 stale 判定）
  const ctrl = controller();
  if (ctrl) {
    try { ctrl.postMessage({ type: "dsm/revoke" }); } catch { /* ignore */ }
  }
  invalidateAll(reason);             // 通知 media：所有虚拟 URL 作废，下次 ensure 重新授权
}

/** SW 重启后可恢复：解锁状态下重新授权（不触发任何明文读取） */
export async function restore() {
  if (!unlocked()) return false;
  if (hidden()) return false;        // 后台不提前把 key 交回 SW
  state.ready = false;
  state.token = null;
  const token = await ensureGrant();
  return !!token;
}

/** 诊断用状态（不含密钥 / token 明文之外的敏感信息，token 只在内存） */
export function status() {
  return {
    attached: state.attached,
    unlocked: !!(state.vault && state.vault.dekKey),
    granted: !!(state.ready && state.token),
    hasController: !!controller(),
    lastRevokeReason: state.lastRevokeReason,
  };
}

/**
 * 装配生命周期桥接（app.js 调用一次）：
 * - vault.onLock 链式接管（不覆盖 UI 已设置的 onLock）
 * - visibilitychange=hidden / pagehide → revoke（TASK 要求：立刻收回 key、中止在途 stream）
 * - controllerchange（SW 更新/重启）→ 解锁状态下重新授权
 */
export function attach({ vault, media } = {}) {
  if (vault) state.vault = vault;
  if (media) state.media = media;
  if (state.attached) return;

  if (vault) {
    const prev = vault.onLock;
    vault.onLock = function onLock() {
      revoke("lock");
      if (typeof prev === "function") prev.call(this);
    };
  }
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") { revoke("hidden"); return; }
      // 回到前台：解锁状态下重新授权（懒执行，不读明文），让旧的 /__media 403 不再是终态
      if (unlocked()) restore().catch(() => {});
    });
    window.addEventListener("pagehide", () => revoke("pagehide"));
  }
  if (typeof navigator !== "undefined" && navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      // 新 SW 接管后旧授权已失效：解锁状态下重新授权，否则保持 fail-closed
      state.ready = false;
      state.token = null;
      state.gen++;
      invalidateAll("controllerchange");
      if (unlocked() && !hidden()) restore().catch(() => {});
    });
  }
  state.attached = true;
}
