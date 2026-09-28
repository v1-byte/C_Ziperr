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

Catatan: tombol **Collect** butuh Worker. Preview butuh origin HTTPS di root domain (bukan subpath).
