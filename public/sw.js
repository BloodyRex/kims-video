/**
 * Kim's Video — service worker (PWA shell, v1.4 Intelligence)
 *
 * 目标：可安装（桌面/手机主屏）、可独立窗口运行。
 * 刻意保持极简：不做复杂离线降级，只保证应用外壳在弱网时能加载，
 * 其余请求全部优先走网络。任何失败都静默降级到网络，绝不阻断主流程。
 */
const CACHE = "kims-shell-v1";
const CORE = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/pwa-192.png",
  "/pwa-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(CORE))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = [CACHE];
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !keep.includes(k)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

function cacheStorable(url) {
  try {
    const u = new URL(url, self.location.origin);
    if (u.origin !== self.location.origin) return false; // 不缓存跨源
    if (u.pathname.startsWith("/api")) return false;
    return true;
  } catch (_) {
    return false;
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // 导航请求：网络优先，失败回退到外壳
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          if (fresh && fresh.ok) {
            const cache = await caches.open(CACHE);
            cache.put(req, fresh.clone()).catch(() => {});
          }
          return fresh;
        } catch (_) {
          const cached = await caches.match(req, { ignoreSearch: true });
          return (
            cached ||
            (await caches.match("/index.html", { ignoreSearch: true })) ||
            Response.error()
          );
        }
      })()
    );
    return;
  }

  // 静态资源：同源 stale-while-revalidate；跨源放行
  if (cacheStorable(req.url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const hit = await cache.match(req);
        const net = fetch(req)
          .then((resp) => {
            if (resp && resp.ok) cache.put(req, resp.clone()).catch(() => {});
            return resp;
          })
          .catch(() => null);
        return (await net) || hit || (await fetch(req).catch(() => Response.error()));
      })()
    );
  }
});
