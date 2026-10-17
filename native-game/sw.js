/**
 * Service Worker — pre-cache shell + asset-manifest list for offline refresh.
 */
const CACHE_NAME = "c-ziperr-native-v2";
const MANIFEST_URL = "./manifests/asset-manifest.json";
const FALLBACK_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./sw.js",
  "./debug-panel.js",
  "./shell/app.js",
  "./shell/bootstrap.js",
  "./shell/router.js",
  "./shell/state-store.js",
  "./shell/telemetry.js",
  "./shell/error-boundary.js",
  "./shell/accessibility.js",
  "./shell/audio-unlock.js",
  "./shell/network-hijack.js",
  "./shell/brotli-loader.js",
  "./api/edu-network-adapter.js",
  "./api/spin.js",
  "./api/balance.js",
  "./api/index.js",
  "./config/native-game-config.json",
  "./config/host.json",
  "./config/feature-flags.json",
];

async function loadManifestFiles() {
  try {
    const res = await fetch(MANIFEST_URL, { cache: "no-cache" });
    if (!res.ok) return FALLBACK_ASSETS;
    const data = await res.json();
    const fromFiles = Array.isArray(data.files) ? data.files : [];
    const fromAssets = Array.isArray(data.assets)
      ? data.assets.map((a) => (a.path?.startsWith("./") ? a.path : `./${a.path}`))
      : [];
    const merged = [...new Set([...FALLBACK_ASSETS, ...fromFiles, ...fromAssets, MANIFEST_URL])];
    return merged.filter((u) => typeof u === "string" && u.length > 0);
  } catch {
    return FALLBACK_ASSETS;
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const files = await loadManifestFiles();
      const cache = await caches.open(CACHE_NAME);
      await Promise.all(
        files.map(async (url) => {
          try {
            await cache.add(url);
          } catch (_) {}
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key !== CACHE_NAME &&
                (key.startsWith("frostbyte-native") ||
                  key.startsWith("c-ziperr-native") ||
                  key.startsWith("eajzzxhro"))
            )
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes("/api/")) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((response) => {
          if (response.ok && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return response;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
