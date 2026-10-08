# Public CDN Capture

Skrip `scripts/public_asset_capture.py` merekam response network dari browser baru dan menyimpan asset statis yang **berhasil dikirim secara publik** oleh halaman.

## Batasan keamanan

- Tidak memuat cookie, localStorage, atau `storage_state`.
- Tidak menambahkan header login/token.
- Tidak melewati CAPTCHA, DRM, challenge, signed-token expiry, atau access control.
- Tidak mengubah request menjadi request terautentikasi.
- URL query sensitif pada manifest disamarkan.

Gunakan hanya untuk situs/game yang Anda miliki atau yang memang memberi izin capture/hosting ulang.

## Instalasi

```bash
python3 -m pip install playwright
python3 -m playwright install chromium
```

## Menjalankan

```bash
python3 scripts/public_asset_capture.py \
  --url 'https://example.com/game' \
  --output ./capture-public \
  --wait 30
```

Hasil:

```text
capture-public/
├── assets/
├── public-assets-manifest.json
└── README.txt
```

Manifest memisahkan:

- `captured`: response HTTP 2xx yang disimpan dan memiliki SHA-256.
- `failed`: error HTTP, response kosong, atau file terlalu besar.
- `blocked_or_auth_required`: status 401/403/407/451.

## Hosting mandiri

Asset publik dapat disalin ke object storage/CDN milik Anda. Untuk membuat game berjalan, endpoint backend tetap harus diganti secara resmi dan diimplementasikan ulang, misalnya:

```text
/api/auth/login
/api/session
/api/license/verify
/api/wallet/balance
/api/game/spin
/api/game/result
```

Mengambil asset tidak otomatis memindahkan login, wallet, RNG, license, signature, atau state server. Jangan menyalin credential, signature, atau session token ke ZIP/hosting.

## Verifikasi sebelum deploy

1. Buka `public-assets-manifest.json`.
2. Pastikan semua file `captured` memang boleh dipublikasikan.
3. Tinjau `failed` dan `blocked_or_auth_required`.
4. Jalankan asset pada domain staging milik Anda.
5. Ganti API hanya dengan backend dan key yang Anda miliki.
6. Jangan menyatakan paket offline lengkap jika manifest masih memiliki asset penting yang gagal/auth-required.
