<?php

namespace App\Http\Controllers\Counselor;

use App\Http\Controllers\Controller;
use App\Models\Achievement;
use App\Models\Alert;
use App\Models\ClassStudent;
use App\Models\JournalEntry;
use App\Models\StudentProfile;
use App\Models\StudentProfileVersion;
use App\Models\Reflection;
use App\Models\User;
use App\Services\AccessScope;
use App\Services\AuditLogger;
use App\Services\NotificationService;
use App\Services\SettingsService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class CounselorController extends Controller
{
    public function __construct(
        private readonly AccessScope $access,
        private readonly AuditLogger $audit,
        private readonly NotificationService $notifications,
        private readonly SettingsService $settings,
    ) {}

    private function currentWeekStart(): string
    {
        $timezone = $this->settings->get('school.timezone') ?: config('app.timezone');

        return Carbon::now($timezone)->startOfWeek(Carbon::MONDAY)->toDateString();
    }

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
        $weekStart = $this->currentWeekStart();
        $weeklyDone = $studentIds === [] ? collect() : Reflection::query()
            ->whereIn('student_id', $studentIds)
            ->where('type', 'self')
            ->whereDate('week_start', $weekStart)
            ->where('status', 'submitted')
            ->pluck('student_id')
            ->unique();

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
                'weekly_reflection' => [
                    'week_start' => $weekStart,
                    'done' => $weeklyDone->count(),
                    'missing' => max(0, count($studentIds) - $weeklyDone->count()),
                ],
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

        if ($request->query('reflection') === 'missing') {
            $done = Reflection::query()
                ->whereIn('student_id', $studentIds)
                ->where('type', 'self')
                ->whereDate('week_start', $this->currentWeekStart())
                ->where('status', 'submitted')
                ->pluck('student_id');
            $query->whereNotIn('id', $done);
        }

        if ($request->filled('search')) {
            $search = $request->query('search');
            $query->where(fn ($q) => $q->where('name', 'like', "%{$search}%")->orWhere('identity_number', 'like', "%{$search}%"));
        }

        $students = $query->orderBy('name')->paginate(25);
        $weeklyDone = Reflection::query()
            ->whereIn('student_id', collect($students->items())->pluck('id'))
            ->where('type', 'self')
            ->whereDate('week_start', $this->currentWeekStart())
            ->where('status', 'submitted')
            ->pluck('student_id')
            ->unique();

        return response()->json([
            'success' => true,
            'data' => collect($students->items())->map(function (User $student) use ($weeklyDone) {
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
                    'weekly_reflection_done' => $weeklyDone->contains($student->id),
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
            ->with(['replies.counselor'])
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
                'follow_up_requested' => $e->follow_up_requested,
                'created_at' => $e->created_at?->toIso8601String(),
                'replies' => $e->replies->map(fn ($r) => [
                    'id' => $r->id,
                    'content' => $r->content,
                    'counselor_name' => $r->counselor?->name,
                    'created_at' => $r->created_at?->toIso8601String(),
                ])->values(),
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

    public function replyToJournal(Request $request, JournalEntry $journal)
    {
        $student = $journal->student;

        abort_unless($student && $this->access->counselorCanAccess($request->user(), $student), 403);

        $data = $request->validate([
            'content' => ['required', 'string', 'max:5000'],
        ]);

        $reply = $journal->replies()->create([
            'counselor_id' => $request->user()->id,
            'content' => $data['content'],
        ]);

        $this->notifications->journalReplyReceived($student, $request->user()->name);
        $this->audit->record('journal.replied', 'journal_entries', $journal->id, $student->id);

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $reply->id,
                'content' => $reply->content,
                'counselor_name' => $request->user()->name,
                'created_at' => $reply->created_at?->toIso8601String(),
            ],
            'message' => 'Balasan terkirim ke siswa',
        ], 201);
    }

    public function updateBiodata(Request $request, User $student)
    {
        $this->ensureAccess($request, $student);

        $data = $request->validate([
            'birth_date' => ['nullable', 'date', 'before:today'],
            'gender' => ['nullable', 'in:male,female'],
            'address' => ['nullable', 'string', 'max:500'],
            'phone' => ['nullable', 'string', 'max:20'],
            'height_cm' => ['nullable', 'integer', 'between:100,250'],
            'weight_kg' => ['nullable', 'integer', 'between:25,250'],
            'blood_type' => ['nullable', 'string', 'max:3'],
            'medical_history' => ['nullable', 'string', 'max:2000'],
            'health_notes' => ['nullable', 'string', 'max:2000'],
            'extra_fields' => ['nullable', 'array', 'max:5'],
            'extra_fields.*.label' => ['nullable', 'string', 'max:60'],
            'extra_fields.*.value' => ['nullable', 'string', 'max:500'],
            ...StudentProfile::IDENTITY_RULES,
        ]);

        $data = StudentProfile::normalizeIdentity($data);

        if (array_key_exists('extra_fields', $data)) {
            $data['extra_fields'] = collect($data['extra_fields'] ?? [])
                ->filter(fn ($row) => filled($row['label'] ?? null) && filled($row['value'] ?? null))
                ->map(fn ($row) => ['label' => trim($row['label']), 'value' => trim($row['value'])])
                ->values()->all();
        }

        $profile = StudentProfile::firstOrCreate(['user_id' => $student->id]);
        $profile->fill($data);
        $profile->completeness_percent = $profile->completeness();
        $profile->save();

        $this->audit->record('profile.biodata_updated_by_counselor', 'student_profiles', $profile->id, $student->id);

        return response()->json([
            'success' => true,
            'data' => ['completeness_percent' => $profile->completeness_percent],
            'message' => 'Biodata siswa diperbarui',
        ]);
    }

    public function updateSelfProfile(Request $request, User $student)
    {
        $this->ensureAccess($request, $student);

        $data = $request->validate([
            'psychological_summary' => ['nullable', 'string', 'max:5000'],
            'character_summary' => ['nullable', 'string', 'max:5000'],
            'strengths' => ['nullable', 'string', 'max:5000'],
            'weaknesses' => ['nullable', 'string', 'max:5000'],
        ]);

        $profile = StudentProfile::firstOrCreate(['user_id' => $student->id]);
        $profile->fill($data);
        $profile->version = $profile->version + 1;
        $profile->completeness_percent = $profile->completeness();
        $profile->save();

        StudentProfileVersion::create([
            'student_profile_id' => $profile->id,
            'version' => $profile->version,
            'snapshot' => $profile->only([
                'psychological_summary', 'character_summary', 'strengths', 'weaknesses', 'published_at',
            ]),
            'created_by' => $request->user()->id,
            'created_at' => now(),
        ]);

        $this->audit->record('profile.self_updated_by_counselor', 'student_profiles', $profile->id, $student->id);

        return response()->json([
            'success' => true,
            'data' => ['version' => $profile->version],
            'message' => 'Profil diri siswa diperbarui',
        ]);
    }

    public function storeAchievement(Request $request, User $student)
    {
        $this->ensureAccess($request, $student);

        $data = $request->validate([
            'category' => ['required', \Illuminate\Validation\Rule::in(['academic', 'non_academic', 'competition', 'soft_skill'])],
            'title' => ['required', 'string', 'max:190'],
            'organizer' => ['nullable', 'string', 'max:190'],
            'level' => ['nullable', \Illuminate\Validation\Rule::in(['school', 'district', 'city', 'province', 'national', 'international'])],
            'achieved_at' => ['required', 'date', 'before_or_equal:today'],
            'rank' => ['nullable', 'string', 'max:50'],
            'description' => ['nullable', 'string', 'max:2000'],
        ]);

        $achievement = Achievement::create($data + [
            'student_id' => $student->id,
            'created_by' => $request->user()->id,
            'verification_status' => 'verified',
            'verified_by' => $request->user()->id,
            'verified_at' => now(),
        ]);

        $this->notifications->achievementVerified($student, $achievement->title, 'verified');
        $this->audit->record('achievement.created_by_counselor', 'achievements', $achievement->id, $student->id);

        return response()->json([
            'success' => true,
            'data' => ['id' => $achievement->id, 'verification_status' => $achievement->verification_status],
            'message' => 'Prestasi ditambahkan untuk siswa',
        ], 201);
    }

    public function actionPlan(Request $request, User $student)
    {
        $this->ensureAccess($request, $student);

        $plan = $student->actionPlans()
            ->where('status', 'active')
            ->with(['targets' => fn ($q) => $q->orderBy('sort_order'), 'targets.steps', 'evaluation'])
            ->latest('period_start')
            ->first();

        $future = $student->futurePlan;

        return response()->json([
            'success' => true,
            'data' => [
                'plan' => $plan ? [
                    'id' => $plan->id,
                    'period_start' => $plan->period_start?->toDateString(),
                    'period_end' => $plan->period_end?->toDateString(),
                    'targets' => $plan->targets->map(fn ($t) => [
                        'id' => $t->id,
                        'title' => $t->title,
                        'success_indicator' => $t->success_indicator,
                        'basis' => $t->basis ?? 'general',
                        'status' => $t->status,
                        'progress_note' => $t->progress_note,
                        'steps' => $t->steps->map(fn ($step) => [
                            'id' => $step->id,
                            'title' => $step->title,
                            'is_done' => $step->is_done,
                        ])->values(),
                    ])->values(),
                    'evaluation' => $plan->evaluation ? [
                        'evaluation_text' => $plan->evaluation->evaluation_text,
                        'improvement_text' => $plan->evaluation->improvement_text,
                    ] : null,
                ] : null,
                'future_plan' => $future ? [
                    'dream' => $future->dream,
                    'career_plan' => $future->career_plan,
                    'education_plan' => $future->education_plan,
                    'concrete_targets' => $future->concrete_targets,
                ] : null,
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
