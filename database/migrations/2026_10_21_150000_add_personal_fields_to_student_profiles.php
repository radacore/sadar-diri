<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('student_profiles', function (Blueprint $table) {
            $table->string('birth_place', 100)->nullable()->after('birth_date');
            $table->string('religion', 20)->nullable()->after('birth_place');
            $table->string('family_status', 20)->nullable()->after('religion');
        });
    }

    public function down(): void
    {
        Schema::table('student_profiles', function (Blueprint $table) {
            $table->dropColumn(['birth_place', 'religion', 'family_status']);
        });
    }
};
