/**
 * 视频/大文件「虚拟 URL」流式响应（Service Worker 侧，2.1.2）—— **经典脚本**。
 *
 * 为什么不是 ES module：本 App 的 SW 以经典脚本注册（`register("sw.js")`）。
 * 规范明确禁止在经典 ServiceWorkerGlobalScope 里使用 `import()`，而把注册改成
 * `{type:"module"}` 会让已装 2.1.1 的存量用户升级失败（注册类型不可变更），
 * 因此这里用 `importScripts()` 加载一个自包含的经典脚本。
 *
 * 与 js/core/chunks.js 的**契约**（两边必须一致，e2e-streaming 用真实数据逐字节验证）：
 *   chunkmeta: {id, state:"ready", total, chunkSize, size, km}
 *   chunks   : {itemId, index, iv, ct}，主键 ['itemId','index']
 *   AAD      : `daishui/chunk/${itemId}/${index}/${total}` / `daishui/chunkmeta/${itemId}`
 * 这里**只做读取**，绝不写入任何 store；也不做 schema 升级（open 不带版本号）。
 *
 * 安全边界（详见 NOTES-212-streaming.md）：
 * - key（不可导出的 CryptoKey）与 token 只存在 SW 内存，不写 IDB / Cache / localStorage / 日志。
 * - 授权按 clientId 隔离：fetch 的 event.clientId 必须等于授权的 clientId（别的标签页 403）。
 * - revoke（锁定 / 页面隐藏 / pagehide）立刻丢 key 并中止在途 stream。
 * - SW 重启后内存清空 → 一律 403（fail-closed），页面重新授权即恢复。
 * - 明文只在单块范围内存在，响应头 no-store；本路径绝不进入 app shell 缓存。
 */
