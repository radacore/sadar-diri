<?php

namespace App\Services;

use App\Models\Achievement;
use App\Models\ActionPlan;
use App\Models\Alert;
use App\Models\ClassStudent;
use App\Models\JournalEntry;
use App\Models\MoodEntry;
use App\Models\Reflection;
use App\Models\SchoolClass;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class ReportService
{
    public function classReport(int $classId, Carbon $from, Carbon $to): array
    {
        $class = SchoolClass::findOrFail($classId);
        $studentIds = ClassStudent::query()
            ->where('class_id', $classId)
            ->where('status', 'active')
            ->pluck('student_id')
            ->all();

        $activeStudents = User::query()
            ->whereIn('id', $studentIds)
            ->where('last_activity_at', '>=', $from)
            ->count();

        $moods = MoodEntry::query()
            ->whereIn('student_id', $studentIds)
            ->whereBetween('entry_date', [$from->toDateString(), $to->toDateString()])
            ->selectRaw('valence, count(*) as total')
            ->groupBy('valence')
            ->pluck('total', 'valence');

        $alerts = Alert::query()
            ->whereIn('student_id', $studentIds)
            ->whereBetween('detected_at', [$from, $to]);

        $resolved = (clone $alerts)->where('status', 'resolved');
        $avgResponse = (clone $resolved)
            ->whereNotNull('handled_at')
            ->selectRaw('avg(timestampdiff(hour, detected_at, handled_at)) as hours')
            ->value('hours');

        return [
            'class' => ['id' => $class->id, 'name' => $class->name],
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'activity' => [
                'active_students' => $activeStudents,
                'inactive_students' => max(0, count($studentIds) - $activeStudents),
            ],
            'mood' => [
                'positive_days' => (int) ($moods['positive'] ?? 0),
                'negative_days' => (int) ($moods['negative'] ?? 0),
            ],
            'reflections_submitted' => Reflection::query()
                ->whereIn('student_id', $studentIds)
                ->whereBetween('submitted_at', [$from, $to])
                ->count(),
            'achievements_verified' => Achievement::query()
                ->whereIn('student_id', $studentIds)
                ->where('verification_status', 'verified')
                ->whereBetween('verified_at', [$from, $to])
                ->count(),
            'alerts' => [
                'total' => (clone $alerts)->count(),
                'resolved' => (clone $alerts)->where('status', 'resolved')->count(),
                'open' => (clone $alerts)->where('status', '!=', 'resolved')->count(),
            ],
            'follow_ups' => [
                'average_response_hours' => $avgResponse ? round((float) $avgResponse, 1) : null,
            ],
        ];
    }

    public function aggregate(array $filters = []): array
    {
        $from = Carbon::parse($filters['from'] ?? now()->subDays(30)->toDateString())->startOfDay();
        $to = Carbon::parse($filters['to'] ?? now()->toDateString())->endOfDay();

        $classes = SchoolClass::query()
            ->when($filters['class_id'] ?? null, fn ($q, $id) => $q->where('id', $id))
            ->where('is_active', true)
            ->withCount(['activeMemberships as students_count'])
            ->get();

        $groups = [];
        $suppressed = [];

        foreach ($classes as $class) {
            $studentIds = ClassStudent::query()
                ->where('class_id', $class->id)
                ->where('status', 'active')
                ->pluck('student_id')
                ->all();

            if (count($studentIds) < 10) {
                $suppressed[] = ['class_id' => $class->id, 'class_name' => $class->name, 'reason' => 'Kurang dari 10 siswa'];

                continue;
            }

            $moods = MoodEntry::query()
                ->whereIn('student_id', $studentIds)
                ->whereBetween('entry_date', [$from->toDateString(), $to->toDateString()])
                ->selectRaw('valence, count(*) as total')
                ->groupBy('valence')
                ->pluck('total', 'valence');

            $positive = (int) ($moods['positive'] ?? 0);
            $negative = (int) ($moods['negative'] ?? 0);
            $total = max(1, $positive + $negative);

            $active = User::query()
                ->whereIn('id', $studentIds)
                ->where('last_activity_at', '>=', $from)
                ->count();

            $profileComplete = User::query()
                ->whereIn('id', $studentIds)
                ->whereHas('profile', fn ($q) => $q->where('completeness_percent', '>=', 80))
                ->count();

            $moodUsers = MoodEntry::query()
                ->whereIn('student_id', $studentIds)
                ->whereBetween('entry_date', [$from->toDateString(), $to->toDateString()])
                ->distinct('student_id')
                ->count('student_id');

            $reflectionUsers = Reflection::query()
                ->whereIn('student_id', $studentIds)
                ->whereBetween('submitted_at', [$from, $to])
                ->distinct('student_id')
                ->count('student_id');

            $groups[] = [
                'class_id' => $class->id,
                'class_name' => $class->name,
                'students_count' => count($studentIds),
                'active_students' => $active,
                'mood_distribution' => [
                    'positive' => (int) round($positive / $total * 100),
                    'negative' => (int) round($negative / $total * 100),
                ],
                'feature_completion' => [
                    'profile' => (int) round($profileComplete / max(1, count($studentIds)) * 100),
                    'mood' => (int) round($moodUsers / max(1, count($studentIds)) * 100),
                    'reflection' => (int) round($reflectionUsers / max(1, count($studentIds)) * 100),
                ],
                'alerts_open' => Alert::query()
                    ->whereIn('student_id', $studentIds)
                    ->where('status', '!=', 'resolved')
                    ->count(),
            ];
        }

        return [
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'groups' => $groups,
            'suppressed_groups' => $suppressed,
        ];
    }

    public function dashboardCounters(): array
    {
        return [
            'students' => [
                'active' => User::query()->where('role', 'student')->where('status', 'active')->count(),
                'inactive' => User::query()->where('role', 'student')->where('status', 'inactive')->count(),
                'pending_activation' => User::query()->where('role', 'student')->where('status', 'pending')->count(),
            ],
            'counselors' => [
                'active' => User::query()->where('role', 'counselor')->where('status', 'active')->count(),
                'without_class' => User::query()
                    ->where('role', 'counselor')
                    ->whereDoesntHave('counselorAssignments')
                    ->count(),
            ],
            'feature_usage' => [
                'mood_entries_30d' => MoodEntry::query()->where('entry_date', '>=', now()->subDays(30))->count(),
                'journals_30d' => JournalEntry::query()->where('created_at', '>=', now()->subDays(30))->count(),
                'reflections_30d' => Reflection::query()->where('created_at', '>=', now()->subDays(30))->count(),
                'achievements_30d' => Achievement::query()->where('created_at', '>=', now()->subDays(30))->count(),
            ],
            'alerts' => [
                'open' => Alert::query()->where('status', '!=', 'resolved')->count(),
                'high' => Alert::query()->where('severity', 'high')->where('status', '!=', 'resolved')->count(),
                'avg_response_hours' => round((float) (Alert::query()
                    ->whereNotNull('handled_at')
                    ->selectRaw('avg(timestampdiff(hour, detected_at, handled_at)) as h')
                    ->value('h') ?? 0), 1),
            ],
            'storage' => [
                'used_gb' => round(\App\Models\Attachment::query()->sum('size_bytes') / 1073741824, 2),
                'quota_gb' => 80,
            ],
        ];
    }

    public function studentOverview(User $student): array
    {
        $moods = MoodEntry::query()
            ->where('student_id', $student->id)
            ->where('entry_date', '>=', now()->subDays(7)->toDateString())
            ->get();

        $profile = $student->profile;

        return [
            'student' => [
                'id' => $student->id,
                'name' => $student->name,
                'identity_number' => $student->identity_number,
                'class' => $student->activeClass() ? [
                    'id' => $student->activeClass()->id,
                    'name' => $student->activeClass()->name,
                ] : null,
            ],
            'profile' => [
                'completeness_percent' => $profile?->completeness_percent ?? 0,
                'biodata' => [
                    'birth_date' => $profile?->birth_date?->toDateString(),
                    'gender' => $profile?->gender,
                    'address' => $profile?->address,
                    'phone' => $profile?->phone,
                    'height_cm' => $profile?->height_cm,
                    'weight_kg' => $profile?->weight_kg,
                    'blood_type' => $profile?->blood_type,
                    'medical_history' => $profile?->medical_history,
                    'health_notes' => $profile?->health_notes,
                    'extra_fields' => $profile?->extra_fields ?? [],
                ],
                'self_profile' => [
                    'psychological_summary' => $profile?->psychological_summary,
                    'character_summary' => $profile?->character_summary,
                    'strengths' => $profile?->strengths,
                    'weaknesses' => $profile?->weaknesses,
                    'version' => $profile?->version,
                ],
                'psychological_summary' => $profile?->psychological_summary,
                'strengths' => $profile?->strengths,
                'weaknesses' => $profile?->weaknesses,
                'published_at' => $profile?->published_at?->toIso8601String(),
            ],
            'activity' => [
                'last_activity_at' => $student->last_activity_at?->toIso8601String(),
                'journal_streak_days' => $this->journalStreak($student),
                'mood_7d' => [
                    'positive_days' => $moods->where('valence', 'positive')->count(),
                    'negative_days' => $moods->where('valence', 'negative')->count(),
                ],
            ],
            'portfolio' => [
                'total' => Achievement::query()->where('student_id', $student->id)->count(),
                'verified' => Achievement::query()->where('student_id', $student->id)->where('verification_status', 'verified')->count(),
                'pending' => Achievement::query()->where('student_id', $student->id)->where('verification_status', 'pending')->count(),
            ],
            'reflections' => [
                'submitted' => Reflection::query()->where('student_id', $student->id)->where('status', '!=', 'draft')->count(),
                'pending' => $this->pendingReflections($student),
            ],
            'action_plan' => [
                'active_targets' => ActionPlan::query()
                    ->where('student_id', $student->id)
                    ->where('status', 'active')
                    ->withCount('targets')
                    ->get()
                    ->sum('targets_count'),
                'achieved' => \App\Models\ActionTarget::query()
                    ->whereHas('plan', fn ($q) => $q->where('student_id', $student->id))
                    ->where('status', 'achieved')
                    ->count(),
            ],
            'open_alerts' => Alert::query()
                ->where('student_id', $student->id)
                ->where('status', '!=', 'resolved')
                ->count(),
        ];
    }

    public function journalStreak(User $student): int
    {
        $dates = JournalEntry::query()
            ->where('student_id', $student->id)
            ->where('status', 'published')
            ->orderByDesc('entry_date')
            ->pluck('entry_date')
            ->map(fn ($d) => Carbon::parse($d)->toDateString())
            ->unique()
            ->values();

        $streak = 0;
        $cursor = now()->startOfDay();

        foreach ($dates as $date) {
            if ($date === $cursor->toDateString()) {
                $streak++;
                $cursor->subDay();
            } elseif ($date === $cursor->copy()->subDay()->toDateString() && $streak === 0) {
                $streak++;
                $cursor = $cursor->subDay()->subDay();
            } else {
                break;
            }
        }

        return $streak;
    }

    public function pendingReflections(User $student): int
    {
        $classIds = ClassStudent::query()
            ->where('student_id', $student->id)
            ->where('status', 'active')
            ->pluck('class_id')
            ->all();

        return \App\Models\ReflectionSession::query()
            ->whereIn('status', ['scheduled', 'ongoing'])
            ->where(function ($q) use ($student, $classIds) {
                $q->where('student_id', $student->id);
                if ($classIds !== []) {
                    $q->orWhereIn('class_id', $classIds);
                }
            })
            ->whereDoesntHave('reflections', function ($q) use ($student) {
                $q->where('student_id', $student->id)->whereIn('status', ['submitted', 'late']);
            })
            ->count();
    }

    public function monthlySnapshot(User $student, Carbon $start, Carbon $end): array
    {
        $moods = MoodEntry::query()
            ->where('student_id', $student->id)
            ->whereBetween('entry_date', [$start->toDateString(), $end->toDateString()])
            ->get();

        $journals = JournalEntry::query()
            ->where('student_id', $student->id)
            ->whereBetween('entry_date', [$start->toDateString(), $end->toDateString()])
            ->selectRaw('type, count(*) as total')
            ->groupBy('type')
            ->pluck('total', 'type');

        $targets = \App\Models\ActionTarget::query()
            ->whereHas('plan', fn ($q) => $q->where('student_id', $student->id)->whereDate('period_start', $start))
            ->get();

        return [
            'mood' => [
                'positive_days' => $moods->where('valence', 'positive')->count(),
                'negative_days' => $moods->where('valence', 'negative')->count(),
            ],
            'journals' => [
                'abc' => (int) ($journals['abc'] ?? 0),
                'grateful' => (int) ($journals['grateful'] ?? 0),
            ],
            'reflections' => Reflection::query()
                ->where('student_id', $student->id)
                ->whereBetween('submitted_at', [$start, $end])
                ->count(),
            'new_achievements' => Achievement::query()
                ->where('student_id', $student->id)
                ->whereBetween('created_at', [$start, $end])
                ->count(),
            'targets_achieved' => $targets->where('status', 'achieved')->count(),
            'targets_total' => $targets->count(),
        ];
    }
}
