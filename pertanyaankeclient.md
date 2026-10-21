# Pertanyaan Konfirmasi untuk Client

**Topik:** Aturan penugasan Guru BK ke kelas pada aplikasi SADAR DIRI
**Tujuan:** Menetapkan aturan baku sebelum diubah di sistem, agar data siswa tidak tumpang tindih dan tidak perlu dibongkar lagi di kemudian hari.
**Cara menjawab:** Centang (☑) satu pilihan pada tiap pertanyaan, lalu isi lembar jawaban di bagian akhir.

---

## Konteks singkat

Saat ini aplikasi membolehkan **satu kelas didampingi beberapa Guru BK** dan **satu Guru BK memegang beberapa kelas** sekaligus. Akibatnya, seorang siswa bisa terlihat oleh lebih dari satu Guru BK, dan satu Guru BK bisa memegang puluhan siswa dari kelas berbeda.

Pada data contoh yang dipakai saat pertanyaan ini disusun, kondisinya seperti ini:

| Guru BK | Kelas yang dipegang | Jumlah siswa terlihat |
|---|---|---|
| Rina Wati | X IPA 1, XI IPA 2, XII IPS 1 | 36 siswa |
| Hendra Saputra | XII IPS 1 | 12 siswa |

Perhatikan bahwa **XII IPS 1 dipegang oleh dua Guru BK sekaligus**, dan seluruh siswa Hendra juga terlihat oleh Rina. Ini yang ingin kita rapikan.

> Data contoh sudah diperbarui setelah jawaban diterima: sekarang tiga kelas dalam satu angkatan (X IPA 1, X IPA 2, X IPS 1) dan kedua Guru BK memegang ketiganya. Lihat bagian **Jawaban client** di bawah.

---

## Pertanyaan 1 — Rasio Guru BK dan Kelas

**Apakah satu Guru BK hanya boleh mendampingi satu kelas, dan satu kelas hanya boleh punya satu Guru BK?**

- [ ] **Pilihan A — Ya, berlaku per tahun ajaran**
  Satu kelas hanya punya satu Guru BK, dan satu Guru BK hanya memegang satu kelas. Batas ini dihitung **per tahun ajaran**, sehingga pada tahun ajaran berikutnya Guru BK boleh ditugaskan ke kelas lain.
  *Konsekuensi:* sistem akan menolak penugasan kedua dengan pesan yang jelas. Guru BK yang sudah memegang satu kelas tidak bisa diberi kelas tambahan di tahun ajaran yang sama.

- [ ] **Pilihan B — Ya, berlaku selamanya**
  Satu Guru BK seumur hidup hanya boleh memegang satu kelas, tanpa memandang tahun ajaran.
  *Konsekuensi:* Guru BK tidak bisa dipindah ke kelas lain sama sekali, termasuk saat siswa naik kelas. Pilihan ini cocok hanya jika sekolah memang tidak pernah merotasi Guru BK.

- [ ] **Pilihan C — Tidak, tetap boleh lebih dari satu**
  Satu kelas boleh didampingi beberapa Guru BK, dan satu Guru BK boleh memegang beberapa kelas.
  *Konsekuensi:* tidak ada aturan baru di sistem. Yang dirapikan hanya data contoh, dan risiko data terlihat oleh lebih dari satu Guru BK tetap ada.

---

## Pertanyaan 2 — Guru BK Saat Siswa Naik Kelas

**Ketika siswa naik kelas atau tahun ajaran berganti, apakah Guru BK-nya tetap mendampingi atau dirotasi?**

- [ ] **Pilihan A — Rotasi setiap naik kelas**
  Guru BK mendampingi satu angkatan selama satu tahun ajaran. Saat naik kelas, penugasan lama diakhiri dan kelas baru mendapat Guru BK — bisa orang yang sama, bisa berbeda, tergantung keputusan sekolah.
  *Konsekuensi:* riwayat pendampingan tetap tersimpan. Guru BK lama masih bisa membuka data siswa dari masa ia mendampingi, tetapi tidak lagi melihat perkembangan siswa di kelas baru.

- [ ] **Pilihan B — Tetap sampai lulus**
  Guru BK mengikuti angkatannya sampai lulus (sekitar tiga tahun), sehingga penugasan ikut berpindah setiap siswa naik kelas.
  *Konsekuensi:* penugasan harus berpindah ke kelas baru setiap tahun, sehingga pilihan ini **tidak cocok** dengan Pilihan B pada Pertanyaan 1 (satu kelas selamanya). Sekolah juga perlu memastikan proses kenaikan kelas dijalankan tertib agar pendampingan tidak terputus.

- [ ] **Pilihan C — Diserahkan ke admin sekolah**
  Sistem tidak mengatur rotasi. Admin sekolah bebas melepas dan menugaskan Guru BK kapan saja melalui halaman **Kelas & Penugasan**.
  *Konsekuensi:* paling fleksibel, tetapi konsistensi data bergantung sepenuhnya pada kedisiplinan admin.