(function () {
  "use strict";

  var DB_NAME = "daishui-vault";
  var MEDIA_PREFIX = "/__media/";
  var MIME_RE = /^[a-z0-9.+-]+\/[a-z0-9.+-]+(\s*;\s*charset=[\w-]+)?$/i;
  var enc = new TextEncoder();

  /** token → {token, clientId, key, items:Set, aborts:Set, at} */
  var grants = new Map();
  var counters = { granted: 0, revoked: 0, denied: 0, served: 0, aborted: 0 };

  /* ---------------- IndexedDB 只读访问（不升级、不写入） ---------------- */

  var dbPromise = null;
  function openDb() {
    if (!dbPromise) {
      dbPromise = new Promise(function (resolve, reject) {
        var req = indexedDB.open(DB_NAME);          // 不带版本：只读，绝不触发升级
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
        req.onblocked = function () { reject(new Error("blocked")); };
      }).catch(function (err) { dbPromise = null; throw err; });
    }
    return dbPromise;
  }

  function idbGet(store, key) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(store, "readonly");
        var req = tx.objectStore(store).get(key);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  /* ---------------- 解密 ---------------- */

  function decrypt(key, rec, aad) {
    return crypto.subtle.decrypt(
      { name: "AES-GCM", iv: rec.iv, additionalData: enc.encode(aad) },
      key,
      rec.ct
    ).then(function (buf) { return new Uint8Array(buf); });
  }

  function chunkAad(itemId, index, total) {
    return "daishui/chunk/" + itemId + "/" + index + "/" + total;
  }

  function metaAad(itemId) { return "daishui/chunkmeta/" + itemId; }

  function safeMime(mime) {
    var m = String(mime || "");
    return MIME_RE.test(m) ? m : "application/octet-stream";
  }

  /** 读取并解密单块 */
  function readChunk(itemId, index, total, key) {
    return idbGet("chunks", [itemId, index]).then(function (rec) {
      if (!rec) throw new Error("MISSING chunk " + index);
      return decrypt(key, rec, chunkAad(itemId, index, total));
    });
  }

  /** 与 js/core/chunks.js 的 chunkStream 等价：只解密覆盖 [start,end) 的块 */
  async function* chunkStream(itemId, start, end, meta, key) {
    var cs = meta.chunkSize;
    var size = meta.size;
    var s = Math.max(0, Math.min(size, Math.floor(start)));
    var e = Math.max(s, Math.min(size, Math.floor(end)));
    if (e === s) return;
    var first = Math.floor(s / cs);
    var last = Math.floor((e - 1) / cs);
    for (var i = first; i <= last; i++) {
      var data = await readChunk(itemId, i, meta.total, key);
      var chunkStart = i * cs;
      var from = Math.max(0, s - chunkStart);
      var to = Math.min(data.length, e - chunkStart);
      yield data.subarray(from, to);
    }
  }

  function contentType(meta, key) {
    if (!meta.km || !key) return Promise.resolve(safeMime(meta.mime));
    return decrypt(key, meta.km, metaAad(meta.id)).then(function (bytes) {
      var info = JSON.parse(new TextDecoder().decode(bytes));
      return safeMime(info && info.mime);
    }).catch(function () { return safeMime(meta.mime); });
  }

  /* ---------------- 授权 ---------------- */

  function dropGrant(g) {
    g.aborts.forEach(function (h) { h.dead = true; });
    g.aborts.clear();
    g.key = null;
    g.items.clear();
    grants.delete(g.token);
    counters.revoked++;
  }

  function clientGrants(clientId) {
    var out = [];
    grants.forEach(function (g) { if (g.clientId === clientId) out.push(g); });
    return out;
  }

  function revokeClient(clientId) {
    var list = clientGrants(clientId);
    list.forEach(dropGrant);
    return list.length;
  }

  /** 页面消息（grant / allow / drop / revoke / stats）。返回给页面的 ACK */
  function onMessage(data, sourceId) {
    if (!data || typeof data !== "object") return null;
    var type = String(data.type || "");
    if (type.indexOf("dsm/") !== 0) return null;
    if (!sourceId) { counters.denied++; return { ok: false, reason: "NO_CLIENT" }; }

    if (type === "dsm/grant") {
      var token = String(data.token || "");
      if (!token || token.length > 128 || !/^[A-Za-z0-9_-]+$/.test(token)) {
        counters.denied++;
        return { ok: false, reason: "BAD_TOKEN" };
      }
      var key = data.key;
      // CryptoKey 是结构化克隆的合法类型；其他任何形态一律拒绝
      if (!key || key.type !== "secret" || !key.algorithm || key.algorithm.name !== "AES-GCM") {
        counters.denied++;
        return { ok: false, reason: "BAD_KEY" };
      }
      var prev = grants.get(token);
      if (prev) dropGrant(prev);
      clientGrants(sourceId).forEach(dropGrant);   // 一个页面只保留一份有效授权
      grants.set(token, {
        token: token, clientId: sourceId, key: key,
        items: new Set(), aborts: new Set(), at: Date.now(),
      });
      counters.granted++;
      return { ok: true, token: token };
    }

    // 撤销不需要 token：按发起页面（clientId）收回，页面可能已经被锁、手里没有 token
    if (type === "dsm/revoke") { revokeClient(sourceId); return { ok: true }; }

    var g = grants.get(String(data.token || ""));
    if (!g || g.clientId !== sourceId) { counters.denied++; return { ok: false, reason: "NO_GRANT" }; }

    if (type === "dsm/allow") {
      var id = String(data.id || "");
      if (!id) return { ok: false, reason: "BAD_ID" };
      g.items.add(id);
      return { ok: true };
    }
    if (type === "dsm/drop") { g.items.delete(String(data.id || "")); return { ok: true }; }
    if (type === "dsm/stats") {
      return { ok: true, counters: Object.assign({}, counters), grants: grants.size, items: g.items.size };
    }
    return { ok: false, reason: "UNKNOWN" };
  }

  /* ---------------- Range 解析 ---------------- */

  /**
   * 返回 null（忽略 Range → 200 整份）/ {unsatisfiable:true}（416）/ {start,end}（206 闭区间）。
   * 多段、语法错误 → 忽略（RFC 7233 允许）；只有「合法但越界」才 416，播放器据此知道结尾。
   */
  function parseRange(header, size) {
    if (!header) return null;
    var raw = String(header).trim();
    if (!/^bytes=/i.test(raw)) return null;
    var spec = raw.slice(6).trim();
    if (!spec) return null;
    if (spec.indexOf(",") >= 0) return null;              // 多段：忽略
    var m = /^(\d*)-(\d*)$/.exec(spec);
    if (!m) return null;                                  // 语法错误：忽略
    var a = m[1], b = m[2];
    if (a === "" && b === "") return null;
    if (size <= 0) return { unsatisfiable: true };
    if (a === "") {
      var n = Number(b);
      if (!isFinite(n) || n <= 0) return { unsatisfiable: true };   // bytes=-0
      return { start: Math.max(0, size - n), end: size - 1 };
    }
    var start = Number(a);
    if (!isFinite(start) || start >= size) return { unsatisfiable: true };
    var end = b === "" ? size - 1 : Number(b);
    if (!isFinite(end) || end < start) return null;
    if (end >= size) end = size - 1;
    return { start: start, end: end };
  }

  /* ---------------- 响应 ---------------- */

  function headers(meta, mime) {
    return {
      "Content-Type": mime,
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store, no-transform",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
      "Cross-Origin-Resource-Policy": "same-origin",
    };
  }

  /** ReadableStream + pull 背压：消费者取走一块才会解密下一块，内存恒定在一块左右 */
  function bodyStream(grant, itemId, meta, start, end) {
    var handle = { dead: false };
    grant.aborts.add(handle);
    var iter = null;
    function cleanup() {
      grant.aborts.delete(handle);
      try { iter && iter.return && iter.return(); } catch (e) { /* ignore */ }
    }
    return new ReadableStream({
      start: function () { iter = chunkStream(itemId, start, end, meta, grant.key); },
      pull: function (controller) {
        if (handle.dead) { cleanup(); counters.aborted++; controller.error(new DOMException("授权已撤销", "AbortError")); return; }
        return iter.next().then(function (step) {
          if (step.done) { cleanup(); controller.close(); return; }
          controller.enqueue(step.value);
        }).catch(function (err) { cleanup(); controller.error(err); });
      },
      cancel: function () { cleanup(); },
    }, new CountQueuingStrategy({ highWaterMark: 2 }));
  }

  function deny(status, reason) {
    return new Response("denied", {
      status: status,
      headers: { "Cache-Control": "no-store", "X-Stream-Reason": reason },
    });
  }

  /** 处理 /__media/<token>/<itemId> */
  async function handleFetch(request, ctx) {
    var url = new URL(request.url);
    var rest = url.pathname.slice(MEDIA_PREFIX.length);
    var slash = rest.indexOf("/");
    var token = slash < 0 ? rest : rest.slice(0, slash);
    var itemId = slash < 0 ? "" : decodeURIComponent(rest.slice(slash + 1));

    var grant = grants.get(token);
    if (!grant) { counters.denied++; return deny(403, "no-grant"); }
    var cid = (ctx && ctx.clientId) || "";
    if (cid && grant.clientId && cid !== grant.clientId) { counters.denied++; return deny(403, "other-client"); }
    if (!itemId || !grant.items.has(itemId)) { counters.denied++; return deny(403, "not-allowed"); }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("method not allowed", { status: 405, headers: { Allow: "GET, HEAD", "Cache-Control": "no-store" } });
    }

    var meta;
    try { meta = await idbGet("chunkmeta", itemId); }
    catch (e) { return deny(500, "meta-error"); }
    if (!meta || meta.state !== "ready") return deny(404, "no-meta");

    var size = Number(meta.size) || 0;
    var mime = await contentType(meta, grant.key);
    var range = parseRange(request.headers.get("range"), size);

    if (range && range.unsatisfiable) {
      var h416 = headers(meta, mime);
      h416["Content-Range"] = "bytes */" + size;
      h416["Content-Length"] = "0";
      return new Response(null, { status: 416, headers: h416 });
    }

    var start = range ? range.start : 0;
    var end = range ? range.end : Math.max(0, size - 1);
    var length = size === 0 ? 0 : end - start + 1;
    var h = headers(meta, mime);
    h["Content-Length"] = String(length);
    if (range) h["Content-Range"] = "bytes " + start + "-" + end + "/" + size;

    if (request.method === "HEAD") return new Response(null, { status: range ? 206 : 200, headers: h });
    if (length === 0) return new Response(new Uint8Array(0), { status: range ? 206 : 200, headers: h });
    counters.served++;
    return new Response(bodyStream(grant, itemId, meta, start, end + 1), {
      status: range ? 206 : 200,
      headers: h,
    });
  }

  self.__dsStream = { onMessage: onMessage, handleFetch: handleFetch, parseRange: parseRange, revokeClient: revokeClient };

  /* 自检：AAD 与 js/core/crypto.js 必须一致（改一处忘另一处时立刻暴露） */
  if (chunkAad("x", 0, 1) !== "daishui/chunk/x/0/1") throw new Error("stream AAD 契约不一致");
})();
