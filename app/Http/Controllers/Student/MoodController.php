<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\MoodEntry;
use App\Services\AlertEngine;
use Illuminate\Http\Request;

class MoodController extends Controller
{
    public function __construct(private readonly AlertEngine $alerts) {}

    public function index(Request $request)
    {
        $query = MoodEntry::query()->where('student_id', $request->user()->id);

        if ($request->filled('from')) {
            $query->where('entry_date', '>=', $request->date('from'));
        }

        if ($request->filled('to')) {
            $query->where('entry_date', '<=', $request->date('to'));
        }

        $entries = $query->orderByDesc('entry_date')->paginate(20);

        return response()->json([
            'success' => true,
            'data' => collect($entries->items())->map(fn ($m) => [
                'id' => $m->id,
                'entry_date' => $m->entry_date->toDateString(),
                'valence' => $m->valence,
                'intensity' => $m->intensity,
                'emotion_tags' => $m->emotion_tags,
                'note' => $m->note,
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
        $data = $request->validate([
            'entry_date' => ['nullable', 'date', 'before_or_equal:today'],
            'valence' => ['required', 'in:positive,negative'],
            'intensity' => ['required', 'integer', 'between:1,5'],
            'emotion_tags' => ['required', 'array', 'min:1', 'max:5'],
            'emotion_tags.*' => ['string', 'max:30'],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $entryDate = $data['entry_date'] ?? now()->toDateString();

        $mood = MoodEntry::query()->updateOrCreate(
            ['student_id' => $request->user()->id, 'entry_date' => $entryDate],
            [
                'valence' => $data['valence'],
                'intensity' => $data['intensity'],
                'emotion_tags' => $data['emotion_tags'],
                'note' => $data['note'] ?? null,
            ],
        );

        $request->user()->forceFill(['last_activity_at' => now()])->save();
        $this->alerts->evaluateFor($request->user());

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $mood->id,
                'entry_date' => $mood->entry_date->toDateString(),
                'created' => $mood->wasRecentlyCreated,
            ],
            'message' => $mood->wasRecentlyCreated ? 'Mood tersimpan' : 'Mood hari ini diperbarui',
        ], $mood->wasRecentlyCreated ? 201 : 200);
    }

    public function summary(Request $request)
    {
        $range = $request->query('range', '7d') === '30d' ? 30 : 7;

        $entries = MoodEntry::query()
            ->where('student_id', $request->user()->id)
            ->where('entry_date', '>=', now()->subDays($range - 1)->toDateString())
            ->orderBy('entry_date')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'range' => $range.'d',
                'points' => $entries->map(fn ($e) => [
                    'date' => $e->entry_date->toDateString(),
                    'valence' => $e->valence,
                    'intensity' => $e->intensity,
                ])->all(),
                'positive_days' => $entries->where('valence', 'positive')->count(),
                'negative_days' => $entries->where('valence', 'negative')->count(),
            ],
        ]);
    }
}
