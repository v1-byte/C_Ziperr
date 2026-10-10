# C.Ziperr Android APK

APK Android adalah produk utama. APK menampilkan UI C.Ziperr melalui WebView; Worker hanya menjadi alamat backend/tampilan yang dibuka APK. Setelah APK migrasi dipasang sekali, update UI pada Worker dapat diterima tanpa mengunduh APK lagi.

## URL web utama

`https://c-zipper.corelink-ai.workers.dev/`

Rilis APK ini menggunakan Worker dan alur Collect yang didefinisikan di repository `v1-byte/C_Ziperr` sendiri; tidak bergantung pada repository collector eksternal.

## Perilaku jaringan

APK membutuhkan koneksi internet untuk memuat aplikasi web utama dan API capture. Jika web tidak dapat dibuka, APK menampilkan pesan error, tombol coba lagi, dan pilihan membuka web melalui browser. APK tidak menyalin atau mengeksekusi kode game secara lokal.

## Pembaruan APK

Mulai versi 1.2.6 (versionCode 13), APK memeriksa manifest rilis GitHub saat aplikasi dibuka, kembali ke foreground, dan berkala ketika tetap aktif. Jika versionCode terbaru lebih tinggi, banner update menawarkan unduhan APK secara resumable; setelah ukuran file cocok dengan manifest, APK membuka Android Package Installer.

Android tetap mewajibkan pengguna menyetujui pemasangan dan mungkin meminta izin **Izinkan pemasangan dari sumber ini** untuk C.Ziperr. Aplikasi tidak memasang APK diam-diam. Workflow rilis menerbitkan `update.json` bersama APK dan memverifikasi fingerprint sertifikat signing historis sebelum rilis, agar pembaruan tidak terbit jika tanda tangan berubah dan ditolak Android.

## Penyimpanan ZIP hasil Collect

Mulai versi `1.2.7` (versionCode 14), ZIP hasil Collect disimpan per-potongan ke `Documents/captures` pada penyimpanan internal privat aplikasi. WebView menunggu ACK untuk setiap potongan dan verifikasi ukuran file sebelum memuat ZIP ke Workspace; koleksi baru memakai nama bertimestamp agar tidak menimpa hasil sebelumnya. Build lama tidak memiliki jaminan transfer internal yang terkonfirmasi dan sebaiknya diperbarui.

Collect utama berjalan melalui runner GitHub Actions, bukan batas CPU kecil Worker, dan collector tidak lagi membuang respons individual hanya karena melewati 18 MiB. Ukuran total tetap dibatasi kapasitas nyata runner, artifact GitHub, dan ruang kosong HP; tidak ada sistem penyimpanan yang dapat menjamin koleksi tanpa batas fisik.

Setelah paket masuk Workspace, **AI Auto Repair Offline** berjalan otomatis jika opsi AI Offline Readiness aktif (default). Perbaikan membuat salinan cadangan, membatasi file teks yang dianalisis, dan melewati patch yang membuat referensi lokal hilang. ZIP awal disimpan terlebih dahulu; salinan hasil persiapan offline disimpan terpisah setelah proses selesai. AI tidak diminta melewati login, CAPTCHA, DRM, pembayaran, atau keamanan, dan tidak dapat menjamin seluruh game bekerja offline jika API/server game tidak tersedia.

## Konfigurasi AI Worker

Semua fitur AI pada web utama diarahkan ke endpoint Worker same-origin (`/api/ai`, `/api/ai/analyze`, dan `/api/ai/manus`) dan diproses oleh Cloudflare Workers AI gratis melalui binding `AI`. Tidak ada API key AI yang ditanam di APK; deployment Worker perlu mengaktifkan binding `AI` dan dapat mengatur `WORKERS_AI_MODEL`.

## Pengujian

```bash
pnpm install
pnpm run typecheck
pnpm test
```

Build release lokal:

```bash
pnpm exec expo prebuild --platform android --non-interactive --clean --no-install
cd android
./gradlew assembleRelease
```

APK berada di `android/app/build/outputs/apk/release/app-release.apk`.

## Catatan kompatibilitas

Entry screen sengaja hanya memuat WebView dan komponen React Native dasar. Fitur ZIP/editor native lama tidak lagi menjadi entry point, sehingga APK release mengikuti web utama dan tidak membawa native module lama yang tidak diperlukan.
