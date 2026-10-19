<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('academic_years', function (Blueprint $table) {
            $table->id();
            $table->string('name', 20)->unique();
            $table->date('starts_on');
            $table->date('ends_on');
            $table->boolean('is_active')->default(false);
            $table->timestamps();
            $table->index('is_active');
        });

        Schema::create('classes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('academic_year_id')->constrained()->restrictOnDelete();
            $table->string('name', 50);
            $table->string('level', 10);
            $table->string('homeroom_teacher_name', 120)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['academic_year_id', 'name']);
        });

        Schema::create('class_student', function (Blueprint $table) {
            $table->id();
            $table->foreignId('class_id')->constrained('classes')->restrictOnDelete();
            $table->foreignId('student_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('academic_year_id')->constrained()->restrictOnDelete();
            $table->date('joined_at');
            $table->date('left_at')->nullable();
            $table->enum('status', ['active', 'moved', 'graduated'])->default('active');
            $table->timestamps();
            $table->unique(['class_id', 'student_id', 'academic_year_id']);
            $table->index(['student_id', 'status']);
        });

        Schema::create('counselor_class', function (Blueprint $table) {
            $table->id();
            $table->foreignId('counselor_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('class_id')->constrained('classes')->cascadeOnDelete();
            $table->timestamp('assigned_at')->useCurrent();
            $table->timestamps();
            $table->unique(['counselor_id', 'class_id']);
        });

        Schema::create('student_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained('users')->cascadeOnDelete();
            $table->date('birth_date')->nullable();
            $table->enum('gender', ['male', 'female'])->nullable();
            $table->text('address')->nullable();
            $table->string('phone', 20)->nullable();
            $table->unsignedSmallInteger('height_cm')->nullable();
            $table->unsignedSmallInteger('weight_kg')->nullable();
            $table->string('blood_type', 3)->nullable();
            $table->longText('medical_history')->nullable();
            $table->longText('health_notes')->nullable();
            $table->longText('psychological_summary')->nullable();
            $table->longText('character_summary')->nullable();
            $table->longText('strengths')->nullable();
            $table->longText('weaknesses')->nullable();
            $table->unsignedTinyInteger('completeness_percent')->default(0);
            $table->timestamp('published_at')->nullable();
            $table->unsignedInteger('version')->default(1);
            $table->timestamps();
        });

        Schema::create('student_profile_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_profile_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('version');
            $table->json('snapshot');
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('created_at')->nullable();
            $table->unique(['student_profile_id', 'version']);
        });

        Schema::create('content_items', function (Blueprint $table) {
            $table->id();
            $table->enum('type', ['abc_prompt', 'reflection_question', 'emotion_category', 'tip_article']);
            $table->string('title', 190);
            $table->string('slug', 190)->nullable();
            $table->longText('body');
            $table->json('metadata')->nullable();
            $table->unsignedInteger('version')->default(1);
            $table->enum('status', ['draft', 'published', 'archived'])->default('draft');
            $table->timestamp('published_at')->nullable();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();
            $table->unique(['type', 'slug']);
            $table->index(['type', 'status', 'published_at']);
        });

        Schema::create('content_item_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('content_item_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('version');
            $table->json('snapshot');
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('created_at')->nullable();
            $table->unique(['content_item_id', 'version']);
        });

        Schema::create('mood_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained('users')->cascadeOnDelete();
            $table->date('entry_date');
            $table->enum('valence', ['positive', 'negative']);
            $table->unsignedTinyInteger('intensity');
            $table->json('emotion_tags');
            $table->text('note')->nullable();
            $table->timestamps();
            $table->unique(['student_id', 'entry_date']);
            $table->index('entry_date');
        });

        Schema::create('journal_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained('users')->cascadeOnDelete();
            $table->enum('type', ['abc', 'grateful']);
            $table->date('entry_date');
            $table->foreignId('prompt_content_id')->nullable()->constrained('content_items')->nullOnDelete();
            $table->longText('activating_event')->nullable();
            $table->longText('belief')->nullable();
            $table->longText('consequence')->nullable();
            $table->longText('gratitude_text')->nullable();
            $table->longText('happiness_text')->nullable();
            $table->enum('status', ['draft', 'published'])->default('draft');
            $table->boolean('is_flagged')->default(false);
            $table->timestamp('flagged_at')->nullable();
            $table->timestamps();
            $table->index(['student_id', 'type', 'entry_date']);
            $table->index(['is_flagged', 'flagged_at']);
        });

        Schema::create('achievements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained('users')->cascadeOnDelete();
            $table->enum('category', ['academic', 'non_academic', 'competition', 'soft_skill']);
            $table->string('title', 190);
            $table->string('organizer', 190)->nullable();
            $table->enum('level', ['school', 'district', 'city', 'province', 'national', 'international'])->nullable();
            $table->date('achieved_at');
            $table->string('rank', 50)->nullable();
            $table->text('description')->nullable();
            $table->enum('verification_status', ['pending', 'verified', 'rejected'])->default('pending');
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('verified_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->timestamps();
            $table->index(['student_id', 'achieved_at']);
            $table->index(['verification_status', 'achieved_at']);
        });

        Schema::create('attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('achievement_id')->constrained()->cascadeOnDelete();
            $table->foreignId('uploaded_by')->constrained('users')->restrictOnDelete();
            $table->string('disk', 30);
            $table->string('path', 500);
            $table->string('original_name', 255);
            $table->string('mime_type', 100);
            $table->unsignedBigInteger('size_bytes');
            $table->char('checksum', 64)->nullable();
            $table->timestamps();
            $table->index('achievement_id');
        });

        Schema::create('reflection_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('counselor_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('class_id')->nullable()->constrained('classes')->cascadeOnDelete();
            $table->foreignId('student_id')->nullable()->constrained('users')->cascadeOnDelete();
            $table->string('topic', 190);
            $table->text('instructions')->nullable();
            $table->json('questions');
            $table->timestamp('due_at');
            $table->enum('status', ['scheduled', 'ongoing', 'completed', 'cancelled'])->default('scheduled');
            $table->timestamp('extended_at')->nullable();
            $table->text('extension_reason')->nullable();
            $table->timestamps();
            $table->index(['status', 'due_at']);
        });

        Schema::create('reflections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('session_id')->nullable()->constrained('reflection_sessions')->cascadeOnDelete();
            $table->enum('type', ['self', 'guided']);
            $table->date('week_start')->nullable();
            $table->longText('positive_experience')->nullable();
            $table->longText('negative_experience')->nullable();
            $table->longText('answers')->nullable();
            $table->enum('status', ['draft', 'submitted', 'late'])->default('draft');
            $table->timestamp('submitted_at')->nullable();
            $table->timestamps();
            $table->unique(['student_id', 'type', 'week_start']);
            $table->unique(['student_id', 'session_id']);
            $table->index(['student_id', 'submitted_at']);
        });

        Schema::create('reflection_feedbacks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reflection_id')->constrained()->cascadeOnDelete();
            $table->foreignId('counselor_id')->constrained('users')->restrictOnDelete();
            $table->text('content');
            $table->unsignedInteger('version')->default(1);
            $table->timestamps();
            $table->index('reflection_id');
        });

        Schema::create('action_plans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained('users')->cascadeOnDelete();
            $table->date('period_start');
            $table->date('period_end');
            $table->enum('status', ['active', 'closed'])->default('active');
            $table->timestamps();
            $table->unique(['student_id', 'period_start']);
        });

        Schema::create('action_targets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('action_plan_id')->constrained()->cascadeOnDelete();
            $table->string('title', 190);
            $table->text('success_indicator');
            $table->enum('status', ['not_started', 'in_progress', 'achieved', 'not_achieved'])->default('not_started');
            $table->text('progress_note')->nullable();
            $table->unsignedTinyInteger('sort_order')->default(0);
            $table->timestamps();
            $table->index(['action_plan_id', 'sort_order']);
        });

        Schema::create('action_evaluations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('action_plan_id')->unique()->constrained()->cascadeOnDelete();
            $table->json('snapshot');
            $table->longText('evaluation_text')->nullable();
            $table->longText('improvement_text')->nullable();
            $table->timestamps();
        });

        Schema::create('future_plans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->unique()->constrained('users')->cascadeOnDelete();
            $table->longText('dream')->nullable();
            $table->longText('career_plan')->nullable();
            $table->longText('education_plan')->nullable();
            $table->longText('concrete_targets')->nullable();
            $table->timestamps();
        });

        Schema::create('future_plan_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('future_plan_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('version');
            $table->json('snapshot');
            $table->timestamp('created_at')->nullable();
            $table->unique(['future_plan_id', 'version']);
        });

        Schema::create('counseling_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('counselor_id')->constrained('users')->restrictOnDelete();
            $table->string('title', 190);
            $table->timestamp('occurred_at');
            $table->string('summary', 500)->nullable();
            $table->longText('content');
            $table->enum('status', ['open', 'closed'])->default('open');
            $table->boolean('is_sensitive')->default(false);
            $table->boolean('visible_to_student')->default(false);
            $table->timestamps();
            $table->index(['student_id', 'occurred_at']);
            $table->index(['counselor_id', 'status']);
        });

        Schema::create('counseling_note_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('counseling_note_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('version');
            $table->json('snapshot');
            $table->foreignId('changed_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('created_at')->nullable();
            $table->unique(['counseling_note_id', 'version']);
        });

        Schema::create('alerts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained('users')->cascadeOnDelete();
            $table->enum('trigger_type', ['mood_low_streak', 'risk_keyword', 'inactivity', 'reflection_overdue']);
            $table->enum('severity', ['low', 'medium', 'high']);
            $table->enum('status', ['new', 'in_progress', 'resolved'])->default('new');
            $table->timestamp('detected_at');
            $table->foreignId('handled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('handled_at')->nullable();
            $table->text('resolution_note')->nullable();
            $table->string('dedupe_key', 191)->unique();
            $table->timestamps();
            $table->index(['status', 'severity', 'detected_at']);
            $table->index(['student_id', 'detected_at']);
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action', 80);
            $table->string('entity_type', 80)->nullable();
            $table->unsignedBigInteger('entity_id')->nullable();
            $table->foreignId('subject_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('reason', 500)->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 500)->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['actor_id', 'created_at']);
            $table->index(['subject_user_id', 'created_at']);
            $table->index(['entity_type', 'entity_id']);
            $table->index(['action', 'created_at']);
        });

        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('key', 100)->unique();
            $table->text('value')->nullable();
            $table->string('group', 50)->default('general');
            $table->enum('type', ['string', 'boolean', 'integer', 'json'])->default('string');
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('settings_versions', function (Blueprint $table) {
            $table->id();
            $table->string('setting_key', 100);
            $table->text('old_value')->nullable();
            $table->text('new_value')->nullable();
            $table->foreignId('changed_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('created_at')->nullable();
            $table->index(['setting_key', 'created_at']);
        });

        Schema::create('announcements', function (Blueprint $table) {
            $table->id();
            $table->string('title', 190);
            $table->text('body');
            $table->enum('audience', ['all', 'role', 'class']);
            $table->string('audience_role', 30)->nullable();
            $table->foreignId('audience_class_id')->nullable()->constrained('classes')->nullOnDelete();
            $table->enum('status', ['draft', 'scheduled', 'published', 'archived'])->default('draft');
            $table->timestamp('published_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();
            $table->index(['audience', 'status', 'published_at']);
        });

        Schema::create('consent_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('version', 20);
            $table->timestamp('accepted_at');
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 500)->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'accepted_at']);
        });

        Schema::create('import_batches', function (Blueprint $table) {
            $table->id();
            $table->string('filename', 255);
            $table->string('disk_path', 500);
            $table->unsignedInteger('total_rows')->default(0);
            $table->unsignedInteger('success_rows')->default(0);
            $table->unsignedInteger('failed_rows')->default(0);
            $table->enum('status', ['queued', 'processing', 'completed', 'failed'])->default('queued');
            $table->string('error_report_path', 500)->nullable();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();
            $table->timestamp('finished_at')->nullable();
        });

        Schema::create('import_batch_rows', function (Blueprint $table) {
            $table->id();
            $table->foreignId('import_batch_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('row_number');
            $table->json('payload');
            $table->enum('status', ['success', 'failed']);
            $table->string('error_message', 500)->nullable();
            $table->timestamps();
            $table->index(['import_batch_id', 'status']);
        });

        Schema::create('login_attempts', function (Blueprint $table) {
            $table->id();
            $table->string('identity', 190);
            $table->string('ip_address', 45);
            $table->boolean('successful')->default(false);
            $table->timestamp('attempted_at')->useCurrent();
            $table->index(['identity', 'attempted_at']);
            $table->index(['ip_address', 'attempted_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('login_attempts');
        Schema::dropIfExists('import_batch_rows');
        Schema::dropIfExists('import_batches');
        Schema::dropIfExists('consent_records');
        Schema::dropIfExists('announcements');
        Schema::dropIfExists('settings_versions');
        Schema::dropIfExists('settings');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('alerts');
        Schema::dropIfExists('counseling_note_versions');
        Schema::dropIfExists('counseling_notes');
        Schema::dropIfExists('future_plan_versions');
        Schema::dropIfExists('future_plans');
        Schema::dropIfExists('action_evaluations');
        Schema::dropIfExists('action_targets');
        Schema::dropIfExists('action_plans');
        Schema::dropIfExists('reflection_feedbacks');
        Schema::dropIfExists('reflections');
        Schema::dropIfExists('reflection_sessions');
        Schema::dropIfExists('attachments');
        Schema::dropIfExists('achievements');
        Schema::dropIfExists('journal_entries');
        Schema::dropIfExists('mood_entries');
        Schema::dropIfExists('content_item_versions');
        Schema::dropIfExists('content_items');
        Schema::dropIfExists('student_profile_versions');
        Schema::dropIfExists('student_profiles');
        Schema::dropIfExists('counselor_class');
        Schema::dropIfExists('class_student');
        Schema::dropIfExists('classes');
        Schema::dropIfExists('academic_years');
    }
};
