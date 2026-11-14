<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('action_targets', function (Blueprint $table) {
            $table->text('success_indicator')->nullable()->change();
        });
    }

    public function down(): void
    {
        DB::table('action_targets')->whereNull('success_indicator')->update(['success_indicator' => '']);

        Schema::table('action_targets', function (Blueprint $table) {
            $table->text('success_indicator')->nullable(false)->change();
        });
    }
};
