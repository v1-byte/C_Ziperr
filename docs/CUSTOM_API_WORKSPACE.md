# Custom API Workspace & Hosting Package

## Cara membuka

1. Buka **Workspace** dan load ZIP hasil Collect.
2. Pilih tombol **API** yang sudah ada di panel Explorer.
3. Isi base URL HTTPS milik Anda, Game ID, endpoint, format response, headers, parameter, serta request/response fields.
4. Gunakan **Deteksi API** untuk mengisi path berdasarkan `api-map.json` dan file source. Tinjau hasil sebelum disimpan.
5. **Generate API Contract** atau **Save Workspace** menyimpan metadata/config ke ZIP yang sedang diedit.
6. **Generate Hosting Package** menghasilkan dan mengunduh ZIP yang berisi kontrak, konfigurasi, README, env template, checklist, dan scaffold backend demo.
7. Jalankan **Validate Hosting**. **Ready Hosting** hanya menandai paket bila blocker readiness sudah nol. Ini tidak men-deploy server.

## File hasil

- `api-map.json` — peta capture lama dipertahankan; konfigurasi baru ditambahkan secara aditif sebagai `customApi`.
- `hosting-config.json` — base URL, endpoint wajib, format response, field, header/parameter, dan nama environment variables.
- `hosting/api-contract.json` — kontrak login, session, wallet, spin, result, dan history.
- `hosting/manifest.json` dan `hosting/activity.json` — identitas paket serta catatan pembuatan kontrak.
- `API_HOSTING_README.md`, `env.example`, `server-checklist.md` — panduan konfigurasi dan hosting.
- `demo-backend/worker.js`, `demo-backend/wrangler.jsonc` — scaffold backend demo opsional.

Nilai rahasia tidak dimasukkan ke file. Konfigurasi menolak credential literal pada field header/parameter sensitif. Isi `JWT_SECRET`, `DATABASE_URL`, `SIGNING_KEY`, dan secret lain pada secret manager backend, bukan di ZIP, client, APK, atau Git.

## Test API

- GET dijalankan sebagai request baca biasa.
- Method tulis secara default hanya mengirim `OPTIONS`, bukan membuat login/spin.
- Untuk mengirim POST/PUT/DELETE sungguhan, centang opsi request tulis. Dialog konfirmasi akan menyebut method dan URL. Gunakan hanya backend demo/staging yang Anda kontrol; spin dapat mengubah saldo/state.
- Browser dapat menolak hasil karena CORS, DNS, TLS, atau mixed content. Test dari UI tidak mengatasi/mengakali policy tersebut.

## Scaffold demo: bukan backend produksi

Backend contoh menerima login `demo` / `demo`, memakai saldo demo 10.000 kredit non-monetary, menghitung spin di server, mendukung result/history dan idempotency key. State disimpan sementara di memori isolate, sehingga dapat hilang saat restart atau berpindah isolate. Demo CORS dibuka untuk memudahkan uji. Scaffold belum menggunakan database dan **tidak boleh dipakai untuk uang nyata atau produksi**. Atur `JWT_SECRET` minimal 32 karakter melalui secret manager sebelum menjalankan/deploy demo. Backend resmi Anda sendiri dapat menggantikan scaffold tersebut.

## Readiness

Validator mengecek URL/base, endpoint wajib, response fields, entrypoint, keberadaan aset, file paket, referensi endpoint API lama, dan pola credential/token literal yang dikenal. Hasil `READY` menandakan pemeriksaan paket lokal lulus saja; bukan bukti backend live, security review penuh, atau deploy sukses. File `hosting-ready.json` hanya ditulis setelah gate berhasil.

## APK rilis

Implementasi memakai tombol API yang sudah ada di Workspace, tidak mengubah layar awal/Collect, file wrapper Android, package ID, atau URL rilis APK. Tidak ada build atau publish APK. Karena APK membuka UI dari Cloudflare Worker, perubahan UI baru baru terlihat setelah perubahan repository ini di-deploy ke Worker; sampai itu dilakukan, aplikasi rilis tetap memakai Worker yang sekarang. Jangan menimpa artifact APK yang sudah dirilis.
