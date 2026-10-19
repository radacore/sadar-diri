<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('journal_entries', function (Blueprint $table) {
            $table->boolean('follow_up_requested')->default(false)->after('is_flagged');
            $table->timestamp('follow_up_requested_at')->nullable()->after('follow_up_requested');
            $table->index('follow_up_requested');
        });

        Schema::create('journal_replies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('journal_entry_id')->constrained('journal_entries')->cascadeOnDelete();
            $table->foreignId('counselor_id')->constrained('users')->restrictOnDelete();
            $table->longText('content');
            $table->timestamps();
            $table->index(['journal_entry_id', 'created_at']);
        });

        Schema::table('achievements', function (Blueprint $table) {
            $table->foreignId('created_by')->nullable()->after('student_id')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('achievements', function (Blueprint $table) {
            $table->dropConstrainedForeignId('created_by');
        });

        Schema::dropIfExists('journal_replies');

        Schema::table('journal_entries', function (Blueprint $table) {
            $table->dropIndex(['follow_up_requested']);
            $table->dropColumn(['follow_up_requested', 'follow_up_requested_at']);
        });
    }
};
