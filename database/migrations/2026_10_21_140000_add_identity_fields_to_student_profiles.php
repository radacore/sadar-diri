<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('student_profiles', function (Blueprint $table) {
            // NIK disimpan terenkripsi karena termasuk data kependudukan.
            $table->longText('nik')->nullable()->after('phone');
            $table->string('father_phone', 20)->nullable()->after('nik');
            $table->string('mother_phone', 20)->nullable()->after('father_phone');
            $table->json('social_media')->nullable()->after('extra_fields');
        });
    }

    public function down(): void
    {
        Schema::table('student_profiles', function (Blueprint $table) {
            $table->dropColumn(['nik', 'father_phone', 'mother_phone', 'social_media']);
        });
    }
};
