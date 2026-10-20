<?php

use App\Models\MoodEntry;
use App\Models\ReflectionSession;
use App\Models\User;
use App\Services\AlertEngine;
use App\Services\NotificationService;
use App\Services\SettingsService;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('sadar:alerts', function () {
    $count = app(AlertEngine::class)->evaluateAll();
    $this->info("Evaluasi selesai. {$count} alert baru.");
})->purpose('Evaluasi aturan alert untuk seluruh siswa');

Artisan::command('sadar:digest', function () {
    $notifications = app(NotificationService::class);

    User::query()->where('role', 'counselor')->where('status', 'active')->each(function (User $counselor) use ($notifications) {
        $studentIds = \App\Models\ClassStudent::query()
            ->whereIn('class_id', $counselor->counselorAssignments()->pluck('class_id'))
            ->where('status', 'active')
            ->pluck('student_id');

        $pendingReflections = \App\Models\ReflectionSession::query()
            ->whereIn('status', ['scheduled', 'ongoing'])
            ->whereIn('class_id', $counselor->counselorAssignments()->pluck('class_id'))
            ->whereDoesntHave('reflections', fn ($q) => $q->whereIn('student_id', $studentIds)->whereIn('status', ['submitted', 'late']))
            ->count();

        $notifications->digest($counselor, [
            'alerts' => \App\Models\Alert::query()->whereIn('student_id', $studentIds)->where('status', 'new')->count(),
            'pending_reflections' => $pendingReflections,
            'inactive' => User::query()->whereIn('id', $studentIds)->where(fn ($q) => $q->whereNull('last_activity_at')->orWhere('last_activity_at', '<', now()->subDays(7)))->count(),
        ]);
    });

    $this->info('Ringkasan harian dikirim.');
})->purpose('Kirim ringkasan harian ke Guru BK');

Artisan::command('sadar:reminders', function () {
    $hour = (int) now()->format('G');
    $notifications = app(NotificationService::class);

    User::query()
        ->where('role', 'student')
        ->where('status', 'active')
        ->where('mood_reminder_enabled', true)
        ->where('mood_reminder_hour', $hour)
        ->each(function (User $student) use ($notifications) {
            $hasMood = MoodEntry::query()->where('student_id', $student->id)->whereDate('entry_date', today())->exists();

            if (! $hasMood) {
                $notifications->reminder($student, 'mood');
            }
        });

    $this->info('Pengingat diproses.');
})->purpose('Kirim pengingat mood sesuai preferensi siswa');

Artisan::command('sadar:announcements', function () {
    $count = \App\Models\Announcement::query()
        ->where('status', 'scheduled')
        ->where('published_at', '<=', now())
        ->update(['status' => 'published']);

    $this->info("{$count} pengumuman diterbitkan.");
})->purpose('Terbitkan pengumuman yang jadwalnya sudah lewat');

Artisan::command('sadar:overdue', function () {
    ReflectionSession::query()
        ->whereIn('status', ['scheduled', 'ongoing'])
        ->where('due_at', '<', now())
        ->update(['status' => 'completed']);

    $count = app(AlertEngine::class)->evaluateAll();
    $this->info("Sesi lewat tenggat ditandai. {$count} alert baru.");
})->purpose('Tandai sesi refleksi lewat tenggat dan evaluasi alert');

Schedule::command('sadar:alerts')->dailyAt('00:10');
Schedule::command('sadar:announcements')->everyMinute();
Schedule::command('sadar:overdue')->hourly();
Schedule::command('sadar:reminders')->hourly();
Schedule::command('sadar:digest')->dailyAt('07:00');
