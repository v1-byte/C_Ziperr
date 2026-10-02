# C.Ziperr Android APK

APK Android adalah produk utama. APK menampilkan UI C.Ziperr melalui WebView; Worker hanya menjadi alamat backend/tampilan yang dibuka APK. Setelah APK migrasi dipasang sekali, update UI pada Worker dapat diterima tanpa mengunduh APK lagi.

## URL web utama

`https://c_zipper.corelink-ai.workers.dev/`

## Perilaku jaringan

APK membutuhkan koneksi internet untuk memuat aplikasi web utama dan API capture. Jika web tidak dapat dibuka, APK menampilkan pesan error, tombol coba lagi, dan pilihan membuka web melalui browser. APK tidak menyalin atau mengeksekusi kode game secara lokal.

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
