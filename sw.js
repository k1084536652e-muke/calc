// Increment when cached shell assets change so clients receive the new version.
const CACHE_VERSION = "v11";
const CACHE_NAME = `finance-shell-${CACHE_VERSION}`;
const DB_NAME = "calc-data-current";
const mediaSessions = new Map();

const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./js/app.js",
  "./js/app-lifecycle.js",
  "./js/archive.js",
  "./js/content.js",
  "./js/dialogs.js",
  "./js/finance.js",
  "./js/crypto.js",
  "./js/db.js",
  "./js/media-export.js",
  "./js/panel.js",
  "./js/preferences.js",
  "./js/system-panel.js",
  "./js/thumbnails.js",
  "./js/trash.js",
  "./icons/icon-192.png?v=10",
  "./icons/icon-512.png?v=10",
  "./icons/icon-512-maskable.png?v=10",
  "./icons/apple-touch-icon.png?v=10",
  "./icons/icon-180.png?v=10",
  "./icons/favicon.png?v=10",
];

function cacheShellAssets() {
  return caches.open(CACHE_NAME).then((cache) =>
    cache.addAll(
      SHELL_ASSETS.map(
        (asset) =>
          new Request(new URL(asset, self.location.href), {
            cache: "reload",
          })
      )
    )
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    cacheShellAssets()
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function registerMediaSession(message) {
  if (
    !message?.mediaId ||
    !message.key ||
    !message.metadata ||
    !Number.isInteger(message.metadata.chunkSize) ||
    !Number.isInteger(message.metadata.chunkCount)
  ) {
    return false;
  }
  mediaSessions.set(message.mediaId, {
    key: message.key,
    metadata: message.metadata,
  });
  return true;
}

self.addEventListener("message", (event) => {
  const message = event.data;
  if (!message || typeof message.type !== "string") {
    return;
  }
  const port = event.ports?.[0];

  if (message.type === "register-media") {
    if (!registerMediaSession(message)) {
      port?.postMessage({ ok: false, error: "内容信息无效" });
      return;
    }
    port?.postMessage({ ok: true });
    return;
  }

  if (message.type === "unregister-media") {
    mediaSessions.delete(message.mediaId);
    return;
  }

  if (message.type === "clear-media-keys") {
    mediaSessions.clear();
    return;
  }

  if (message.type === "refresh-shell-cache") {
    event.waitUntil?.(
      cacheShellAssets().catch(() => {})
    );
  }
});

function requestRegistrationFromClient(client, mediaId) {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => {
      channel.port1.close();
      resolve(false);
    }, 4_000);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      const message = event.data;
      const registered =
        message?.mediaId === mediaId && registerMediaSession(message);
      channel.port1.close();
      resolve(registered);
    };
    client.postMessage(
      { type: "media-registration-required", mediaId },
      [channel.port2]
    );
  });
}

async function requestMediaSession(mediaId, clientId) {
  const candidates = [];
  if (clientId) {
    const client = await self.clients.get(clientId);
    if (client) {
      candidates.push(client);
    }
  }
  if (candidates.length === 0) {
    candidates.push(
      ...(await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      }))
    );
  }

  for (const client of candidates) {
    if (await requestRegistrationFromClient(client, mediaId)) {
      return mediaSessions.get(mediaId) || null;
    }
  }
  return null;
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    request.addEventListener("success", () => {
      const database = request.result;
      database.addEventListener("versionchange", () => database.close());
      resolve(database);
    });
    request.addEventListener("error", () => reject(request.error));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", resolve, { once: true });
    transaction.addEventListener(
      "error",
      () => reject(transaction.error),
      { once: true }
    );
    transaction.addEventListener(
      "abort",
      () => reject(transaction.error),
      { once: true }
    );
  });
}

async function getEncryptedChunk(database, mediaId, index) {
  const transaction = database.transaction("chunks", "readonly");
  const request = transaction
    .objectStore("chunks")
    .get([mediaId, index]);
  const chunk = await new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
  await transactionDone(transaction);
  return chunk || null;
}

function parseRange(rangeHeader, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader || "");
  if (!match) {
    return null;
  }
  let start;
  let end;
  if (match[1] === "" && match[2] === "") {
    return null;
  }
  if (match[1] === "") {
    const suffixLength = Number(match[2]);
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) {
      return null;
    }
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === "" ? size - 1 : Number(match[2]);
  }
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    start >= size ||
    end < start
  ) {
    return null;
  }
  return { start, end: Math.min(end, size - 1) };
}

