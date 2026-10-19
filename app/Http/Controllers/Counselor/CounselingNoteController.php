<?php

namespace App\Http\Controllers\Counselor;

use App\Http\Controllers\Controller;
use App\Models\CounselingNote;
use App\Models\CounselingNoteVersion;
use App\Models\User;
use App\Services\AccessScope;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CounselingNoteController extends Controller
{
    public function __construct(
        private readonly AccessScope $access,
        private readonly AuditLogger $audit,
    ) {}

    public function index(Request $request)
    {
        $studentIds = $this->access->counselorStudentIds($request->user());

        $query = CounselingNote::query()
            ->whereIn('student_id', $studentIds)
            ->with('student');

        if ($request->filled('student_id')) {
            $query->where('student_id', $request->integer('student_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        $notes = $query->orderByDesc('occurred_at')->paginate(20);

        return response()->json([
            'success' => true,
            'data' => collect($notes->items())->map(fn (CounselingNote $note) => [
                'id' => $note->id,
                'student' => ['id' => $note->student->id, 'name' => $note->student->name],
                'title' => $note->title,
                'occurred_at' => $note->occurred_at->toIso8601String(),
                'status' => $note->status,
                'is_sensitive' => $note->is_sensitive,
                'visible_to_student' => $note->visible_to_student,
            ]),
            'meta' => [
                'current_page' => $notes->currentPage(),
                'per_page' => $notes->perPage(),
                'total' => $notes->total(),
                'last_page' => $notes->lastPage(),
            ],
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'student_id' => ['required', 'exists:users,id'],
            'title' => ['required', 'string', 'max:190'],
            'occurred_at' => ['required', 'date'],
            'summary' => ['nullable', 'string', 'max:500'],
            'content' => ['required', 'string', 'max:10000'],
            'status' => ['nullable', Rule::in(['open', 'closed'])],
            'is_sensitive' => ['boolean'],
            'visible_to_student' => ['boolean'],
        ]);

        $student = User::findOrFail($data['student_id']);
        $this->ensureAccess($request, $student);

        $note = CounselingNote::create($data + [
            'counselor_id' => $request->user()->id,
            'status' => $data['status'] ?? 'open',
        ]);

        $this->audit->record('counseling_note.created', 'counseling_notes', $note->id, $student->id, null, [
            'is_sensitive' => $note->is_sensitive,
        ]);

        return response()->json([
            'success' => true,
            'data' => ['id' => $note->id, 'created_at' => $note->created_at?->toIso8601String()],
        ], 201);
    }

    public function show(Request $request, CounselingNote $note)
    {
        $this->ensureAccess($request, $note->student);

        if ($note->is_sensitive && ! $request->boolean('confirm_sensitive')) {
            return response()->json([
                'success' => false,
                'error' => 'CONFIRMATION_REQUIRED',
                'message' => 'Catatan ditandai sensitif. Kirim ulang dengan confirm_sensitive=true.',
            ], 409);
        }

        $this->audit->record('counseling_note.viewed', 'counseling_notes', $note->id, $note->student_id);

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $note->id,
                'student_id' => $note->student_id,
                'title' => $note->title,
                'occurred_at' => $note->occurred_at->toIso8601String(),
                'summary' => $note->summary,
                'content' => $note->content,
                'status' => $note->status,
                'is_sensitive' => $note->is_sensitive,
                'visible_to_student' => $note->visible_to_student,
                'version' => $note->versions()->max('version') + 1,
            ],
        ]);
    }

    public function update(Request $request, CounselingNote $note)
    {
        $this->ensureAccess($request, $note->student);

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:190'],
            'occurred_at' => ['sometimes', 'date'],
            'summary' => ['nullable', 'string', 'max:500'],
            'content' => ['sometimes', 'string', 'max:10000'],
            'status' => ['sometimes', Rule::in(['open', 'closed'])],
            'is_sensitive' => ['sometimes', 'boolean'],
            'visible_to_student' => ['sometimes', 'boolean'],
        ]);

        $version = $note->versions()->max('version') + 1;

        CounselingNoteVersion::create([
            'counseling_note_id' => $note->id,
            'version' => $version,
            'snapshot' => $note->only(['title', 'summary', 'content', 'status', 'is_sensitive', 'visible_to_student']),
            'changed_by' => $request->user()->id,
            'created_at' => now(),
        ]);

        $note->fill($data)->save();

        $this->audit->record('counseling_note.updated', 'counseling_notes', $note->id, $note->student_id);

        return response()->json(['success' => true, 'data' => ['id' => $note->id, 'version' => $version + 1]]);
    }

    private function ensureAccess(Request $request, User $student): void
    {
        if (! $this->access->counselorCanAccess($request->user(), $student)) {
            $this->audit->record('access.denied', 'users', $student->id, $student->id);
            abort(response()->json([
                'success' => false,
                'error' => 'FORBIDDEN',
                'message' => 'Anda tidak memiliki akses ke siswa ini',
            ], 403));
        }
    }
}
