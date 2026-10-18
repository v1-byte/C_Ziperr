# C.Ziperr Android APK

APK Android adalah produk utama. APK menampilkan UI C.Ziperr melalui WebView; Worker hanya menjadi alamat backend/tampilan yang dibuka APK. Setelah APK migrasi dipasang sekali, update UI pada Worker dapat diterima tanpa mengunduh APK lagi.

## URL web utama

`https://c-zipper.corelink-ai.workers.dev/`

Rilis APK ini menggunakan Worker dan alur Collect yang didefinisikan di repository `v1-byte/C_Ziperr` sendiri; tidak bergantung pada repository collector eksternal.

## Perilaku jaringan

APK membutuhkan koneksi internet untuk memuat aplikasi web utama dan API capture. Jika web tidak dapat dibuka, APK menampilkan pesan error, tombol coba lagi, dan pilihan membuka web melalui browser. APK tidak menyalin atau mengeksekusi kode game secara lokal.

## Pembaruan APK

Mulai versi 1.2.8 (versionCode 15), APK memeriksa manifest rilis GitHub saat aplikasi dibuka, kembali ke foreground, dan berkala ketika tetap aktif. Jika versionCode terbaru lebih tinggi, banner update menawarkan unduhan APK secara resumable; setelah ukuran file cocok dengan manifest, APK membuka Android Package Installer.

Android tetap mewajibkan pengguna menyetujui pemasangan dan mungkin meminta izin **Izinkan pemasangan dari sumber ini** untuk C.Ziperr. Aplikasi tidak memasang APK diam-diam. Workflow rilis menerbitkan `update.json` bersama APK dan memverifikasi fingerprint sertifikat signing historis sebelum rilis, agar pembaruan tidak terbit jika tanda tangan berubah dan ditolak Android.

## Penyimpanan ZIP hasil Collect

Pada build native versi `1.2.8` atau lebih baru, ZIP hasil System Collect, GitHub Actions, R2, dan Workspace dari WebView dikirim bertahap melalui bridge dengan back-pressure, lalu ditulis langsung ke file sementara dan dipindahkan ke direktori dokumen internal persisten aplikasi melalui `expo-file-system`. APK memeriksa ukuran akhir, menampilkan progres, dan menyediakan daftar untuk membuka atau menghapus ZIP tersimpan. File tetap privat untuk aplikasi C.Ziperr; file tidak otomatis muncul di folder Downloads bersama.

Penyimpanan tetap bergantung pada unduhan yang berhasil, ruang internal yang cukup, dan izin sistem. Paket besar dapat gagal jika perangkat kehabisan ruang atau OS menutup aplikasi. Aplikasi tidak dapat menjamin unduhan tanpa batas maupun mengambil resource yang dibatasi DRM, autentikasi, atau kontrol akses.

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
