<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Guru BK dibuat dengan kata sandi pilihan superadmin, jadi tidak perlu
     * dipaksa menggantinya. Paksaan hanya berlaku untuk siswa (sandi awal NIS).
     */
    public function up(): void
    {
        DB::table('users')
            ->where('role', 'counselor')
            ->where('must_change_password', true)
            ->update(['must_change_password' => false]);
    }

    public function down(): void
    {
        // Nilai lama tidak bisa dipulihkan; perubahan ini satu arah.
    }
};
