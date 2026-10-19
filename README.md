# SADAR DIRI

Sistem Informasi dan Portofolio Diri untuk mendukung kesejahteraan psikologis siswa. Aplikasi ini menjadi media journaling, refleksi, portofolio, dan pemantauan oleh Guru BK.

## Peran

| Peran | Akses |
|---|---|
| **Siswa** | Biodata & profil diri, mood tracker, jurnal ABC & grateful, portofolio prestasi + bukti, refleksi mandiri/terbimbing, rencana aksi & rencana masa depan, pengaturan privasi |
| **Guru BK** | Dashboard kelas binaan, alert risiko, detail siswa, verifikasi prestasi, catatan konseling, sesi refleksi terbimbing + umpan balik, ekspor laporan (CSV/PDF) |
| **Superadmin** | Pengguna & impor CSV, kelas & tahun ajaran (termasuk kenaikan kelas), konten & versi, pengumuman, laporan agregat, audit log, retensi data, pengaturan sekolah. **Tidak dapat membaca jurnal/refleksi/catatan konseling siswa.** |

## Stack

Laravel 13 · Inertia + React 19 · Vite 8 · Tailwind v4 · MySQL/MariaDB · DomPDF.

## Menjalankan

```bash
composer install
cp .env.example .env        # sesuaikan DB_*
php artisan key:generate
php artisan migrate --seed
npm install && npm run build
php artisan serve           # atau valet/nginx
```

Untuk pengembangan: `npm run dev` + `php artisan serve`.

### Akun demo (`migrate --seed`)

| Peran | Login | Sandi |
|---|---|---|
| Superadmin | `admin@sadar-diri.test` atau `ADM001` | `Password123` |
| Guru BK | `rina@sadar-diri.test` | `Password123` |
| Guru BK (koordinator) | `hendra@sadar-diri.test` | `Password123` |
| Siswa | NIS `2024001`–`2024036` | `Password123` |

Superadmin wajib mengaktifkan TOTP saat login pertama. Secret dan kode pemulihan ditampilkan di halaman `/2fa/enroll`.

## Pola UI

- **Top nav** (`Layouts/AppShell.jsx`): pencarian halaman (⌘K/Ctrl+K), lonceng notifikasi dengan lencana, dan menu profil berisi nama, peran, serta avatar inisial. Setiap halaman transisi dengan `sd-page`/`sd-card` dan popover memakai `sd-popover` (animasi `prefers-reduced-motion` dihormati).
- **Konfirmasi aksi** (`useConfirm` dari `Components/UI.jsx`): semua aksi yang mengubah data atau mengakhiri sesi melewati dialog konfirmasi. `requireReason` menggantikan `window.prompt` untuk aksi yang dicatat di audit log; nilainya tersedia sebagai `decision.reason`.
- **Warna tombol**: `primary` (simpan/buat), `success` (verifikasi/setujui/selesaikan), `danger` (hapus/tolak/cabut), `warning` (aksi massal & tak dapat dibatalkan), `info` (ekspor/unduh), `outline`/`soft`/`ghost` untuk aksi sekunder. Aksi baris tabel memakai `IconButton` agar tidak membungkus.

## Privasi & keamanan

- Data sensitif (jurnal, refleksi, catatan konseling, profil psikologis) dienkripsi di database dengan `APP_KEY`.
- Guru BK hanya dapat mengakses siswa yang pernah/sedang berada di kelas binaannya (`AccessScope`).
- Setiap akses guru BK ke data siswa dicatat di audit log dan dapat dilihat siswa pada halaman Privasi.
- Superadmin tidak memiliki rute untuk membaca konten psikologis; aksi sensitif (reset sandi, paksa logout, nonaktifkan akun, retensi) mewajibkan alasan dan tercatat.
- Laporan agregat menyembunyikan kelas dengan kurang dari 10 siswa.
- Retensi: alumni dianonimkan dan jurnal/refleksinya dihapus setelah 3 tahun (dapat diubah di Pengaturan).

## Perintah terjadwal

```bash
php artisan sadar:alerts      # evaluasi aturan alert
php artisan sadar:overdue     # tutup sesi refleksi lewat tenggat
php artisan sadar:reminders   # pengingat mood sesuai jam preferensi siswa
php artisan sadar:digest      # ringkasan harian untuk Guru BK
```

Dijadwalkan di `routes/console.php`; jalankan `php artisan schedule:work` saat pengembangan.

## Tes

Tes memakai MySQL (bukan SQLite) karena skema memakai `enum`, `json`, dan fungsi `FIELD()`.

```bash
mysql -urada -e "CREATE DATABASE IF NOT EXISTS sadar_diri_test"
php artisan test
```

Cakupan: kontrol akses antar peran, isolasi jurnal per kelas, 2FA superadmin, siklus sesi refleksi terbimbing, enkripsi jawaban, retensi alumni, dan ambang privasi laporan agregat.
