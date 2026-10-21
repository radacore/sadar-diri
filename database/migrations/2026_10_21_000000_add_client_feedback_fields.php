<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('student_profiles', function (Blueprint $table) {
            $table->longText('extra_fields')->nullable()->after('weaknesses');
        });

        Schema::table('reflections', function (Blueprint $table) {
            $table->longText('gratitude_text')->nullable()->after('week_start');
        });

        Schema::table('action_targets', function (Blueprint $table) {
            $table->enum('basis', ['general', 'reflection', 'future_plan'])
                ->default('general')->after('success_indicator');
        });

        Schema::create('action_target_steps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('action_target_id')->constrained('action_targets')->cascadeOnDelete();
            $table->string('title', 190);
            $table->boolean('is_done')->default(false);
            $table->unsignedTinyInteger('sort_order')->default(0);
            $table->timestamps();
            $table->index(['action_target_id', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('action_target_steps');

        Schema::table('action_targets', function (Blueprint $table) {
            $table->dropColumn('basis');
        });

        Schema::table('reflections', function (Blueprint $table) {
            $table->dropColumn('gratitude_text');
        });

        Schema::table('student_profiles', function (Blueprint $table) {
            $table->dropColumn('extra_fields');
        });
    }
};
