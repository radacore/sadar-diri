<?php

use App\Http\Controllers\Admin\AcademicYearController;
use App\Http\Controllers\Admin\AdminController;
use App\Http\Controllers\Admin\AnnouncementController as AdminAnnouncementController;
use App\Http\Controllers\Admin\ClassController;
use App\Http\Controllers\Admin\ContentController;
use App\Http\Controllers\Admin\RetentionController;
use App\Http\Controllers\Admin\UserController as AdminUserController;
use App\Http\Controllers\AttachmentController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\Counselor\AchievementController as CounselorAchievementController;
use App\Http\Controllers\Counselor\AlertController as CounselorAlertController;
use App\Http\Controllers\Counselor\CounselingNoteController;
use App\Http\Controllers\Counselor\CounselorController;
use App\Http\Controllers\Counselor\ReflectionSessionController;
use App\Http\Controllers\Counselor\ReportController as CounselorReportController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\Student\AchievementController;
use App\Http\Controllers\Student\ActionPlanController;
use App\Http\Controllers\Student\JournalController;
use App\Http\Controllers\Student\MoodController;
use App\Http\Controllers\Student\ReflectionController;
use App\Http\Controllers\Student\StudentController;
use Illuminate\Support\Facades\Route;

Route::prefix('public')->group(function () {
    Route::get('/school', fn () => response()->json([
        'success' => true,
        'data' => app(\App\Services\SettingsService::class)->school() + [
            'academic_year' => \App\Models\AcademicYear::query()->where('is_active', true)->value('name'),
        ],
    ]));

    Route::get('/consent/{version}', function (string $version) {
        return response()->json([
            'success' => true,
            'data' => [
                'version' => $version,
                'title' => 'Persetujuan Pemrosesan Data Psikologis',
                'body' => 'SADAR DIRI memproses data emosi, jurnal, refleksi, dan portofolio Anda untuk mendukung layanan Bimbingan dan Konseling. Data dienkripsi, hanya dapat dibaca oleh Guru BK kelas Anda, dan tidak dapat dibaca oleh Superadmin. Anda dapat mencabut persetujuan kapan saja melalui halaman Privasi.',
                'effective_at' => $version,
            ],
        ]);
    });
});

Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:5,15');
    Route::post('/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:10,15');
    Route::post('/activate', [AuthController::class, 'activate']);

    Route::middleware('auth')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/consent', [AuthController::class, 'consent']);
        Route::delete('/consent', [AuthController::class, 'revokeConsent']);
        Route::post('/2fa/verify', [AuthController::class, 'verifyTwoFactor'])->middleware('throttle:10,1');
        Route::post('/2fa/resend', [AuthController::class, 'resendOtp'])->middleware('throttle:6,1');
    });
});