async function makeRangeBody({
  database,
  key,
  mediaId,
  chunkSize,
  start,
  end,
}) {
  const first = Math.floor(start / chunkSize);
  const last = Math.floor(end / chunkSize);
  let index = first;
  let cancelled = false;
  let finished = false;
  const finish = () => {
    if (!finished) {
      finished = true;
      database.close();
    }
  };

  return new ReadableStream({
    async pull(controller) {
      if (cancelled) {
        return;
      }
      try {
        const encrypted = await getEncryptedChunk(database, mediaId, index);
        if (!encrypted) {
          throw new Error("缺少内容分块");
        }
        const plain = new Uint8Array(
          await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: encrypted.iv },
            key,
            encrypted.ciphertext
          )
        );
        const chunkStart = index * chunkSize;
        const localStart = Math.max(0, start - chunkStart);
        const localEnd = Math.min(plain.length, end - chunkStart + 1);
        if (localEnd > localStart) {
          controller.enqueue(plain.slice(localStart, localEnd));
        }
        if (index >= last) {
          controller.close();
          finish();
        } else {
          index += 1;
        }
      } catch (error) {
        controller.error(error);
        finish();
      }
    },
    cancel() {
      cancelled = true;
      finish();
    },
  });
}

function formatContentDisposition(name) {
  const cleaned = String(name || "download")
    .replace(/[\r\n"]/g, "_")
    .slice(0, 180);
  const encoded = encodeURIComponent(cleaned).replace(/'/g, "%27");
  return `attachment; filename="download"; filename*=UTF-8''${encoded}`;
}

async function serveMedia(request, mediaId, clientId) {
  let session = mediaSessions.get(mediaId);
  if (!session) {
    session = await requestMediaSession(mediaId, clientId);
  }
  if (!session) {
    return new Response("内容暂不可用", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const { key, metadata } = session;
  const size = Number(metadata.size);
  if (!Number.isInteger(size) || size < 0) {
    return new Response("内容信息无效", { status: 404 });
  }

  const commonHeaders = {
    "Content-Type": metadata.mimeType || "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
  };
  if (new URL(request.url).searchParams.get("download") === "1") {
    commonHeaders["Content-Disposition"] = formatContentDisposition(
      metadata.name
    );
  }
  const rangeHeader = request.headers.get("range");
  const range = rangeHeader
    ? parseRange(rangeHeader, size)
    : { start: 0, end: size - 1 };

  if (
    (rangeHeader && !range) ||
    (size === 0 && rangeHeader)
  ) {
    return new Response(null, {
      status: 416,
      headers: {
        ...commonHeaders,
        "Content-Range": `bytes */${size}`,
      },
    });
  }
  if (size === 0) {
    return new Response(new Uint8Array(), {
      status: 200,
      headers: { ...commonHeaders, "Content-Length": "0" },
    });
  }

  const length = range.end - range.start + 1;
  const headers = {
    ...commonHeaders,
    "Content-Length": String(length),
  };
  if (rangeHeader) {
    headers["Content-Range"] = `bytes ${range.start}-${range.end}/${size}`;
  }
  if (request.method === "HEAD") {
    return new Response(null, {
      status: rangeHeader ? 206 : 200,
      headers,
    });
  }

  const database = await openDatabase();
  const body = await makeRangeBody({
    database,
    key,
    mediaId,
    chunkSize: metadata.chunkSize,
    start: range.start,
    end: range.end,
  });
  return new Response(body, {
    status: rangeHeader ? 206 : 200,
    headers,
  });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" && request.method !== "HEAD") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  const mediaMarker = "/__media/";
  const markerIndex = url.pathname.lastIndexOf(mediaMarker);
  if (markerIndex >= 0) {
    const mediaId = decodeURIComponent(
      url.pathname.slice(markerIndex + mediaMarker.length)
    );
    event.respondWith(serveMedia(request, mediaId, event.clientId));
    return;
  }
  if (request.method === "HEAD") {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-cache" })
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches
              .open(CACHE_NAME)
              .then((cache) => cache.put("./index.html", copy));
          }
          return response;
        })
        .catch(async () => {
          const cached =
            (await caches.match("./index.html")) || (await caches.match("./"));
          return (
            cached ||
            new Response("离线缓存不可用", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            })
          );
        })
    );
    return;
  }

  const pathname = url.pathname;
  if (pathname.endsWith(".js") || pathname.endsWith(".css")) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request, { cache: "no-cache" })
          .then((response) => {
            if (response.ok) {
              void cache.put(request, response.clone());
            }
            return response;
          })
          .catch((error) => {
            if (cached) {
              return cached;
            }
            throw error;
          });

        if (cached) {
          event.waitUntil(network.catch(() => {}));
          return cached;
        }
        return network;
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(request, { cache: "no-cache" }).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          void caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
