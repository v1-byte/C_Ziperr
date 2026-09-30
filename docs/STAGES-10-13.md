# C_Ziperr Tahap 10–13

## Tahap 10 — Original UI + adapters

UI asli tetap dipakai. Adapter baru:

- `github`: browser dispatch ke GitHub Actions, polling run, download artifact ZIP, lalu memanggil `loadZip()` yang sama dengan Workspace lama.
- `local`: memakai `tools/collect-bridge.mjs` di `127.0.0.1:8788/api` dan jalur ZIP yang sama.
- `demo`: fixture UI existing.

Jalankan bridge lokal:

```bash
npm run collect:bridge
```

GitHub-only membutuhkan fine-grained token milik pengguna dengan Actions read/write. Token disimpan di localStorage browser; jangan memakai perangkat bersama.

## Tahap 11 — GitHub-only

Isi owner, repo, ref, dan token GitHub pada Setelan. Endpoint Download dapat diisi `github`; tombol Mulai akan dispatch `collect-production.yml`, mencari run berdasarkan tag, menunggu selesai, mengambil artifact, dan memuat ZIP otomatis ke Workspace.

## Tahap 12 — E2E contract

`npm test` memverifikasi kontrak adapter, route local bridge, loadZip Workspace, workflow inputs, dan release workflow. E2E terhadap game nyata tetap memerlukan URL dan token/izin pengguna.

## Tahap 13 — APK

`.github/workflows/release-apk.yml` membangun TWA APK melalui Bubblewrap dari URL HTTPS PWA yang diberikan saat `workflow_dispatch`. Jalankan dari Actions dengan `pwa_url`, misalnya root GitHub Pages atau domain kustom. APK signed/AAB diunggah sebagai artifact dan GitHub Release.

Workflow tidak membuat token signing palsu. Untuk update APK berkelanjutan, gunakan keystore signing yang disimpan sebagai secret/repository variable sesuai kebijakan rilis Anda.
