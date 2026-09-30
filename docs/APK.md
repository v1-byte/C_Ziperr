# APK Android C_Ziperr

APK C_Ziperr **memang berkas APK Android yang dapat dipasang**, tetapi isinya adalah **Trusted Web Activity (TWA)** yang menampilkan PWA dari URL HTTPS—bukan aplikasi native offline yang seluruh fiturnya tertanam di APK. APK akan memuat situs `https://v1-byte.github.io/C_Ziperr/`, sehingga situs harus dapat diakses dan fitur yang memerlukan jaringan tetap membutuhkan internet.

## Unduh APK

Rilis APK terbaru: <https://github.com/v1-byte/C_Ziperr/releases/latest/download/app-release-signed.apk>

Jika tautan di aplikasi/browser membuka Chrome, itu bukan pengalihan ke Google Search dari kode aplikasi. APK menjalankan situs web; tanpa verifikasi hubungan Android antara aplikasi dan domain, Chrome dapat menampilkan fallback Custom Tab/browser. Berkas APK yang saat ini dirilis memang mengarah ke URL Pages di atas, dan URL tersebut merespons normal.

## Agar TWA terbuka penuh tanpa UI browser

TWA memerlukan Digital Asset Links yang cocok pada **root host**:

```text
https://v1-byte.github.io/.well-known/assetlinks.json
```

File harus mencantumkan package `com.v1byte.cziperr` dan fingerprint SHA-256 sertifikat penanda APK yang benar. Saat ini workflow membuat keystore acak untuk setiap build dan situs berada di GitHub Pages subpath `/C_Ziperr/`, sehingga file asosiasi tidak tersedia pada root host dan APK tidak dapat diverifikasi sebagai TWA penuh. Untuk rilis/update yang stabil, gunakan keystore signing tetap yang disimpan sebagai GitHub Secret dan sediakan `assetlinks.json` pada root host (misalnya melalui domain kustom atau repo Pages milik akun). Jangan memasang file asosiasi dengan fingerprint keystore sementara.

Jika aplikasi yang terpasang membuka **Google Search/halaman Google secara literal**, bukan Chrome Custom Tab, periksa bahwa APK berasal dari rilis terbaru dan bahwa URL awal aplikasi tidak diubah; kode rilis saat ini tidak memiliki tautan ke Google.

## Membuat APK dari PWA

Cara termudah untuk membuat paket Android dari UI yang di-host di HTTPS adalah PWABuilder. Untuk build yang dikelola repo ini, workflow `.github/workflows/release-apk.yml` menjalankan Bubblewrap/TWA:

1. Deploy `public/` pada URL HTTPS.
2. Buka **Actions → release-apk → Run workflow**.
3. Isi `pwa_url` dan `release_tag`.
4. Unduh `app-release-signed.apk` dari GitHub Release.

PWA di GitHub Pages repo ini memakai direktori proyek sebagai URL awal (`/C_Ziperr/`); jangan ganti URL tersebut dengan root host saat menjalankan workflow.
