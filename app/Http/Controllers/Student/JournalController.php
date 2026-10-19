<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\JournalEntry;
use App\Services\AlertEngine;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class JournalController extends Controller
{
    public function __construct(private readonly AlertEngine $alerts) {}

    public function index(Request $request)
    {
        $query = JournalEntry::query()->where('student_id', $request->user()->id);

        if ($request->filled('type')) {
            $query->where('type', $request->query('type'));
        }

        if ($request->filled('from')) {
            $query->where('entry_date', '>=', $request->date('from'));
        }

        if ($request->filled('to')) {
            $query->where('entry_date', '<=', $request->date('to'));
        }

        $entries = $query->orderByDesc('entry_date')->orderByDesc('id')->paginate(20);

        return response()->json([
            'success' => true,
            'data' => collect($entries->items())->map(fn ($e) => [
                'id' => $e->id,
                'type' => $e->type,
                'entry_date' => $e->entry_date->toDateString(),
                'status' => $e->status,
                'excerpt' => $e->excerpt(),
                'is_flagged' => $e->is_flagged,
                'created_at' => $e->created_at?->toIso8601String(),
            ]),
            'meta' => [
                'current_page' => $entries->currentPage(),
                'per_page' => $entries->perPage(),
                'total' => $entries->total(),
                'last_page' => $entries->lastPage(),
            ],
        ]);
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);

        $entry = JournalEntry::create([
            'student_id' => $request->user()->id,
            'type' => $data['type'],
            'entry_date' => $data['entry_date'] ?? now()->toDateString(),
            'status' => $data['status'] ?? 'published',
            'prompt_content_id' => \App\Models\ContentItem::query()
                ->where('type', 'abc_prompt')->where('status', 'published')->value('id'),
            'activating_event' => $data['activating_event'] ?? null,
            'belief' => $data['belief'] ?? null,
            'consequence' => $data['consequence'] ?? null,
            'gratitude_text' => $data['gratitude_text'] ?? null,
            'happiness_text' => $data['happiness_text'] ?? null,
        ]);

        $request->user()->forceFill(['last_activity_at' => now()])->save();

        if ($entry->status === 'published') {
            $this->alerts->evaluateFor($request->user());
        }

        return response()->json([
            'success' => true,
            'data' => ['id' => $entry->id, 'status' => $entry->status, 'is_flagged' => $entry->is_flagged],
            'message' => 'Jurnal tersimpan',
        ], 201);
    }

    public function show(Request $request, JournalEntry $journal)
    {
        $this->authorizeOwnership($request, $journal);

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $journal->id,
                'type' => $journal->type,
                'entry_date' => $journal->entry_date->toDateString(),
                'activating_event' => $journal->activating_event,
                'belief' => $journal->belief,
                'consequence' => $journal->consequence,
                'gratitude_text' => $journal->gratitude_text,
                'happiness_text' => $journal->happiness_text,
                'status' => $journal->status,
                'created_at' => $journal->created_at?->toIso8601String(),
            ],
        ]);
    }

    public function update(Request $request, JournalEntry $journal)
    {
        $this->authorizeOwnership($request, $journal);
        $data = $this->validated($request);

        $journal->fill([
            'status' => $data['status'] ?? $journal->status,
            'activating_event' => $data['activating_event'] ?? null,
            'belief' => $data['belief'] ?? null,
            'consequence' => $data['consequence'] ?? null,
            'gratitude_text' => $data['gratitude_text'] ?? null,
            'happiness_text' => $data['happiness_text'] ?? null,
        ])->save();

        if ($journal->status === 'published') {
            $this->alerts->evaluateFor($request->user());
        }

        return response()->json([
            'success' => true,
            'data' => ['id' => $journal->id, 'updated_at' => $journal->updated_at?->toIso8601String()],
        ]);
    }

    public function destroy(Request $request, JournalEntry $journal)
    {
        $this->authorizeOwnership($request, $journal);
        $journal->delete();

        return response()->json(['success' => true, 'data' => null, 'message' => 'Jurnal dihapus']);
    }

    public function draft(Request $request)
    {
        $draft = JournalEntry::query()
            ->where('student_id', $request->user()->id)
            ->where('status', 'draft')
            ->latest('updated_at')
            ->first();

        if (! $draft) {
            return response()->json(['success' => true, 'data' => null]);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $draft->id,
                'type' => $draft->type,
                'activating_event' => $draft->activating_event,
                'belief' => $draft->belief,
                'consequence' => $draft->consequence,
                'gratitude_text' => $draft->gratitude_text,
                'happiness_text' => $draft->happiness_text,
                'updated_at' => $draft->updated_at?->toIso8601String(),
            ],
        ]);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'type' => ['required', Rule::in(['abc', 'grateful'])],
            'entry_date' => ['nullable', 'date', 'before_or_equal:today'],
            'status' => ['nullable', Rule::in(['draft', 'published'])],
            'activating_event' => ['required_if:type,abc', 'nullable', 'string', 'max:5000'],
            'belief' => ['required_if:type,abc', 'nullable', 'string', 'max:5000'],
            'consequence' => ['required_if:type,abc', 'nullable', 'string', 'max:5000'],
            'gratitude_text' => ['nullable', 'string', 'max:5000'],
            'happiness_text' => ['nullable', 'string', 'max:5000'],
        ]);
    }

    private function authorizeOwnership(Request $request, JournalEntry $journal): void
    {
        abort_unless($journal->student_id === $request->user()->id, 403);
    }
}
