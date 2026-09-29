# C_Ziperr Tahap 0–4

## Tahap 0 — Baseline

Baseline legacy disimpan pada tag `legacy-baseline-2026-09-29`. Perubahan berikutnya tidak menghapus Worker/Pages lama.

## Tahap 1 — Core Collector

`core/collector/engine.mjs` adalah engine bersama. GitHub Actions (`tools/collect.mjs`) dan CLI lokal (`tools/collect-local.mjs`) memanggil engine yang sama, sehingga format ZIP dan laporan konsisten.

## Tahap 2 — Local Playwright

```bash
npm install
npx playwright install chromium
npm run collect:local -- https://example.com --out out/example --play-seconds 30 --spins 4
```

Output utama:

- `assets/<host>/...`
- `server/0001.json`
- `index.rendered.html`
- `kelengkapan.json`
- `cdn-manifest.json`
- `cdn-missing.json`
- `cdn-domains.json`

Gunakan hanya pada resource yang Anda miliki atau punya izin untuk diuji.

## Tahap 3 — CDN Collector

Collector mencatat CDN yang terlihat pada request browser, CDN yang muncul saat interaksi, dan URL tambahan dari HTML/JS/CSS/data melalui crawl terbatas. Tidak diklaim sebagai penangkapan seluruh CDN yang tidak pernah dipanggil, terlindungi login, signed URL kedaluwarsa, WebSocket, atau resource yang tidak dapat diakses.

Laporan CDN:

- `cdn-manifest.json`: domain, file, URL, ukuran, layer.
- `cdn-missing.json`: URL CDN yang gagal.
- `cdn-domains.json`: ringkasan per hostname.

## Tahap 4 — Job storage

- `core/jobs/sqlite.mjs`: SQLite untuk job, event, checkpoint, resume, dan artifact.
- `public/job-storage.js`: IndexedDB untuk job metadata pada browser.

```bash
npm run jobs -- list
npm run jobs -- show <job-id>
npm run jobs -- resume <job-id>
```

Node.js `>=22` diperlukan karena adapter SQLite memakai `node:sqlite`.
