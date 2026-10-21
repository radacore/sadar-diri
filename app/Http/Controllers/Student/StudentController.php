<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\Achievement;
use App\Models\ActionPlan;
use App\Models\AuditLog;
use App\Models\CounselingNote;
use App\Models\JournalEntry;
use App\Models\MoodEntry;
use App\Models\Reflection;
use App\Models\StudentProfile;
use App\Models\StudentProfileVersion;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\ReportService;
use App\Services\SettingsService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class StudentController extends Controller
{
    public function __construct(
        private readonly ReportService $reports,
        private readonly AuditLogger $audit,
        private readonly SettingsService $settings,
    ) {}

    /**
     * Satu siswa didampingi satu Guru BK, jadi tombol Curhat memakai nomor
     * Guru BK kelasnya. Nomor layanan sekolah hanya dipakai sebagai cadangan
     * bila Guru BK belum mengisi nomor.
     */
    private function counselorFor(User $student): ?User
    {
        $classIds = \App\Models\ClassStudent::query()
            ->where('student_id', $student->id)
            ->where('status', 'active')
            ->pluck('class_id');

        if ($classIds->isEmpty()) {
            return null;
        }

        $counselorIds = \App\Models\CounselorClass::query()
            ->whereIn('class_id', $classIds)
            ->pluck('counselor_id')
            ->unique();

        return User::query()
            ->whereIn('id', $counselorIds)
            ->where('role', 'counselor')
            ->where('status', 'active')
            ->orderBy('name')
            ->first();
    }

    public function dashboard(Request $request)
    {
        $user = $request->user();
        $today = now()->toDateString();

        $mood = MoodEntry::query()->where('student_id', $user->id)->where('entry_date', $today)->first();

        $lastJournal = JournalEntry::query()
            ->where('student_id', $user->id)
            ->orderByDesc('entry_date')
            ->first();

        $activePlan = ActionPlan::query()
            ->where('student_id', $user->id)
            ->where('status', 'active')
            ->with('targets')
            ->latest('period_start')
            ->first();

        return response()->json([
            'success' => true,
            'data' => [
                'today_mood' => $mood ? [
                    'entry_date' => $mood->entry_date->toDateString(),
                    'valence' => $mood->valence,
                    'intensity' => $mood->intensity,
                    'emotion_tags' => $mood->emotion_tags,
                    'note' => $mood->note,
                ] : null,
                'journal_streak_days' => $this->reports->journalStreak($user),
                'active_targets' => $activePlan?->targets->count() ?? 0,
                'targets' => $activePlan?->targets->map(fn ($t) => [
                    'id' => $t->id,
                    'title' => $t->title,
                    'status' => $t->status,
                    'success_indicator' => $t->success_indicator,
                ])->all() ?? [],
                'reflection_due' => $this->reports->pendingReflections($user) > 0,
                'weekly_reflection' => $this->weeklyReflection($user),
                'last_journal' => $lastJournal ? [
                    'id' => $lastJournal->id,
                    'type' => $lastJournal->type,
                    'entry_date' => $lastJournal->entry_date->toDateString(),
                    'excerpt' => $lastJournal->excerpt(90),
                ] : null,
                'mood_7d' => $this->moodSummary($user, 7),
            ],
        ]);
    }

    private function weeklyReflection(User $user): array
    {
        $timezone = $this->settings->get('school.timezone') ?: config('app.timezone');
        $weekStart = \Illuminate\Support\Carbon::now($timezone)->startOfWeek(\Illuminate\Support\Carbon::MONDAY)->toDateString();

        $reflection = \App\Models\Reflection::query()
            ->where('student_id', $user->id)
            ->where('type', 'self')
            ->whereDate('week_start', $weekStart)
            ->first();

        $submitted = in_array($reflection?->status, ['submitted', 'late'], true);

        return [
            'week_start' => $weekStart,
            'submitted' => $submitted,
            'mandatory' => in_array(\Illuminate\Support\Carbon::now($timezone)->dayOfWeek, [0, 5, 6], true),
            'done' => $submitted,
            'id' => $reflection?->id,
            'gratitude_text' => $reflection?->gratitude_text,
            'positive_experience' => $reflection?->positive_experience,
            'negative_experience' => $reflection?->negative_experience,
        ];
    }

    public function profile(Request $request)
    {
        $user = $request->user();
        $profile = StudentProfile::firstOrCreate(['user_id' => $user->id]);
        $class = $user->activeClass();

        return response()->json([
            'success' => true,
            'data' => [
                'class' => $class ? [
                    'name' => $class->name,
                    'level' => $class->level,
                    'academic_year' => $class->academicYear?->name,
                    'homeroom_teacher_name' => $class->homeroom_teacher_name,
                ] : null,
                'biodata' => [
                    'birth_date' => $profile->birth_date?->toDateString(),
                    'birth_place' => $profile->birth_place,
                    'religion' => $profile->religion,
                    'family_status' => $profile->family_status,
                    'nisn' => $profile->nisn,
                    'birth_order' => $profile->birth_order,
                    'previous_school' => $profile->previous_school,
                    'admission_class' => $profile->admission_class,
                    'admission_date' => $profile->admission_date?->toDateString(),
                    'gender' => $profile->gender,
                    'address' => $profile->address,
                    'phone' => $profile->phone,
                    'nik' => $profile->nik,
                    'father_phone' => $profile->father_phone,
                    'mother_phone' => $profile->mother_phone,
                    'father_name' => $profile->father_name,
                    'mother_name' => $profile->mother_name,
                    'parent_address' => $profile->parent_address,
                    'father_occupation' => $profile->father_occupation,
                    'mother_occupation' => $profile->mother_occupation,
                    'guardian_name' => $profile->guardian_name,
                    'guardian_phone' => $profile->guardian_phone,
                    'guardian_address' => $profile->guardian_address,
                    'guardian_occupation' => $profile->guardian_occupation,
                    'social_media' => $profile->social_media ?? [],
                    'height_cm' => $profile->height_cm,
                    'weight_kg' => $profile->weight_kg,
                    'blood_type' => $profile->blood_type,
                    'medical_history' => $profile->medical_history,
                    'health_notes' => $profile->health_notes,
                    'extra_fields' => $profile->extra_fields ?? [],
                ],
                'self_profile' => [
                    'psychological_summary' => $profile->psychological_summary,
                    'character_summary' => $profile->character_summary,
                    'strengths' => $profile->strengths,
                    'weaknesses' => $profile->weaknesses,
                    'published_at' => $profile->published_at?->toIso8601String(),
                    'version' => $profile->version,
                ],
                'completeness_percent' => $profile->completeness_percent,
            ],
        ]);
    }

    public function updateBiodata(Request $request)
    {
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

        // Baris yang belum lengkap dibuang agar formulir tidak gagal hanya karena baris kosong.
        if (array_key_exists('extra_fields', $data)) {
            $data['extra_fields'] = collect($data['extra_fields'] ?? [])
                ->filter(fn ($row) => filled($row['label'] ?? null) && filled($row['value'] ?? null))
                ->map(fn ($row) => ['label' => trim($row['label']), 'value' => trim($row['value'])])
                ->values()->all();
        }

        $profile = StudentProfile::firstOrCreate(['user_id' => $request->user()->id]);
        $profile->fill($data);
        $profile->completeness_percent = $profile->completeness();
        $profile->save();

        return response()->json([
            'success' => true,
            'data' => [
                'completeness_percent' => $profile->completeness_percent,
                'updated_at' => $profile->updated_at?->toIso8601String(),
            ],
            'message' => 'Biodata diperbarui',
        ]);
    }

    public function updateSelfProfile(Request $request)
    {
        $data = $request->validate([
            'psychological_summary' => ['nullable', 'string', 'max:5000'],
            'character_summary' => ['nullable', 'string', 'max:5000'],
            'strengths' => ['nullable', 'string', 'max:5000'],
            'weaknesses' => ['nullable', 'string', 'max:5000'],
            'publish' => ['boolean'],
        ]);

        $profile = StudentProfile::firstOrCreate(['user_id' => $request->user()->id]);

        $profile->fill(collect($data)->except('publish')->all());
        $profile->version = $profile->version + 1;

        if ($data['publish'] ?? false) {
            $profile->published_at = now();
        }

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

        return response()->json([
            'success' => true,
            'data' => [
                'version' => $profile->version,
                'published_at' => $profile->published_at?->toIso8601String(),
            ],
            'message' => 'Profil diri disimpan',
        ]);
    }

    public function profileVersions(Request $request)
    {
        $profile = StudentProfile::firstOrCreate(['user_id' => $request->user()->id]);

        $versions = StudentProfileVersion::query()
            ->where('student_profile_id', $profile->id)
            ->orderByDesc('version')
            ->get()
            ->map(fn ($v) => [
                'version' => $v->version,
                'created_at' => $v->created_at?->toIso8601String(),
                'summary' => 'Perubahan profil versi '.$v->version,
            ]);

        return response()->json(['success' => true, 'data' => $versions]);
    }

    public function counselingSummaries(Request $request)
    {
        $notes = CounselingNote::query()
            ->where('student_id', $request->user()->id)
            ->where('visible_to_student', true)
            ->orderByDesc('occurred_at')
            ->get()
            ->map(fn ($n) => [
                'id' => $n->id,
                'title' => $n->title,
                'occurred_at' => $n->occurred_at->toIso8601String(),
                'status' => $n->status,
                'summary' => $n->summary,
            ]);

        return response()->json(['success' => true, 'data' => $notes]);
    }

    public function consentStatus(Request $request)
    {
        $user = $request->user();

        return response()->json([
            'success' => true,
            'data' => [
                'version' => $this->settings->get('privacy.consent_version', '2026-08-01'),
                'has_consent' => $user->hasConsent(),
                'consented_at' => $user->consented_at?->toIso8601String(),
            ],
        ]);
    }

    public function accessLog(Request $request)
    {
        $user = $request->user();

        $logs = AuditLog::query()
            ->where('subject_user_id', $user->id)
            ->whereIn('action', ['journal.viewed', 'reflection.viewed', 'counseling_note.viewed', 'profile.viewed'])
            ->with('actor')
            ->orderByDesc('id')
            ->paginate(20);

        return response()->json([
            'success' => true,
            'data' => collect($logs->items())->map(fn ($log) => [
                'action' => $log->action,
                'actor_name' => $log->actor?->name,
                'created_at' => $log->created_at?->toIso8601String(),
                'reason' => $log->reason,
            ]),
            'meta' => [
                'current_page' => $logs->currentPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
                'last_page' => $logs->lastPage(),
            ],
        ]);
    }

    public function reminderPreferences(Request $request)
    {
        $user = $request->user();

        return response()->json([
            'success' => true,
            'data' => [
                'mood_reminder_enabled' => $user->mood_reminder_enabled,
                'mood_reminder_hour' => $user->mood_reminder_hour,
                'reflection_reminder_enabled' => $user->reflection_reminder_enabled,
                'channel' => $user->notification_channel,
            ],
        ]);
    }

    public function updateReminderPreferences(Request $request)
    {
        $data = $request->validate([
            'mood_reminder_enabled' => ['boolean'],
            'mood_reminder_hour' => ['integer', 'between:6,21'],
            'reflection_reminder_enabled' => ['boolean'],
            'channel' => ['sometimes', Rule::in(['in_app', 'email_and_in_app'])],
        ]);

        if (isset($data['channel'])) {
            $data['notification_channel'] = $data['channel'];
            unset($data['channel']);
        }

        $request->user()->forceFill($data)->save();

        return response()->json([
            'success' => true,
            'data' => [
                'mood_reminder_hour' => $request->user()->mood_reminder_hour,
                'updated_at' => now()->toIso8601String(),
            ],
        ]);
    }

    public function whatsappLink(Request $request)
    {
        if (! $this->settings->get('feature.whatsapp_escalation', true)) {
            return response()->json([
                'success' => false,
                'error' => 'FEATURE_DISABLED',
                'message' => 'Fitur eskalasi WhatsApp sedang dinonaktifkan.',
            ], 403);
        }

        $user = $request->user();
        $counselor = $this->counselorFor($user);
        $counselorNumber = preg_replace('/\D+/', '', (string) $counselor?->phone);
        $schoolNumber = preg_replace('/\D+/', '', (string) $this->settings->get('school.whatsapp_number'));

        $number = $counselorNumber !== '' ? $counselorNumber : $schoolNumber;

        if ($number === '') {
            return response()->json([
                'success' => false,
                'error' => 'WHATSAPP_NOT_CONFIGURED',
                'message' => 'Nomor WhatsApp Guru BK belum diatur. Hubungi wali kelas atau admin sekolah.',
            ], 409);
        }

        $class = $user->activeClass();
        $message = sprintf(
            'Halo Bu/Bapak BK, saya %s%s. Saya ingin melanjutkan curhat dan meminta waktu konsultasi.',
            $user->name,
            $class ? ' kelas '.$class->name : '',
        );

        return response()->json([
            'success' => true,
            'data' => [
                'url' => 'https://wa.me/'.$number.'?text='.rawurlencode($message),
                'counselor_name' => $counselorNumber !== '' ? $counselor?->name : 'Layanan BK sekolah',
                'phone' => $number,
                'source' => $counselorNumber !== '' ? 'counselor' : 'school',
                'service_hours' => $this->settings->get('school.service_hours'),
            ],
        ]);
    }

    private function moodSummary($user, int $days): array
    {
        $entries = MoodEntry::query()
            ->where('student_id', $user->id)
            ->where('entry_date', '>=', now()->subDays($days - 1)->toDateString())
            ->orderBy('entry_date')
            ->get();

        return [
            'range' => $days.'d',
            'points' => $entries->map(fn ($e) => [
                'date' => $e->entry_date->toDateString(),
                'valence' => $e->valence,
                'intensity' => $e->intensity,
            ])->all(),
            'positive_days' => $entries->where('valence', 'positive')->count(),
            'negative_days' => $entries->where('valence', 'negative')->count(),
        ];
    }
}
