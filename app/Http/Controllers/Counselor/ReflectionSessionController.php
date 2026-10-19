<?php

namespace App\Http\Controllers\Counselor;

use App\Http\Controllers\Controller;
use App\Models\ClassStudent;
use App\Models\Reflection;
use App\Models\ReflectionFeedback;
use App\Models\ReflectionSession;
use App\Models\User;
use App\Services\AccessScope;
use App\Services\AuditLogger;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ReflectionSessionController extends Controller
{
    public function __construct(
        private readonly AccessScope $access,
        private readonly AuditLogger $audit,
        private readonly NotificationService $notifications,
    ) {}

    public function index(Request $request)
    {
        $sessions = ReflectionSession::query()
            ->where('counselor_id', $request->user()->id)
            ->with(['schoolClass', 'student'])
            ->withCount('reflections')
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $sessions->map(fn ($s) => [
                'id' => $s->id,
                'topic' => $s->topic,
                'target' => $s->class_id
                    ? ['type' => 'class', 'class_id' => $s->class_id, 'name' => $s->schoolClass?->name]
                    : ['type' => 'student', 'student_id' => $s->student_id, 'name' => $s->student?->name],
                'due_at' => $s->due_at->toIso8601String(),
                'status' => $s->status,
                'submitted_count' => $s->reflections_count,
                'target_count' => $s->class_id
                    ? ClassStudent::query()->where('class_id', $s->class_id)->where('status', 'active')->count()
                    : 1,
            ]),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'class_id' => ['nullable', 'exists:classes,id', 'required_without:student_id'],
            'student_id' => ['nullable', 'exists:users,id', 'required_without:class_id'],
            'topic' => ['required', 'string', 'max:190'],
            'instructions' => ['nullable', 'string', 'max:2000'],
            'questions' => ['required', 'array', 'min:1'],
            'questions.*' => ['string', 'max:500'],
            'due_at' => ['required', 'date', 'after:now'],
        ]);

        if (! empty($data['class_id']) && ! in_array($data['class_id'], $this->access->counselorClassIds($request->user()), true)) {
            return response()->json(['success' => false, 'error' => 'FORBIDDEN', 'message' => 'Kelas bukan binaan Anda.'], 403);
        }

        if (! empty($data['student_id'])) {
            $student = User::findOrFail($data['student_id']);
            abort_unless($this->access->counselorCanAccess($request->user(), $student), 403);
        }

        $session = ReflectionSession::create($data + [
            'counselor_id' => $request->user()->id,
            'status' => 'scheduled',
        ]);

        $targets = $session->class_id
            ? User::query()
                ->whereIn('id', ClassStudent::query()->where('class_id', $session->class_id)->where('status', 'active')->pluck('student_id'))
                ->get()
            : collect([$session->student]);

        foreach ($targets as $student) {
            $this->notifications->sessionAssigned($student, $session->topic, $session->due_at->translatedFormat('d M Y H:i'));
        }

        $this->audit->record('reflection_session.created', 'reflection_sessions', $session->id, $session->student_id);

        return response()->json(['success' => true, 'data' => ['id' => $session->id, 'status' => $session->status]], 201);
    }

    public function show(Request $request, ReflectionSession $session)
    {
        abort_unless($session->counselor_id === $request->user()->id, 403);

        $studentIds = $session->class_id
            ? ClassStudent::query()->where('class_id', $session->class_id)->where('status', 'active')->pluck('student_id')
            : collect([$session->student_id]);

        $reflections = Reflection::query()
            ->where('session_id', $session->id)
            ->get()
            ->keyBy('student_id');

        $students = User::query()->whereIn('id', $studentIds)->orderBy('name')->get()->map(function (User $student) use ($reflections, $session) {
            $reflection = $reflections[$student->id] ?? null;

            return [
                'id' => $student->id,
                'name' => $student->name,
                'status' => $reflection?->status ?? ($session->due_at->isPast() ? 'not_attended' : 'pending'),
                'reflection_id' => $reflection?->id,
                'submitted_at' => $reflection?->submitted_at?->toIso8601String(),
            ];
        });

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $session->id,
                'topic' => $session->topic,
                'instructions' => $session->instructions,
                'questions' => $session->questions,
                'due_at' => $session->due_at->toIso8601String(),
                'status' => $session->status,
                'students' => $students,
            ],
        ]);
    }

    public function update(Request $request, ReflectionSession $session)
    {
        abort_unless($session->counselor_id === $request->user()->id, 403);

        $data = $request->validate([
            'due_at' => ['sometimes', 'date', 'after:now'],
            'status' => ['sometimes', Rule::in(['scheduled', 'ongoing', 'completed', 'cancelled'])],
            'extension_reason' => ['nullable', 'string', 'max:1000', 'required_with:due_at'],
        ]);

        if (isset($data['due_at'])) {
            $data['extended_at'] = now();
        }

        $session->fill($data)->save();

        $this->audit->record('reflection_session.updated', 'reflection_sessions', $session->id, $session->student_id, $data['extension_reason'] ?? null);

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $session->id,
                'due_at' => $session->due_at->toIso8601String(),
                'status' => $session->status,
            ],
        ]);
    }

    public function storeFeedback(Request $request, Reflection $reflection)
    {
        $this->ensureStudentAccess($request, $reflection->student);

        $data = $request->validate([
            'content' => ['required', 'string', 'max:5000'],
        ]);

        $version = $reflection->feedbacks()->max('version') + 1;

        $feedback = ReflectionFeedback::create([
            'reflection_id' => $reflection->id,
            'counselor_id' => $request->user()->id,
            'content' => $data['content'],
            'version' => $version,
        ]);

        $this->notifications->feedbackReceived($reflection->student, $request->user()->name);
        $this->audit->record('reflection_feedback.created', 'reflection_feedbacks', $feedback->id, $reflection->student_id);

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $feedback->id,
                'reflection_id' => $reflection->id,
                'created_at' => $feedback->created_at?->toIso8601String(),
            ],
        ], 201);
    }

    private function ensureStudentAccess(Request $request, User $student): void
    {
        if (! $this->access->counselorCanAccess($request->user(), $student)) {
            abort(response()->json([
                'success' => false,
                'error' => 'FORBIDDEN',
                'message' => 'Anda tidak memiliki akses ke siswa ini',
            ], 403));
        }
    }
}
