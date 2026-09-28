<p align="center"><img src="docs/banner.png" alt="C_Ziperr" width="100%"></p>

<p align="center">
<img src="https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white">
<img src="https://img.shields.io/badge/GitHub-Actions-2088FF?logo=githubactions&logoColor=white">
<img src="https://img.shields.io/badge/Playwright-Chromium-45BA4B?logo=playwright&logoColor=white">
<img src="https://img.shields.io/badge/PWA-APK%20ready-5A0FC8">
</p>

# C_Ziperr

Toolkit untuk **mengumpulkan**, **menjalankan**, dan **mengedit** ZIP game web — lengkap dengan editor ala VS Code dan bantuan AI. Semuanya berjalan di browser (termasuk HP), dengan Cloudflare Worker + GitHub Actions di belakangnya.

## Fitur

| Menu | Fungsi |
|---|---|
| **1 Collect** | Masukkan URL → job GitHub Actions (Playwright) → unduh otomatis → dialog error + kartu kelengkapan 6 lapisan |
| **2 Preview** | Jalankan ZIP dari memori (Service Worker) · log 404 & error runtime · 🔧 Perbaiki otomatis · 🤖 Perbaiki dengan AI |
| **3 Workspace** | Editor ala VS Code (syntax highlight, Ctrl+P, cari/ganti global) · Custom API · Deteksi Workers · 🤖 Chat AI |
| **4 🔑 Setelan** | API AI (Anthropic / OpenAI-compatible), token akses Worker, ganti domain API di ZIP |

**Enam lapisan yang dikumpulkan:** HTML · JavaScript/CSS · Asset (gambar, sprite/atlas, SVG, font, audio, video, 3D/wasm) · Data (JSON, config, manifest, localization) · CDN (domain lain) · Server/API (login, state, balance, spin/action, response).

## Arsitektur

```
Browser (public/) ─POST /api/collect─▶ Worker ─dispatch─▶ GitHub Actions (Playwright)
      ▲   ▲                              │                        │
      │   └──── /api/status ─────────────┤                        │
      └──────── /api/download ◀──────────┴──────── artifact ◀─────┘
```

## Mulai cepat

**A. Lengkap (Worker + Actions)**
```bash
npm i
npx wrangler secret put GH_TOKEN       # token GitHub, izin Actions: read & write
npx wrangler secret put ACCESS_TOKEN   # opsional, disarankan
npm run deploy
```
Ubah `GH_REPO` / `GH_REF` di `wrangler.toml`, buka URL `*.workers.dev`, lalu isi 🔑 Setelan.

**B. Hanya GitHub (tanpa Worker)**
1. Repo → **Actions → collect → Run workflow** (isi link game, spin, detik).
2. Unduh artifact ZIP dari halaman run.
3. Buka UI → **Workspace** → muat ZIP → Preview / Editor / Chat AI.

UI bisa dihosting di GitHub Pages (`.github/workflows/pages.yml`). **Catatan:** Preview butuh origin di root domain, jadi gunakan repo `<user>.github.io` atau domain kustom; di subpath `/<repo>/` Preview tidak berfungsi. Tombol Collect tetap butuh Worker.

## Konfigurasi

| Nama | Lokasi | Fungsi |
|---|---|---|
| `GH_TOKEN` | Worker secret | Memicu workflow & mengunduh artifact |
| `ACCESS_TOKEN` | Worker secret (opsional) | Melindungi `/api/*` (header `x-token`) |
| `GH_REPO`, `GH_REF` | `wrangler.toml` | Repo dan branch workflow |
| `COLLECT_COOKIES` | GitHub secret (opsional) | Cookie sesi saat collect (`a=b; c=d` atau JSON Playwright) |

Input workflow `collect`: `game_url`, `folder`, `play_seconds`, `spins`, `spin_x`, `spin_y`, `har`.

## Hasil collect

```
assets/<host>/...   server/0001.json ...   index.rendered.html
kelengkapan.json    keterangan.json        KETERANGAN.md    (traffic.har jika HAR=1)
```

## Aplikasi (APK)

Logo C_Ziperr adalah ikon utama (`public/icon-*.png`, `manifest.webmanifest`). Panduan membuat APK: [`docs/APK.md`](docs/APK.md).

## Status & batasan

Kode lolos cek sintaks, namun **belum diuji end-to-end** di browser dan job Actions sungguhan; gunakan checklist di [`docs/CATATAN.md`](docs/CATATAN.md). Game dengan anti-bot, WebSocket-only, atau login rumit tidak sepenuhnya terekam. Rate limit Worker bersifat best-effort. Detail lengkap, daftar 12 bug yang diperbaiki, dan roadmap: [`docs/CATATAN.md`](docs/CATATAN.md).

## Penggunaan yang bertanggung jawab

Gunakan hanya untuk game milikmu atau yang izinnya jelas (hak cipta dan ToS). Alat ini **tidak** menyertakan pengatur RNG/hasil spin maupun pemalsuan ID/sesi; editor aturan API ditujukan untuk QA dan demo offline.

## Lisensi

Belum ditentukan — tambahkan `LICENSE` sesuai pilihanmu sebelum dipublikasikan.