---

## Pertanyaan 3 — Kapasitas Sekolah (data pendukung)

Jawaban ini dipakai untuk memastikan aturan yang dipilih benar-benar bisa dijalankan.

1. Berapa jumlah **Guru BK** yang aktif di sekolah? ..............
2. Berapa jumlah **kelas (rombongan belajar)** yang berjalan tahun ini? ..............
3. Apakah setiap kelas sudah pasti mendapat Guru BK, atau ada kelas yang dibiarkan tanpa pendamping? ..............

> Catatan: bila jumlah kelas lebih banyak daripada jumlah Guru BK, aturan "satu Guru BK satu kelas" tidak mungkin dipenuhi tanpa menambah tenaga. Bila itu terjadi, kami sarankan memakai **Pilihan C** pada Pertanyaan 1.

---

## Lembar Jawaban

| No | Pertanyaan | Jawaban |
|---|---|---|
| 1 | Rasio Guru BK dan kelas | A / B / C |
| 2 | Guru BK saat naik kelas | A / B / C |
| 3a | Jumlah Guru BK aktif | .............. |
| 3b | Jumlah kelas berjalan | .............. |
| 3c | Ada kelas tanpa Guru BK? | Ya / Tidak |

**Catatan tambahan dari sekolah:**

```
................................................................................
................................................................................
```

Nama: ..............................................  Jabatan: ..............................................

Tanggal: ..............................................

---

## Jawaban client

Diterima 20 Oktober 2026.

| No | Pertanyaan | Jawaban client |
|---|---|---|
| 1 | Rasio Guru BK dan kelas | **Pilihan C** — tetap boleh lebih dari satu. Satu Guru BK memegang **7 kelas** (satu angkatan), sehingga aturan "1 guru = 1 kelas" tidak mungkin dijalankan. Alternatif yang disepakati: **2 Guru BK per angkatan**. |
| 2 | Guru BK saat naik kelas | **Pilihan B** — Guru BK mengikuti siswa dari kelas X sampai XII. Kutipan: "saya sebagai guru BK juga mengikuti supaya tahu progres anak-anak". |
| 3a | Jumlah Guru BK aktif | 2 orang untuk satu angkatan. |
| 3b | Jumlah kelas berjalan | 7 kelas dalam satu angkatan. |
| 3c | Ada kelas tanpa Guru BK? | Tidak; seluruh kelas dalam angkatan didampingi tim BK yang sama. |
| — | Wali kelas | Sebagian mengikuti, sebagian diganti. Untuk keperluan sistem dianggap **semua wali kelas mengikuti** siswa. |

### Keputusan yang diturunkan dari jawaban ini

1. **Relasi `counselor_class` tetap many-to-many.** Tidak ada `unique(class_id)`. Yang ditegakkan hanya `unique(counselor_id, class_id)` supaya penugasan yang sama tidak tercatat dua kali.
2. **Kenaikan kelas menyalin penugasan.** `AcademicYearController::promote()` menyalin penugasan Guru BK dari kelas asal ke kelas tujuan dalam transaksi yang sama, sehingga pendampingan tidak terputus saat siswa naik. Superadmin bisa mematikannya lewat centang *Ikutkan Guru BK pendamping* di dialog kenaikan kelas.
3. **Penugasan lama tidak dihapus.** Riwayat tetap tersimpan agar Guru BK masih dapat membaca data siswa dari masa dampingannya (`AccessScope` tidak memfilter status keanggotaan kelas).
4. **Superadmin yang mengatur pembagian.** Menu **Kelas** menyediakan penugasan banyak kelas sekaligus per Guru BK dan tombol lepas per kelas. Jumlah Guru BK per kelas tidak dibatasi; bila lebih dari 2, antarmuka hanya menampilkan catatan lunak (tidak memblokir).
5. **Data demo mengikuti sekolah client.** Tiga kelas satu angkatan (X IPA 1, X IPA 2, X IPS 1), dua Guru BK memegang ketiganya.

---

## Lampiran — Istilah

| Istilah | Arti |
|---|---|
| **Guru BK** | Guru Bimbingan Konseling yang mendampingi siswa. Di sistem, perannya bernama `counselor`. |
| **Kelas** | Rombongan belajar pada satu tahun ajaran, misalnya *X IPA 1*. |
| **Penugasan** | Keterangan bahwa seorang Guru BK mendampingi kelas tertentu. Tersimpan pada tabel `counselor_class`. |
| **Tahun ajaran** | Periode belajar, misalnya *2026/2027*. Satu tahun ajaran berisi beberapa kelas. |
| **Rotasi** | Penggantian Guru BK pendamping ketika siswa naik kelas atau tahun ajaran berganti. |
