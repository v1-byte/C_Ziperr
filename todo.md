- [ ] Inventarisasi semua tombol dan handler, lalu tandai fungsi yang duplikat atau tidak efektif
- [ ] Ubah Scan Error agar fokus ke audit offline A Core Raa
- [x] Klik error harus membuka file terkait dan menampilkan ikon [!]
- [x] Tambahkan tombol Perbaiki dengan AI pada setiap file editor
- [x] Tambahkan regression test alur error-to-file-to-repair; verifikasi production tetap perlu setelah deploy


## Perbaikan lanjutan (2026-10-09)
- Resume mengizinkan retry URL yang sebelumnya tercatat gagal di `seen`; batas fetch menghitung percobaan aktual dan menahan duplikasi input.
- RESCAN mengganti himpunan marker/error sebelumnya; hasil scan bersih tidak lagi menandai `index.html` tanpa bukti.
- SSE offline mendukung `onopen`/`onmessage`, event bernama, dan `lastEventId`.
- Iframe hasil rewrite dibatasi ke lebar/tinggi viewport untuk atribut/style ekstrem; sandbox tetap dipertahankan.
- Tes regresi engine-specific repair, resume, SSE, iframe, dan UI ditambahkan.