Route::middleware(['auth', 'role:student'])->prefix('student')->group(function () {
    Route::get('/dashboard', [StudentController::class, 'dashboard']);
    Route::get('/profile', [StudentController::class, 'profile']);
    Route::put('/profile/biodata', [StudentController::class, 'updateBiodata']);
    Route::put('/profile/self', [StudentController::class, 'updateSelfProfile']);
    Route::get('/profile/versions', [StudentController::class, 'profileVersions']);
    Route::get('/counseling-summaries', [StudentController::class, 'counselingSummaries']);
    Route::get('/privacy/access-log', [StudentController::class, 'accessLog']);
    Route::get('/preferences/reminders', [StudentController::class, 'reminderPreferences']);
    Route::put('/preferences/reminders', [StudentController::class, 'updateReminderPreferences']);
    Route::post('/whatsapp-link', [StudentController::class, 'whatsappLink']);

    Route::middleware('consent:journaling')->group(function () {
        Route::get('/moods', [MoodController::class, 'index']);
        Route::post('/moods', [MoodController::class, 'store']);
        Route::get('/moods/summary', [MoodController::class, 'summary']);

        Route::get('/journals', [JournalController::class, 'index']);
        Route::get('/journals/draft', [JournalController::class, 'draft']);
        Route::post('/journals', [JournalController::class, 'store']);
        Route::get('/journals/{journal}', [JournalController::class, 'show']);
        Route::put('/journals/{journal}', [JournalController::class, 'update']);
        Route::delete('/journals/{journal}', [JournalController::class, 'destroy']);

        Route::get('/reflections', [ReflectionController::class, 'index']);
        Route::post('/reflections', [ReflectionController::class, 'store']);
        Route::get('/reflections/{reflection}', [ReflectionController::class, 'show']);
        Route::put('/reflections/{reflection}', [ReflectionController::class, 'update']);
        Route::get('/reflection-sessions', [ReflectionController::class, 'sessions']);
        Route::post('/reflection-sessions/{session}/submit', [ReflectionController::class, 'submitSession']);
    });

    Route::middleware('consent:portfolio')->group(function () {
        Route::get('/achievements', [AchievementController::class, 'index']);
        Route::post('/achievements', [AchievementController::class, 'store']);
        Route::put('/achievements/{achievement}', [AchievementController::class, 'update']);
        Route::delete('/achievements/{achievement}', [AchievementController::class, 'destroy']);
        Route::post('/achievements/{achievement}/attachments', [AchievementController::class, 'upload']);
        Route::delete('/attachments/{attachment}', [AchievementController::class, 'destroyAttachment']);
        Route::get('/achievements/export', [AchievementController::class, 'export']);
    });

    Route::get('/action-plans/current', [ActionPlanController::class, 'current']);
    Route::post('/action-plans', [ActionPlanController::class, 'store']);
    Route::post('/action-plans/{plan}/targets', [ActionPlanController::class, 'storeTarget']);
    Route::put('/action-targets/{target}', [ActionPlanController::class, 'updateTarget']);
    Route::delete('/action-targets/{target}', [ActionPlanController::class, 'destroyTarget']);
    Route::get('/action-plans/{plan}/evaluation', [ActionPlanController::class, 'evaluation']);
    Route::post('/action-plans/{plan}/evaluation', [ActionPlanController::class, 'saveEvaluation']);
    Route::get('/future-plan', [ActionPlanController::class, 'futurePlan']);
    Route::put('/future-plan', [ActionPlanController::class, 'updateFuturePlan']);
});

Route::middleware(['auth', 'role:counselor'])->prefix('counselor')->group(function () {
    Route::get('/dashboard', [CounselorController::class, 'dashboard']);
    Route::get('/students', [CounselorController::class, 'students']);
    Route::get('/students/{student}/overview', [CounselorController::class, 'overview']);
    Route::get('/students/{student}/journals', [CounselorController::class, 'journals']);
    Route::get('/students/{student}/reflections', [CounselorController::class, 'reflections']);
    Route::get('/students/{student}/achievements', [CounselorController::class, 'achievements']);
    Route::post('/students/{student}/achievements', [CounselorController::class, 'storeAchievement']);
    Route::put('/students/{student}/profile/biodata', [CounselorController::class, 'updateBiodata']);
    Route::put('/students/{student}/profile/self', [CounselorController::class, 'updateSelfProfile']);
    Route::get('/students/{student}/action-plan', [CounselorController::class, 'actionPlan']);
    Route::post('/journals/{journal}/replies', [CounselorController::class, 'replyToJournal']);
    Route::get('/students/{student}/access-logs', [CounselorController::class, 'accessLogs']);
    Route::put('/preferences/notifications', [CounselorController::class, 'updatePreferences']);

    Route::get('/alerts', [CounselorAlertController::class, 'index']);
    Route::get('/alerts/{alert}', [CounselorAlertController::class, 'show']);
    Route::patch('/alerts/{alert}', [CounselorAlertController::class, 'update']);

    Route::get('/counseling-notes', [CounselingNoteController::class, 'index']);
    Route::post('/counseling-notes', [CounselingNoteController::class, 'store']);
    Route::get('/counseling-notes/{note}', [CounselingNoteController::class, 'show']);
    Route::put('/counseling-notes/{note}', [CounselingNoteController::class, 'update']);

    Route::get('/reflection-sessions', [ReflectionSessionController::class, 'index']);
    Route::post('/reflection-sessions', [ReflectionSessionController::class, 'store']);
    Route::get('/reflection-sessions/{session}', [ReflectionSessionController::class, 'show']);
    Route::patch('/reflection-sessions/{session}', [ReflectionSessionController::class, 'update']);
    Route::post('/reflections/{reflection}/feedback', [ReflectionSessionController::class, 'storeFeedback']);

    Route::get('/achievements/pending', [CounselorAchievementController::class, 'pending']);
    Route::post('/achievements/{achievement}/verify', [CounselorAchievementController::class, 'verify']);

    Route::get('/reports/class', [CounselorReportController::class, 'classReport']);
    Route::get('/reports/class/export', [CounselorReportController::class, 'export']);
});

