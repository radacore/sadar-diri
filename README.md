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
| Superadmin | `rahmatdanisyw@gmail.com` atau `ADM001` | `Password123` + kode OTP email |
| Guru BK (X IPA 1, X IPA 2, X IPS 1) | `rina@sadar-diri.test` | `Password123` |
| Guru BK (X IPA 1, X IPA 2, X IPS 1) | `hendra@sadar-diri.test` | `Password123` |
| Siswa | NIS `2024001`–`2024036` | `Password123` |

Kedua akun Guru BK punya hak akses yang sama dan sama-sama mendampingi ketiga kelas di satu angkatan. Ini memperagakan pola sekolah dengan banyak kelas paralel dan satu tim BK: satu Guru BK boleh memegang banyak kelas, dan satu kelas boleh punya lebih dari satu Guru BK. Superadmin mengatur sendiri pembagiannya di menu **Kelas** (tombol *Tugaskan Guru BK* memakai pilihan banyak kelas sekaligus).

Superadmin masuk dengan kata sandi lalu mengonfirmasi **kode 6 digit yang dikirim ke email** akunnya (berlaku 10 menit, sekali pakai, kirim ulang tiap 60 detik).

## Pemetaan fitur ke dimensi Ryff

| # | Fitur | Pengisi | Guru BK |
|---|---|---|---|
| 1 | Sistem Informasi | Siswa & Guru BK | Lihat & ubah biodata/profil diri |
| 2 | Journaling Emosi (mood + media katarsis) | Siswa | Baca jurnal & **membalas langsung**; tindak lanjut konseling opsional bagi siswa |
| 3 | Portofolio Prestasi | Siswa & Guru BK | Lihat, verifikasi, tambah prestasi |
| 4 | Ruang Refleksi & Syukur | Siswa | Lihat, beri umpan balik pada refleksi terbimbing |
| 5 | Perencanaan Masa Depan | Siswa | Lihat target, evaluasi, dan rencana masa depan |

Balasan jurnal dan perubahan profil oleh Guru BK tercatat di audit log. Siswa dapat memilih **tidak** meminta konseling lanjutan; Guru BK tetap dapat membaca jurnalnya.

## Pola UI

- **Mode ponsel permanen**: peran siswa dan Guru BK selalu memakai tata letak ponsel, termasuk saat dibuka di desktop (kolom 480px di tengah dengan bingkai). Halaman mereka tidak memakai breakpoint `sm:`/`lg:`, dan seluruh overlay (sheet, dialog konfirmasi, popover, toast) dibatasi maksimal 448px agar tidak pernah lebih lebar dari layar ponsel. Navigasi utama hanya bottom nav (gaya liquid cutout seperti file desain); tidak ada menu burger, halaman lain diakses lewat menu akun. Peran Superadmin tetap responsif penuh (sidebar di ≥1024px).
- **Top nav** (`Layouts/AppShell.jsx`): lonceng notifikasi dengan lencana dan menu profil berisi nama, peran, serta avatar inisial. Setiap halaman transisi dengan `sd-page`/`sd-card` dan popover memakai `sd-popover` (animasi `prefers-reduced-motion` dihormati).
- **Konfirmasi aksi** (`useConfirm` dari `Components/UI.jsx`): semua aksi yang mengubah data atau mengakhiri sesi melewati dialog konfirmasi. `requireReason` menggantikan `window.prompt` untuk aksi yang dicatat di audit log; nilainya tersedia sebagai `decision.reason`.
- **Warna tombol**: `primary` (simpan/buat), `success` (verifikasi/setujui/selesaikan), `danger` (hapus/tolak/cabut), `warning` (aksi massal & tak dapat dibatalkan), `info` (ekspor/unduh), `outline`/`soft`/`ghost` untuk aksi sekunder. Aksi baris tabel memakai `IconButton` agar tidak membungkus.

## Email (Resend)

Semua email transaksional dikirim lewat [Resend](https://resend.com):

| Email | Pemicu |
|---|---|
| `LoginOtpMail` | Login Superadmin — kode OTP 6 digit |
| `PasswordResetMail` | Lupa kata sandi (siswa, Guru BK, Superadmin) dan reset oleh admin |

Konfigurasi di `.env`:

```dotenv
MAIL_MAILER=resend
RESEND_API_KEY=re_xxxxxxxxxxxx
MAIL_FROM_ADDRESS="notifikasi@sadar-diri.my.id"
MAIL_FROM_NAME="${APP_NAME}"
```

Domain `sadar-diri.my.id` sudah terverifikasi di Resend (region `ap-northeast-1`), sehingga pengiriman bisa dilakukan ke alamat mana pun, bukan hanya email pemilik akun Resend.

Alamat pengirim **tidak** ditulis di Mailable, Notification, maupun Controller. Kedua Mailable (`LoginOtpMail`, `PasswordResetMail`) hanya menetapkan subjek, sehingga `from` selalu diambil dari `mail.from` di `config/mail.php`. Untuk mengganti pengirim cukup ubah `MAIL_FROM_ADDRESS`/`MAIL_FROM_NAME` di `.env` lalu jalankan `php artisan config:clear`.

Alamat `notifikasi@` khusus untuk email keluar (kode verifikasi dan tautan reset kata sandi). Footer setiap email memuat keterangan "Jangan balas email ini" karena kotak masuk alamat tersebut tidak dipantau; email yang masuk ke sana akan memantul (domain belum punya record MX).

Kalau memakai domain lain, verifikasi dulu di dashboard Resend (record SPF/DKIM), lalu ganti `MAIL_FROM_ADDRESS` ke alamat di domain tersebut.

Selama `RESEND_API_KEY` kosong, `AppServiceProvider` otomatis mengalihkan mailer ke `log` supaya alur login dan reset tetap bisa diuji tanpa mengirim email.

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

Dokumentasi lengkap (arsitektur, skema data, seluruh endpoint, aturan bisnis, keputusan privasi): [`PROYEK.md`](PROYEK.md).
