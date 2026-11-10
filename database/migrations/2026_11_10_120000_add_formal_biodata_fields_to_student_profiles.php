<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('student_profiles', function (Blueprint $table) {
            $table->string('nickname', 100)->nullable()->after('birth_place');
            $table->string('ethnicity', 100)->nullable()->after('nickname');
            $table->string('favorite_subject', 100)->nullable()->after('previous_school');
            $table->string('hobby', 200)->nullable()->after('favorite_subject');
            $table->string('dream', 200)->nullable()->after('hobby');
            $table->string('father_address', 500)->nullable()->after('father_occupation');
            $table->string('mother_address', 500)->nullable()->after('mother_occupation');
        });
    }

    public function down(): void
    {
        Schema::table('student_profiles', function (Blueprint $table) {
            $table->dropColumn([
                'nickname', 'ethnicity', 'favorite_subject', 'hobby', 'dream',
                'father_address', 'mother_address',
            ]);
        });
    }
};
