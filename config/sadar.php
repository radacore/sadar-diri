<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Kode OTP tetap untuk pengembangan
    |--------------------------------------------------------------------------
    |
    | Bila diisi dan aplikasi berjalan pada environment "local", kode ini dipakai
    | untuk semua verifikasi dua faktor dan email tidak dikirim. Biarkan kosong
    | (atau hapus) di produksi.
    |
    */

    'dev_otp_code' => env('SADAR_DEV_OTP_CODE'),

];