Route::middleware(['auth', 'role:superadmin', 'twofactor'])->prefix('admin')->group(function () {
    Route::get('/dashboard', [AdminController::class, 'dashboard']);
    Route::get('/reports/aggregate', [AdminController::class, 'aggregate']);
    Route::get('/reports/aggregate/export', [AdminController::class, 'exportAggregate']);
    Route::get('/settings', [AdminController::class, 'settings']);
    Route::put('/settings', [AdminController::class, 'updateSettings']);
    Route::get('/audit-logs', [AdminController::class, 'auditLogs']);
    Route::get('/classes/options', [AdminController::class, 'classes']);

    Route::get('/users', [AdminUserController::class, 'index']);
    Route::post('/users', [AdminUserController::class, 'store']);
    Route::post('/users/import', [AdminUserController::class, 'import']);
    Route::get('/users/import/{batch}', [AdminUserController::class, 'importBatch']);
    Route::get('/users/{user}', [AdminUserController::class, 'show']);
    Route::put('/users/{user}', [AdminUserController::class, 'update']);
    Route::patch('/users/{user}/status', [AdminUserController::class, 'updateStatus']);
    Route::post('/users/{user}/reset-password', [AdminUserController::class, 'resetPassword']);
    Route::post('/users/{user}/force-logout', [AdminUserController::class, 'forceLogout']);
    Route::post('/users/{user}/anonymize', [AdminUserController::class, 'anonymize']);

    Route::get('/classes', [ClassController::class, 'index']);
    Route::post('/classes', [ClassController::class, 'store']);
    Route::put('/classes/{class}', [ClassController::class, 'update']);
    Route::delete('/classes/{class}', [ClassController::class, 'destroy']);
    Route::post('/classes/{class}/students', [ClassController::class, 'assignStudents']);
    Route::delete('/classes/{class}/students/{student}', [ClassController::class, 'removeStudent']);
    Route::post('/classes/{class}/counselors', [ClassController::class, 'assignCounselor']);
    Route::delete('/classes/{class}/counselors/{counselor}', [ClassController::class, 'removeCounselor']);

    Route::get('/academic-years', [AcademicYearController::class, 'index']);
    Route::post('/academic-years', [AcademicYearController::class, 'store']);
    Route::patch('/academic-years/{academicYear}/activate', [AcademicYearController::class, 'activate']);
    Route::post('/academic-years/{academicYear}/promote', [AcademicYearController::class, 'promote']);

    Route::get('/content', [ContentController::class, 'index']);
    Route::post('/content', [ContentController::class, 'store']);
    Route::put('/content/{content}', [ContentController::class, 'update']);
    Route::post('/content/{content}/publish', [ContentController::class, 'publish']);
    Route::post('/content/{content}/rollback', [ContentController::class, 'rollback']);

    Route::get('/announcements', [AdminAnnouncementController::class, 'index']);
    Route::post('/announcements', [AdminAnnouncementController::class, 'store']);
    Route::put('/announcements/{announcement}', [AdminAnnouncementController::class, 'update']);
    Route::delete('/announcements/{announcement}', [AdminAnnouncementController::class, 'destroy']);

    Route::get('/retention/preview', [RetentionController::class, 'preview']);
    Route::post('/retention/run', [RetentionController::class, 'run']);
});

Route::middleware('auth')->group(function () {
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markRead']);
    Route::get('/announcements', [NotificationController::class, 'announcements']);
});

Route::get('/attachments/{attachment}', [AttachmentController::class, 'show'])
    ->middleware('signed')
    ->name('attachments.show');
