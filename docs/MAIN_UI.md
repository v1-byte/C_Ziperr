# Tampilan Utama C.Ziperr

URL tampilan utama aplikasi:

<https://c-zipper.corelink-ai.workers.dev/>

## Sumber tampilan utama APK

- Source of truth UI web: **[`public/index.html`](../public/index.html)**.
- Acuan layout terbaru: file HTML yang dikirim pengguna, `game-collector-pro(1).html`.
- Produk yang diminta adalah **APK Android**. APK membungkus tampilan utama melalui WebView pada URL Worker di atas, sehingga tampilan dan perubahan berikutnya mengikuti deployment Worker tanpa membangun APK ulang setelah migrasi awal.
- Alur utama memakai panel **Tahapan & bantuan capture**. Kontrol otorisasi dan keamanan tetap tersedia di bagian yang bisa dibuka pada panel tersebut.

Repository ini memakai UI dan sistem yang sama dengan URL tersebut. Struktur utama yang harus dipertahankan:

- **Collect**
- **Workspace**
- **Activity**
- **Preview Game** di kiri
- **Proses Capture** di kanan
- **Mulai Capture** dan **Stop & Finalize**
- **Download ZIP**
- **Log Preview & Capture**
- **Research & keamanan** (kontrol izin tetap dipertahankan)
- **Opsi lanjutan**
- **Pipeline offline**
- **AI Offline Readiness Assistant**
- **Editor dan Custom API**

Perubahan branding pada repository ini hanya mengganti aset gambar `/frostbyte-logo.png` dengan logo **C.Ziperr**. Layout, alur capture, preview bersamaan, workspace, pipeline offline, dan sistem AI tetap mengikuti C.Ziperr.
