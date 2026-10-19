<?php

namespace App\Http\Controllers\Counselor;

use App\Http\Controllers\Controller;
use App\Models\Achievement;
use App\Models\Alert;
use App\Models\ClassStudent;
use App\Models\JournalEntry;
use App\Models\Reflection;
use App\Models\User;
use App\Services\AccessScope;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class CounselorController extends Controller
{
    public function __construct(
        private readonly AccessScope $access,
        private readonly AuditLogger $audit,
    ) {}

    public function dashboard(Request $request)
    {
        $counselor = $request->user();
        $studentIds = $this->access->counselorStudentIds($counselor);
        $classIds = $this->access->counselorClassIds($counselor);

        $classes = \App\Models\SchoolClass::query()
            ->whereIn('id', $classIds)
            ->withCount(['activeMemberships as students_count'])
            ->get()
            ->map(fn ($c) => ['id' => $c->id, 'name' => $c->name, 'students_count' => $c->students_count]);

        $activeStudents = User::query()
            ->whereIn('id', $studentIds)
            ->where('last_activity_at', '>=', now()->subDays(7))
            ->count();

        $pendingReflections = $this->pendingReflectionsCount($studentIds);

        $trend = collect(range(13, 0))->map(function ($daysAgo) use ($studentIds) {
            $date = now()->subDays($daysAgo)->toDateString();

            return [
                'date' => $date,
                'active_students' => JournalEntry::query()
                    ->whereIn('student_id', $studentIds)
                    ->whereDate('entry_date', $date)
                    ->distinct('student_id')
                    ->count('student_id'),
            ];
        });

        return response()->json([
            'success' => true,
            'data' => [
                'classes' => $classes,
                'active_students' => $activeStudents,
                'inactive_students' => max(0, count($studentIds) - $activeStudents),
                'open_alerts' => [
                    'high' => Alert::query()->whereIn('student_id', $studentIds)->where('severity', 'high')->where('status', '!=', 'resolved')->count(),
                    'medium' => Alert::query()->whereIn('student_id', $studentIds)->where('severity', 'medium')->where('status', '!=', 'resolved')->count(),
                    'low' => Alert::query()->whereIn('student_id', $studentIds)->where('severity', 'low')->where('status', '!=', 'resolved')->count(),
                ],
                'pending_reflections' => $pendingReflections,
                'pending_verifications' => Achievement::query()
                    ->whereIn('student_id', $studentIds)
                    ->where('verification_status', 'pending')
                    ->count(),
                'activity_trend' => $trend,
            ],
        ]);
    }

    public function students(Request $request)
    {
        $counselor = $request->user();
        $studentIds = $this->access->counselorStudentIds($counselor);

        $query = User::query()
            ->whereIn('id', $studentIds)
            ->with('profile')
            ->withCount(['alerts as open_alerts_count' => fn ($q) => $q->where('status', '!=', 'resolved')]);

        if ($request->filled('class_id')) {
            $classStudentIds = ClassStudent::query()
                ->where('class_id', $request->integer('class_id'))
                ->where('status', 'active')
                ->pluck('student_id');
            $query->whereIn('id', $classStudentIds);
        }

        if ($request->filled('activity')) {
            $request->query('activity') === 'inactive'
                ? $query->where(fn ($q) => $q->whereNull('last_activity_at')->orWhere('last_activity_at', '<', now()->subDays(7)))
                : $query->where('last_activity_at', '>=', now()->subDays(7));
        }

        if ($request->filled('search')) {
            $search = $request->query('search');
            $query->where(fn ($q) => $q->where('name', 'like', "%{$search}%")->orWhere('identity_number', 'like', "%{$search}%"));
        }

        $students = $query->orderBy('name')->paginate(25);

        return response()->json([
            'success' => true,
            'data' => collect($students->items())->map(function (User $student) {
                $moods = $student->moods()
                    ->where('entry_date', '>=', now()->subDays(7)->toDateString())
                    ->get();

                return [
                    'id' => $student->id,
                    'name' => $student->name,
                    'class' => $student->activeClass() ? [
                        'id' => $student->activeClass()->id,
                        'name' => $student->activeClass()->name,
                    ] : null,
                    'last_activity_at' => $student->last_activity_at?->toIso8601String(),
                    'dominant_mood_7d' => $moods->count() === 0 ? null : $moods->groupBy('valence')->sortDesc()->keys()->first(),
                    'alert_status' => $student->open_alerts_count > 0 ? 'open' : 'clear',
                    'profile_completeness' => $student->profile?->completeness_percent ?? 0,
                ];
            }),
            'meta' => [
                'current_page' => $students->currentPage(),
                'per_page' => $students->perPage(),
                'total' => $students->total(),
                'last_page' => $students->lastPage(),
            ],
        ]);
    }

    public function overview(Request $request, User $student)
    {
        $this->ensureAccess($request, $student);

        $payload = app(\App\Services\ReportService::class)->studentOverview($student);

        return response()->json(['success' => true, 'data' => $payload]);
    }

    public function journals(Request $request, User $student)
    {
        $this->ensureAccess($request, $student);

        $items = JournalEntry::query()
            ->where('student_id', $student->id)
            ->when($request->filled('type'), fn ($q) => $q->where('type', $request->query('type')))
            ->orderByDesc('entry_date')
            ->paginate(20);

        $this->audit->record('journal.viewed', 'journal_entries', null, $student->id);

        return response()->json([
            'success' => true,
            'data' => collect($items->items())->map(fn ($e) => [
                'id' => $e->id,
                'type' => $e->type,
                'entry_date' => $e->entry_date->toDateString(),
                'activating_event' => $e->activating_event,
                'belief' => $e->belief,
                'consequence' => $e->consequence,
                'gratitude_text' => $e->gratitude_text,
                'happiness_text' => $e->happiness_text,
                'is_flagged' => $e->is_flagged,
                'created_at' => $e->created_at?->toIso8601String(),
            ]),
            'meta' => [
                'current_page' => $items->currentPage(),
                'per_page' => $items->perPage(),
                'total' => $items->total(),
                'last_page' => $items->lastPage(),
            ],
        ]);
    }

    public function reflections(Request $request, User $student)
    {
        $this->ensureAccess($request, $student);

        $items = Reflection::query()
            ->where('student_id', $student->id)
            ->with('feedbacks')
            ->orderByDesc('created_at')
            ->get();

        $this->audit->record('reflection.viewed', 'reflections', null, $student->id);

        return response()->json([
            'success' => true,
            'data' => $items->map(fn ($r) => [
                'id' => $r->id,
                'type' => $r->type,
                'week_start' => $r->week_start?->toDateString(),
                'status' => $r->status,
                'has_feedback' => $r->feedbacks->isNotEmpty(),
                'submitted_at' => $r->submitted_at?->toIso8601String(),
            ]),
        ]);
    }

    public function achievements(Request $request, User $student)
    {
        $this->ensureAccess($request, $student);

        $items = Achievement::query()
            ->where('student_id', $student->id)
            ->withCount('attachments')
            ->orderByDesc('achieved_at')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $items->map(fn ($a) => [
                'id' => $a->id,
                'title' => $a->title,
                'category' => $a->category,
                'level' => $a->level,
                'achieved_at' => $a->achieved_at->toDateString(),
                'verification_status' => $a->verification_status,
                'attachments_count' => $a->attachments_count,
                'attachments' => $a->attachments->map(fn ($att) => [
                    'id' => $att->id,
                    'original_name' => $att->original_name,
                    'url' => $att->signedUrl(),
                ])->all(),
            ]),
        ]);
    }

    public function accessLogs(Request $request, User $student)
    {
        $this->ensureAccess($request, $student);

        $logs = \App\Models\AuditLog::query()
            ->where('subject_user_id', $student->id)
            ->orderByDesc('id')
            ->limit(50)
            ->get()
            ->map(fn ($l) => [
                'action' => $l->action,
                'entity_type' => $l->entity_type,
                'entity_id' => $l->entity_id,
                'created_at' => $l->created_at?->toIso8601String(),
            ]);

        return response()->json(['success' => true, 'data' => $logs]);
    }

    public function updatePreferences(Request $request)
    {
        $data = $request->validate([
            'daily_digest_email' => ['boolean'],
            'alert_push' => ['boolean'],
            'digest_hour' => ['integer', 'between:5,10'],
        ]);

        $request->user()->forceFill([
            'notification_channel' => ($data['daily_digest_email'] ?? true) ? 'email_and_in_app' : 'in_app',
            'mood_reminder_hour' => $data['digest_hour'] ?? $request->user()->mood_reminder_hour,
        ])->save();

        return response()->json([
            'success' => true,
            'data' => [
                'daily_digest_email' => $request->user()->notification_channel === 'email_and_in_app',
                'digest_hour' => $request->user()->mood_reminder_hour,
            ],
        ]);
    }

    public function ensureAccess(Request $request, User $student): void
    {
        if (! $this->access->counselorCanAccess($request->user(), $student)) {
            $this->audit->record('access.denied', 'users', $student->id, $student->id);
            abort(response()->json([
                'success' => false,
                'error' => 'FORBIDDEN',
                'message' => 'Anda tidak memiliki akses ke data siswa ini',
            ], 403));
        }
    }

    private function pendingReflectionsCount(array $studentIds): int
    {
        if ($studentIds === []) {
            return 0;
        }

        $classIds = ClassStudent::query()
            ->whereIn('student_id', $studentIds)
            ->where('status', 'active')
            ->pluck('class_id')
            ->unique();

        return \App\Models\ReflectionSession::query()
            ->whereIn('status', ['scheduled', 'ongoing'])
            ->where(function ($query) use ($studentIds, $classIds) {
                $query->whereIn('student_id', $studentIds);

                if ($classIds->isNotEmpty()) {
                    $query->orWhereIn('class_id', $classIds);
                }
            })
            ->whereDoesntHave('reflections', function ($query) use ($studentIds) {
                $query->whereIn('student_id', $studentIds)->whereIn('status', ['submitted', 'late']);
            })
            ->count();
    }
}
