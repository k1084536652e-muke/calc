/**
 * Service Worker（§29 / P4）：
 * - 安装即预缓存完整 app shell（含 vendored 库、图标、manifest），断网可冷启动；
 * - **不自动激活**：新 SW 装好后留在 waiting，等用户在「设置 › 版本」确认后发 SKIP_WAITING；
 *   唯一例外是「从旧版 2.0.0 首次升级」那一次，见下方 isFirstUpgradeFromLegacy()；
 * - 更新只替换外壳缓存，不触碰 IndexedDB（相册数据在页面侧，SW 从不读写）；
 * - version.json 永远走网络（更新检查需要拿到线上版本），不进缓存。
 */

const VERSION = "2.2.2";
const CACHE = "daishui-shell-" + VERSION;

/** 本 App（2.1.x）外壳缓存前缀 */
const CACHE_PREFIX = "daishui-shell-";
/** 旧 App 2.0.0「房贷计算器」的外壳缓存前缀（见 calc-vault/sw.js: `finance-shell-${APP_VERSION}`） */
const LEGACY_CACHE_PREFIX = "finance-shell-";

const ASSETS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/app.css",
  "js/app.js",
  "js/ui.js",
  "js/version.js",
  "js/theme-boot.js",
  "js/sa-fix.js",
  "js/ui/doc-editor.js",
  "js/legacy-migrate.js",
  "js/core/calc.js",
  "js/core/chunks.js",
  "js/core/cover.js",
  "js/core/crypto.js",
  "js/core/db.js",
  "js/core/media.js",
  "js/core/repo.js",
  "js/core/stream.js",
  "js/core/stream-sw.js",
  "js/core/updater.js",
  /* 2.0.0 → 2.1.0 自动迁移模块（被 js/legacy-migrate.js 静态 import，运行期必然会加载） */
  "src/migrate-2.0/index.js",
  "src/migrate-2.0/legacy-crypto.js",
  "src/migrate-2.0/legacy-db.js",
  "src/migrate-2.0/legacy-format.js",
  "vendor/plyr/plyr.min.js",
  "vendor/plyr/plyr.css",
  "vendor/plyr/plyr.svg",
  "vendor/plyr/blank.mp4",
  "vendor/tiptap/tiptap.bundle.js",
  "vendor/dompurify/purify.es.mjs",
  "icons/favicon.png",
  "icons/apple-touch-icon.png",
  "icons/icon-180.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-512-maskable.png"
];

/**
 * 一次性过渡规则：从旧版 2.0.0 首次升级上来的那一次，安装后立即接管（skipWaiting）。
 *
 * 为什么必须这么做：2.0.0 的界面里**没有任何「检查更新 / 手动更新」按钮**——它自己 install 完就
 * skipWaiting，靠浏览器对 sw.js 的字节比对自动更新。如果 2.1.0 沿用「装好先留在 waiting」的默认规则，
 * 装了 2.0.0 的手机拿到 2.1.0 的 sw.js 后，新 SW 会永远卡在 waiting，而旧界面里没有入口去激活它
 * （只能等所有窗口都关闭；iOS 主屏 Web App 上这一点极不可靠）。
 *
 * 判据（必须在**写入本版外壳缓存之前**判断）：Cache Storage 里存在旧版外壳缓存 `finance-shell-*`，
 * 且不存在任何本版外壳缓存 `daishui-shell-*`。即「上一次运行的是 2.0.0，这是第一次跑 2.1.x」。
 * 2.1.x 之间的更新不满足该条件（此时已存在 daishui-shell-*）→ 仍然走手动更新，规则不变。
 *
 * 只读 Cache Storage 的键名，不读写任何 Cache 内容，更不接触 IndexedDB。
 */
async function isFirstUpgradeFromLegacy() {
  try {
    const keys = await caches.keys();
    return keys.some((k) => k.startsWith(LEGACY_CACHE_PREFIX)) && !keys.some((k) => k.startsWith(CACHE_PREFIX));
  } catch {
    return false;   /* 拿不到缓存列表时按「不是升级」处理：宁可等用户手动确认，也不擅自接管 */
  }
}

/**
 * 流式媒体模块（js/core/stream-sw.js）——经典脚本，用 importScripts 加载。
 *
 * 为什么不是 module：本 SW 以经典脚本注册；规范禁止在经典 ServiceWorkerGlobalScope 用 `import()`，
 * 而把注册改成 `{type:"module"}` 会导致已装 2.1.1 的存量用户升级失败（注册类型不可变更）。
 * importScripts 的脚本会随 SW 一起被浏览器缓存，断网冷启动同样可用。
 * 加载失败（文件缺失）→ 媒体请求 fail-closed 返回 503，绝不解密任何数据。
 */
