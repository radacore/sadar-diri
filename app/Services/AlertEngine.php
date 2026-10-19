<?php

namespace App\Services;

use App\Models\Alert;
use App\Models\ClassStudent;
use App\Models\MoodEntry;
use App\Models\Reflection;
use App\Models\ReflectionSession;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class AlertEngine
{
    public const RISK_KEYWORDS = [
        'menyakiti diri', 'bunuh diri', 'ingin mati', 'tidak ingin hidup',
        'mengakhiri hidup', 'self harm', 'melukai diri', 'putus asa',
    ];

    public function __construct(
        private readonly AccessScope $access,
        private readonly NotificationService $notifications,
    ) {}

    public function evaluateFor(User $student): array
    {
        $created = [];

        $created = array_merge($created, $this->evaluateMoodStreak($student));
        $created = array_merge($created, $this->evaluateRiskKeywords($student));
        $created = array_merge($created, $this->evaluateInactivity($student));
        $created = array_merge($created, $this->evaluateOverdueReflections($student));

        return $created;
    }

    public function evaluateAll(): int
    {
        $count = 0;

        User::query()->where('role', 'student')->where('status', 'active')->chunkById(100, function ($students) use (&$count) {
            foreach ($students as $student) {
                $count += count($this->evaluateFor($student));
            }
        });

        return $count;
    }

    private function evaluateMoodStreak(User $student): array
    {
        $entries = MoodEntry::query()
            ->where('student_id', $student->id)
            ->where('entry_date', '>=', now()->subDays(10)->toDateString())
            ->orderByDesc('entry_date')
            ->get();

        if ($entries->count() < 3) {
            return [];
        }

        $streak = 0;
        $cursor = now()->startOfDay();
        $last = null;

        foreach ($entries as $entry) {
            if ($entry->entry_date->toDateString() !== $cursor->toDateString()) {
                break;
            }

            if ($entry->valence !== 'negative' || $entry->intensity < 4) {
                break;
            }

            $streak++;
            $last = $entry;
            $cursor->subDay();
        }

        if ($streak < 3) {
            return [];
        }

        $severity = $last && $last->intensity >= 5 ? 'high' : 'medium';

        return [$this->createAlert(
            $student,
            'mood_low_streak',
            $severity,
            ['streak_days' => $streak, 'last_intensity' => $last?->intensity],
        )];
    }

    private function evaluateRiskKeywords(User $student): array
    {
        $entries = $student->journals()
            ->where('created_at', '>=', now()->subDays(3))
            ->where('is_flagged', false)
            ->get();

        foreach ($entries as $entry) {
            $text = mb_strtolower(implode(' ', array_filter([
                $entry->activating_event,
                $entry->belief,
                $entry->consequence,
                $entry->gratitude_text,
                $entry->happiness_text,
            ])));

            foreach (self::RISK_KEYWORDS as $keyword) {
                if (str_contains($text, $keyword)) {
                    $entry->update(['is_flagged' => true, 'flagged_at' => now()]);

                    return [$this->createAlert(
                        $student,
                        'risk_keyword',
                        'high',
                        ['entry_id' => $entry->id, 'keyword' => $keyword],
                    )];
                }
            }
        }

        return [];
    }

    private function evaluateInactivity(User $student): array
    {
        if (! $student->last_activity_at) {
            return [];
        }

        if ($student->last_activity_at->gt(now()->subDays(14))) {
            return [];
        }

        return [$this->createAlert($student, 'inactivity', 'low', [
            'last_activity_at' => $student->last_activity_at->toIso8601String(),
        ])];
    }

    private function evaluateOverdueReflections(User $student): array
    {
        $classIds = ClassStudent::query()
            ->where('student_id', $student->id)
            ->where('status', 'active')
            ->pluck('class_id')
            ->all();

        $sessions = ReflectionSession::query()
            ->where('due_at', '<', now())
            ->whereIn('status', ['scheduled', 'ongoing'])
            ->where(function ($query) use ($student, $classIds) {
                $query->where('student_id', $student->id);

                if ($classIds !== []) {
                    $query->orWhereIn('class_id', $classIds);
                }
            })
            ->get();

        $created = [];

        foreach ($sessions as $session) {
            $submitted = Reflection::query()
                ->where('student_id', $student->id)
                ->where('session_id', $session->id)
                ->whereIn('status', ['submitted', 'late'])
                ->exists();

            if ($submitted) {
                continue;
            }

            $created[] = $this->createAlert(
                $student,
                'reflection_overdue',
                'medium',
                ['session_id' => $session->id, 'topic' => $session->topic],
            );
        }

        return $created;
    }

    private function createAlert(User $student, string $type, string $severity, array $context = []): Alert
    {
        $dedupe = sprintf('%d:%s:%s', $student->id, $type, now()->toDateString());

        $alert = Alert::firstOrCreate(
            ['dedupe_key' => $dedupe],
            [
                'student_id' => $student->id,
                'trigger_type' => $type,
                'severity' => $severity,
                'status' => 'new',
                'detected_at' => now(),
            ],
        );

        if ($alert->wasRecentlyCreated) {
            $alert->setAttribute('context', $context);
            $this->notifications->alertCreated($alert);
            $this->audit($alert);
        }

        return $alert;
    }

    private function audit(Alert $alert): void
    {
        DB::table('audit_logs')->insert([
            'actor_id' => null,
            'action' => 'alert.created',
            'entity_type' => 'alerts',
            'entity_id' => $alert->id,
            'subject_user_id' => $alert->student_id,
            'reason' => null,
            'ip_address' => null,
            'user_agent' => 'alert-engine',
            'metadata' => json_encode(['trigger_type' => $alert->trigger_type, 'severity' => $alert->severity]),
            'created_at' => now(),
        ]);
    }
}
