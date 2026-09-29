# C_Ziperr Tahap 5–9

## Tahap 5 — Local HTTP Preview Server

```bash
npm run preview:local -- ./out/game-1
```

Server bind default `127.0.0.1` dengan `/__health`, MIME type, CSP, root isolation, symlink protection, dan path traversal protection.

## Tahap 6 — Local API/Mock Server

```bash
npm run mock:local -- ./out/game-1
```

Rules dibaca dari `server/*.json` dan `mock-api.json`. Server mendukung method/path, body condition `when`, delay, status, response body, request log, dan health endpoint.

## Tahap 7 — Path Rewriter

```bash
npm run rewrite:package -- ./out/game-1 OLD_URL http://127.0.0.1:4000 --dry-run
npm run rewrite:package -- ./out/game-1 OLD_URL http://127.0.0.1:4000
```

Hasil perubahan dan URL yang perlu ditinjau disimpan di `rewrite-report.json`.

## Tahap 8 — Dependency dan Asset Scanner

```bash
npm run scan:package -- ./out/game-1
```

Menghasilkan `asset-manifest.json` dan `dependency-graph.json`, termasuk SHA-256, ukuran, type, import/reference edges, external URL, Worker/Service Worker/WebSocket/WebAssembly/fetch detection, dan duplicate hash.

## Tahap 9 — Offline Validation Gate

```bash
npm run validate:offline -- ./out/game-1
```

Menghasilkan `offline-readiness.json` dengan status `FULL_OFFLINE_READY`, `PARTIAL`, atau `NOT_READY`, missing local resource, external URL, API references, mock coverage, warning, dan score. Gate tidak mengklaim offline penuh jika masih ada resource atau API yang belum disediakan.
