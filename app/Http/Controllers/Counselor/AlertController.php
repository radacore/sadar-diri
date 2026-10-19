<?php

namespace App\Http\Controllers\Counselor;

use App\Http\Controllers\Controller;
use App\Models\Alert;
use App\Models\MoodEntry;
use App\Services\AccessScope;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AlertController extends Controller
{
    public function __construct(
        private readonly AccessScope $access,
        private readonly AuditLogger $audit,
    ) {}

    public function index(Request $request)
    {
        $studentIds = $this->access->counselorStudentIds($request->user());

        $query = Alert::query()
            ->whereIn('student_id', $studentIds)
            ->with('student');

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        if ($request->filled('severity')) {
            $query->where('severity', $request->query('severity'));
        }

        $alerts = $query->orderByRaw("FIELD(severity, 'high', 'medium', 'low')")->orderByDesc('detected_at')->paginate(20);

        return response()->json([
            'success' => true,
            'data' => collect($alerts->items())->map(fn (Alert $alert) => [
                'id' => $alert->id,
                'student' => [
                    'id' => $alert->student->id,
                    'name' => $alert->student->name,
                    'class' => $alert->student->activeClass()?->name,
                ],
                'trigger_type' => $alert->trigger_type,
                'trigger_label' => $alert->label(),
                'severity' => $alert->severity,
                'status' => $alert->status,
                'detected_at' => $alert->detected_at->toIso8601String(),
                'handled_at' => $alert->handled_at?->toIso8601String(),
            ]),
            'meta' => [
                'current_page' => $alerts->currentPage(),
                'per_page' => $alerts->perPage(),
                'total' => $alerts->total(),
                'last_page' => $alerts->lastPage(),
            ],
        ]);
    }

    public function show(Request $request, Alert $alert)
    {
        $this->ensureAccess($request, $alert);

        $context = [];

        if ($alert->trigger_type === 'mood_low_streak') {
            $entries = MoodEntry::query()
                ->where('student_id', $alert->student_id)
                ->orderByDesc('entry_date')
                ->limit(5)
                ->get();

            $context = [
                'negative_days' => $entries->where('valence', 'negative')->count(),
                'last_intensity' => $entries->first()?->intensity,
                'last_entry_date' => $entries->first()?->entry_date?->toDateString(),
            ];
        }

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $alert->id,
                'student' => [
                    'id' => $alert->student->id,
                    'name' => $alert->student->name,
                    'class' => $alert->student->activeClass()?->name,
                ],
                'trigger_type' => $alert->trigger_type,
                'trigger_label' => $alert->label(),
                'severity' => $alert->severity,
                'status' => $alert->status,
                'detected_at' => $alert->detected_at->toIso8601String(),
                'context' => $context,
                'resolution_note' => $alert->resolution_note,
            ],
        ]);
    }

    public function update(Request $request, Alert $alert)
    {
        $this->ensureAccess($request, $alert);

        $data = $request->validate([
            'status' => ['required', Rule::in(['new', 'in_progress', 'resolved'])],
            'resolution_note' => ['nullable', 'string', 'max:2000', 'required_if:status,resolved'],
        ]);

        $alert->fill([
            'status' => $data['status'],
            'resolution_note' => $data['resolution_note'] ?? $alert->resolution_note,
            'handled_by' => $request->user()->id,
            'handled_at' => $data['status'] === 'resolved' ? now() : $alert->handled_at,
        ])->save();

        $this->audit->record('alert.updated', 'alerts', $alert->id, $alert->student_id, $data['resolution_note'] ?? null, [
            'status' => $alert->status,
        ]);

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $alert->id,
                'status' => $alert->status,
                'handled_by' => $alert->handled_by,
                'handled_at' => $alert->handled_at?->toIso8601String(),
            ],
        ]);
    }

    private function ensureAccess(Request $request, Alert $alert): void
    {
        if (! $this->access->counselorCanAccess($request->user(), $alert->student)) {
            $this->audit->record('access.denied', 'alerts', $alert->id, $alert->student_id);
            abort(response()->json([
                'success' => false,
                'error' => 'FORBIDDEN',
                'message' => 'Anda tidak memiliki akses ke alert ini',
            ], 403));
        }
    }
}