/**
 * 部署根路径（与 SW 作用域一致）。
 * 线上挂在 GitHub Pages 子目录 /calc/，本地测试挂在 /。
 * 绝不能写死成站点根路径：否则 importScripts 404、虚拟媒体 URL 落在 SW 作用域外。
 */
const SCOPE_PATH = (() => {
  try {
    const u = new URL("./", self.location.href);
    let path = u.pathname || "/";
    if (!path.endsWith("/")) path += "/";
    return path;
  } catch {
    return "/";
  }
})();

try {
  importScripts(new URL("js/core/stream-sw.js", self.location.href).href);
} catch (err) { /* 见 fetch 分支的 503 兜底 */ }

/** 加密媒体虚拟 URL 前缀（必须落在本 SW 作用域内，例：/calc/__media/） */
const MEDIA_PREFIX = SCOPE_PATH + "__media/";

function streamModule() {
  return self.__dsStream || null;
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const takeover = await isFirstUpgradeFromLegacy();   /* 必须在 caches.open(CACHE) 之前判断 */
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS);
    if (takeover) {
      await self.skipWaiting();   /* 一次性：从 2.0.0 升上来时立即接管，旧界面无需（也无法）提供按钮 */
      return;
    }
    /* 其余情况显式不调用 skipWaiting：等用户在「设置 › 版本」确认更新 */
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((k) => (k.startsWith(CACHE_PREFIX) && k !== CACHE) || k.startsWith(LEGACY_CACHE_PREFIX))
      .map((k) => caches.delete(k)));
    /* ↑ 只删 Cache Storage：旧版 2.0.0 的 IndexedDB（calc-data-current）必须原样保留，
       2.1.0 的自动迁移要读它、回滚也要靠它——这里**绝不**碰 indexedDB。 */
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (data && data.type === "SKIP_WAITING") { self.skipWaiting(); return; }
  if (!data || typeof data.type !== "string" || !data.type.startsWith("dsm/")) return;

  /* 流式媒体的授权消息（grant/allow/drop/revoke）：
     key 只进内存；本 SW 重启后 Map 为空 → fail-closed（见 js/core/stream-sw.js）。
     回复走 MessageChannel，页面等 ACK 后才把 URL 交给播放器。 */
  const port = event.ports && event.ports[0];
  const clientId = event.source && event.source.id ? event.source.id : "";
  event.waitUntil((async () => {
    let reply = { ok: false, reason: "UNAVAILABLE" };
    try {
      const mod = streamModule();
      if (mod) reply = mod.onMessage(data, clientId) || reply;
    } catch {
      reply = { ok: false, reason: "MODULE" };
    }
    if (port) { try { port.postMessage(reply); } catch { /* 页面已关闭 */ } }
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" && req.method !== "HEAD") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;          // 绝不接触跨域请求（应用本身无外部依赖）

  /* 加密媒体的虚拟 URL：**必须**排在所有缓存分支之前。
     它由 IndexedDB 里的密文按 Range 现场解密生成，既不能读缓存也不能写缓存
     （一旦进了 app shell 缓存就等于把明文落盘）。 */
  if (url.pathname.startsWith(MEDIA_PREFIX)) {
    event.respondWith((async () => {
      try {
        const mod = streamModule();
        if (!mod) throw new Error("stream module unavailable");
        return await mod.handleFetch(req, { clientId: event.clientId || "" });
      } catch {
        return new Response("streaming unavailable", {
          status: 503,
          headers: { "Cache-Control": "no-store" },
        });
      }
    })());
    return;
  }

  if (url.pathname.endsWith("/version.json")) return;        // 更新检查必须拿线上版本

  /* 页面导航：始终用**本 SW 自己那份**外壳缓存（App 只用已激活的版本）。
     不能写 caches.match(...)——更新时新旧两份 shell 缓存同时存在，跨缓存查找的结果取决于
     缓存创建顺序，可能把尚未激活的新 index.html 发给旧版本页面。 */
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = (await cache.match("index.html")) || (await cache.match("./"));
      if (hit) return hit;
      try { return await fetch(req); } catch { return new Response("", { status: 504, statusText: "offline" }); }
    })());
    return;
  }

  event.respondWith(
    caches.open(CACHE).then((cache) => cache.match(req, { ignoreSearch: true })).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.ok && res.type === "basic" && res.status === 200 && !req.headers.has("range")) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => new Response("", { status: 504, statusText: "offline" }));
    })
  );
});
