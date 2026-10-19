<?php

namespace App\Services;

use App\Models\Alert;
use App\Models\ClassStudent;
use App\Models\CounselorClass;
use App\Models\User;
use App\Notifications\AppNotification;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Throwable;

class NotificationService
{
    /**
     * Kegagalan kanal email (mis. domain Resend belum terverifikasi) tidak boleh
     * membatalkan aksi utama; notifikasi dalam aplikasi tetap tersimpan.
     */
    private function deliver(object $notifiable, AppNotification $notification): void
    {
        $wantsMail = method_exists($notifiable, 'wantsEmailNotifications')
            ? $notifiable->wantsEmailNotifications()
            : true;

        if (! $wantsMail) {
            $notification->sendMail = false;
        }

        try {
            $notifiable->notify($notification);
        } catch (Throwable $e) {
            Log::warning('Notifikasi gagal dikirim.', [
                'notifiable' => $notifiable->id ?? null,
                'type' => $notification->type,
                'error' => $e->getMessage(),
            ]);

            $notification->sendMail = false;
            $notifiable->notify($notification);
        }
    }

    private function broadcast(Collection $recipients, AppNotification $notification): void
    {
        foreach ($recipients as $recipient) {
            $this->deliver($recipient, clone $notification);
        }
    }

    public function alertCreated(Alert $alert): void
    {
        $student = $alert->student;
        $recipients = $this->counselorsForStudent($student);

        if ($alert->severity === 'high') {
            $recipients = $recipients
                ->merge(User::query()->where('role', 'counselor')->where('status', 'active')->get())
                ->unique('id');
        }

        $title = match ($alert->severity) {
            'high' => 'Perlu perhatian segera',
            'medium' => 'Perlu perhatian',
            default => 'Pemantauan siswa',
        };

        $this->broadcast($recipients, new AppNotification(
            $title,
            sprintf('%s — %s', $student->name, $alert->label()),
            'alert',
            '/bk/alert',
            $alert->severity === 'high',
        ));
    }

    public function feedbackReceived(User $student, string $counselorName): void
    {
        $this->deliver($student, new AppNotification(
            'Umpan balik baru',
            sprintf('Refleksimu sudah ditanggapi oleh %s.', $counselorName),
            'feedback',
            '/siswa/refleksi',
            true,
        ));
    }

    public function journalReplyReceived(User $student, string $counselorName): void
    {
        $this->deliver($student, new AppNotification(
            'Balasan baru dari Guru BK',
            sprintf('%s menanggapi curhatmu.', $counselorName),
            'journal_reply',
            '/siswa/jurnal',
            true,
        ));
    }

    public function followUpRequested(User $student, string $excerpt): void
    {
        $recipients = $this->counselorsForStudent($student);

        $this->broadcast($recipients, new AppNotification(
            'Permintaan konseling lanjutan',
            sprintf('%s meminta tindak lanjut: %s', $student->name, $excerpt),
            'follow_up',
            '/bk/siswa/'.$student->id,
            true,
        ));
    }

    public function achievementVerified(User $student, string $title, string $status): void
    {
        $this->deliver($student, new AppNotification(
            'Status prestasi diperbarui',
            sprintf('Prestasi "%s" %s.', $title, $status === 'verified' ? 'telah diverifikasi' : 'ditolak'),
            'achievement',
            '/siswa/portofolio',
        ));
    }

    public function sessionAssigned(User $student, string $topic, string $dueAt): void
    {
        $this->deliver($student, new AppNotification(
            'Refleksi terbimbing baru',
            sprintf('%s — tenggat %s.', $topic, $dueAt),
            'reflection',
            '/siswa/refleksi',
            true,
        ));
    }

    public function digest(User $counselor, array $payload): void
    {
        $lines = [];

        if ($payload['alerts'] > 0) {
            $lines[] = $payload['alerts'].' alert baru';
        }
        if ($payload['pending_reflections'] > 0) {
            $lines[] = $payload['pending_reflections'].' refleksi tertunda';
        }
        if ($payload['inactive'] > 0) {
            $lines[] = $payload['inactive'].' siswa tidak aktif';
        }

        if ($lines === []) {
            return;
        }

        $this->deliver($counselor, new AppNotification(
            'Ringkasan harian BK',
            implode(', ', $lines).'.',
            'digest',
            '/bk/dashboard',
            true,
        ));
    }

    public function reminder(User $student, string $kind): void
    {
        $message = $kind === 'mood'
            ? 'Belum mencatat mood hari ini. Luangkan satu menit.'
            : 'Refleksi pekan ini belum diisi. Ceritakan hal paling berkesan.';

        $this->deliver($student, new AppNotification('Pengingat', $message, 'reminder', $kind === 'mood' ? '/siswa/jurnal' : '/siswa/refleksi'));
    }

    public function counselorsForStudent(User $student): Collection
    {
        $classIds = ClassStudent::query()
            ->where('student_id', $student->id)
            ->where('status', 'active')
            ->pluck('class_id');

        $counselorIds = CounselorClass::query()
            ->whereIn('class_id', $classIds)
            ->pluck('counselor_id')
            ->unique();

        return User::query()
            ->whereIn('id', $counselorIds)
            ->where('role', 'counselor')
            ->where('status', 'active')
            ->get();
    }
}
