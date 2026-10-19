<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\Reflection;
use App\Models\ReflectionSession;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

class ReflectionController extends Controller
{
    public function index(Request $request)
    {
        $query = Reflection::query()
            ->where('student_id', $request->user()->id)
            ->with('feedbacks');

        if ($request->filled('type')) {
            $query->where('type', $request->query('type'));
        }

        $items = $query->orderByDesc('created_at')->paginate(20);

        return response()->json([
            'success' => true,
            'data' => collect($items->items())->map(fn ($r) => [
                'id' => $r->id,
                'type' => $r->type,
                'week_start' => $r->week_start?->toDateString(),
                'status' => $r->status,
                'submitted_at' => $r->submitted_at?->toIso8601String(),
                'has_feedback' => $r->feedbacks->isNotEmpty(),
            ]),
            'meta' => [
                'current_page' => $items->currentPage(),
                'per_page' => $items->perPage(),
                'total' => $items->total(),
                'last_page' => $items->lastPage(),
            ],
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'week_start' => ['nullable', 'date'],
            'positive_experience' => ['required', 'string', 'max:5000'],
            'negative_experience' => ['required', 'string', 'max:5000'],
            'status' => ['nullable', Rule::in(['draft', 'submitted'])],
        ]);

        $weekStart = $data['week_start'] ?? now()->startOfWeek()->toDateString();

        $existing = Reflection::query()
            ->where('student_id', $request->user()->id)
            ->where('type', 'self')
            ->whereDate('week_start', $weekStart)
            ->first();

        if ($existing) {
            return response()->json([
                'success' => false,
                'error' => 'CONFLICT',
                'message' => 'Refleksi pekan ini sudah ada. Silakan perbarui entri tersebut.',
            ], 409);
        }

        $reflection = Reflection::create([
            'student_id' => $request->user()->id,
            'type' => 'self',
            'week_start' => $weekStart,
            'positive_experience' => $data['positive_experience'],
            'negative_experience' => $data['negative_experience'],
            'status' => $data['status'] ?? 'submitted',
            'submitted_at' => ($data['status'] ?? 'submitted') === 'submitted' ? now() : null,
        ]);

        $request->user()->forceFill(['last_activity_at' => now()])->save();

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $reflection->id,
                'status' => $reflection->status,
                'submitted_at' => $reflection->submitted_at?->toIso8601String(),
            ],
        ], 201);
    }

    public function show(Request $request, Reflection $reflection)
    {
        abort_unless($reflection->student_id === $request->user()->id, 403);

        $feedback = $reflection->latestFeedback();

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $reflection->id,
                'type' => $reflection->type,
                'week_start' => $reflection->week_start?->toDateString(),
                'positive_experience' => $reflection->positive_experience,
                'negative_experience' => $reflection->negative_experience,
                'answers' => $reflection->answers,
                'session' => $reflection->session ? [
                    'id' => $reflection->session->id,
                    'topic' => $reflection->session->topic,
                    'questions' => $reflection->session->questions,
                ] : null,
                'status' => $reflection->status,
                'submitted_at' => $reflection->submitted_at?->toIso8601String(),
                'feedback' => $feedback ? [
                    'content' => $feedback->content,
                    'counselor_name' => $feedback->counselor?->name,
                    'created_at' => $feedback->created_at?->toIso8601String(),
                ] : null,
            ],
        ]);
    }

    public function update(Request $request, Reflection $reflection)
    {
        abort_unless($reflection->student_id === $request->user()->id, 403);

        if ($reflection->type !== 'self') {
            return response()->json(['success' => false, 'error' => 'FORBIDDEN', 'message' => 'Refleksi terbimbing tidak dapat diubah.'], 403);
        }

        if ($reflection->week_start && $reflection->week_start->lt(now()->startOfWeek())) {
            return response()->json(['success' => false, 'error' => 'CONFLICT', 'message' => 'Pekan refleksi sudah lewat.'], 409);
        }

        $data = $request->validate([
            'positive_experience' => ['required', 'string', 'max:5000'],
            'negative_experience' => ['required', 'string', 'max:5000'],
            'status' => ['nullable', Rule::in(['draft', 'submitted'])],
        ]);

        $reflection->fill($data);

        if (($data['status'] ?? $reflection->status) === 'submitted') {
            $reflection->submitted_at = now();
        }

        $reflection->save();

        return response()->json([
            'success' => true,
            'data' => ['id' => $reflection->id, 'updated_at' => $reflection->updated_at?->toIso8601String()],
        ]);
    }

    public function sessions(Request $request)
    {
        $user = $request->user();
        $classId = $user->activeClass()?->id;

        $sessions = ReflectionSession::query()
            ->whereIn('status', ['scheduled', 'ongoing', 'completed'])
            ->where(function ($query) use ($user, $classId) {
                $query->where('student_id', $user->id);
                if ($classId) {
                    $query->orWhere('class_id', $classId);
                }
            })
            ->orderBy('due_at')
            ->get();

        $submitted = Reflection::query()
            ->where('student_id', $user->id)
            ->whereIn('session_id', $sessions->pluck('id'))
            ->pluck('status', 'session_id');

        return response()->json([
            'success' => true,
            'data' => $sessions->map(fn ($s) => [
                'id' => $s->id,
                'topic' => $s->topic,
                'instructions' => $s->instructions,
                'due_at' => $s->due_at->toIso8601String(),
                'status' => $s->status,
                'questions' => $s->questions,
                'submitted' => isset($submitted[$s->id]) && in_array($submitted[$s->id], ['submitted', 'late'], true),
            ]),
        ]);
    }

    public function submitSession(Request $request, ReflectionSession $session)
    {
        $user = $request->user();
        $classId = $user->activeClass()?->id;

        $allowed = $session->student_id === $user->id || ($session->class_id && $session->class_id === $classId);
        abort_unless($allowed, 403);

        if (in_array($session->status, ['completed', 'cancelled'], true)) {
            return response()->json(['success' => false, 'error' => 'CONFLICT', 'message' => 'Sesi refleksi sudah ditutup.'], 409);
        }

        if ($session->due_at->isPast()) {
            return response()->json(['success' => false, 'error' => 'CONFLICT', 'message' => 'Tenggat sesi sudah lewat. Hubungi Guru BK untuk perpanjangan.'], 409);
        }

        $data = $request->validate([
            'answers' => ['required', 'array', 'min:1'],
            'answers.*.question' => ['required', 'string'],
            'answers.*.answer' => ['required', 'string', 'max:5000'],
        ]);

        $reflection = Reflection::updateOrCreate(
            ['student_id' => $user->id, 'session_id' => $session->id],
            [
                'type' => 'guided',
                'answers' => $data['answers'],
                'status' => 'submitted',
                'submitted_at' => now(),
            ],
        );

        if ($session->status === 'scheduled') {
            $session->update(['status' => 'ongoing']);
        }

        $user->forceFill(['last_activity_at' => now()])->save();

        return response()->json([
            'success' => true,
            'data' => ['reflection_id' => $reflection->id, 'status' => 'submitted'],
            'message' => 'Refleksi terkirim',
        ], 201);
    }
}
