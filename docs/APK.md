# Membuat APK dari C_Ziperr

Aplikasi ini adalah PWA (`public/manifest.webmanifest`, `icon-192.png`, `icon-512.png`). Setelah UI ter-deploy di URL **HTTPS**:

**Cara termudah — PWABuilder**
1. Buka pwabuilder.com, masukkan URL UI kamu.
2. Pilih **Android** → unduh paket (APK/AAB).
3. Ikon dan nama otomatis diambil dari manifest (logo C_Ziperr).

**Cara lokal — Bubblewrap**
```
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://DOMAIN-KAMU/manifest.webmanifest
bubblewrap build
```
Simpan keystore hasil `init` dengan aman; dibutuhkan untuk semua pembaruan.

## Build resmi melalui GitHub Actions

Workflow `.github/workflows/release-apk.yml` membuat TWA APK/AAB dari manifest PWA.

1. Deploy `public/` ke HTTPS root domain atau domain kustom.
2. Buka **Actions → release-apk → Run workflow**.
3. Isi `pwa_url`, misalnya `https://domain-kamu.example` dan `release_tag`.
4. Unduh artifact APK/AAB atau GitHub Release.

Workflow tidak membuat atau membocorkan signing key palsu. Untuk production update, siapkan keystore signing yang sah dan simpan sebagai secret sesuai kebijakan rilis Anda.

Catatan: tombol **Collect** kini mendukung endpoint `github` (langsung ke Actions dengan token fine-grained di browser) atau `local` (bridge `127.0.0.1:8788`); Worker lama tetap didukung. Preview membutuhkan origin HTTPS untuk PWA, sedangkan local preview menggunakan HTTP loopback.
