<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Melengkapi kolom identitas peserta didik (lembar sekolah):
     * NISN, anak ke-, sekolah asal, penerimaan, data orang tua dan wali.
     */
    public function up(): void
    {
        Schema::table('student_profiles', function (Blueprint $table) {
            $table->string('nisn', 20)->nullable()->after('user_id');
            $table->unsignedTinyInteger('birth_order')->nullable()->after('family_status');
            $table->string('previous_school', 150)->nullable()->after('birth_order');
            $table->string('admission_class', 50)->nullable()->after('previous_school');
            $table->date('admission_date')->nullable()->after('admission_class');

            $table->string('father_name', 120)->nullable()->after('mother_phone');
            $table->string('mother_name', 120)->nullable()->after('father_name');
            $table->string('parent_address', 500)->nullable()->after('mother_name');
            $table->string('father_occupation', 100)->nullable()->after('parent_address');
            $table->string('mother_occupation', 100)->nullable()->after('father_occupation');

            $table->string('guardian_name', 120)->nullable()->after('mother_occupation');
            $table->string('guardian_phone', 20)->nullable()->after('guardian_name');
            $table->string('guardian_address', 500)->nullable()->after('guardian_phone');
            $table->string('guardian_occupation', 100)->nullable()->after('guardian_address');
        });
    }

    public function down(): void
    {
        Schema::table('student_profiles', function (Blueprint $table) {
            $table->dropColumn([
                'nisn',
                'birth_order',
                'previous_school',
                'admission_class',
                'admission_date',
                'father_name',
                'mother_name',
                'parent_address',
                'father_occupation',
                'mother_occupation',
                'guardian_name',
                'guardian_phone',
                'guardian_address',
                'guardian_occupation',
            ]);
        });
    }
};
