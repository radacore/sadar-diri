<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\ActionPlan;
use App\Models\ActionTarget;
use App\Models\FuturePlan;
use App\Models\FuturePlanVersion;
use App\Services\ReportService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

class ActionPlanController extends Controller
{
    public function __construct(private readonly ReportService $reports) {}

    public function current(Request $request)
    {
        $plan = $this->planFor($request);

        return response()->json(['success' => true, 'data' => $this->planPayload($plan)]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'period_start' => ['required', 'date'],
            'period_end' => ['required', 'date', 'after:period_start'],
        ]);

        if (ActionPlan::query()->where('student_id', $request->user()->id)->whereDate('period_start', $data['period_start'])->exists()) {
            return response()->json(['success' => false, 'error' => 'CONFLICT', 'message' => 'Rencana untuk periode ini sudah ada.'], 409);
        }

        $plan = ActionPlan::create($data + ['student_id' => $request->user()->id, 'status' => 'active']);

        return response()->json(['success' => true, 'data' => ['id' => $plan->id, 'status' => $plan->status]], 201);
    }

    public function storeTarget(Request $request, ActionPlan $plan)
    {
        abort_unless($plan->student_id === $request->user()->id, 403);

        if ($plan->targets()->count() >= 5) {
            return response()->json(['success' => false, 'error' => 'LIMIT_REACHED', 'message' => 'Maksimal 5 target aktif per bulan.'], 409);
        }

        $data = $request->validate([
            'title' => ['required', 'string', 'max:190'],
            'success_indicator' => ['required', 'string', 'max:1000'],
            'status' => ['nullable', Rule::in(['not_started', 'in_progress', 'achieved', 'not_achieved'])],
        ]);

        $target = $plan->targets()->create($data + [
            'status' => $data['status'] ?? 'not_started',
            'sort_order' => $plan->targets()->count() + 1,
        ]);

        return response()->json(['success' => true, 'data' => ['id' => $target->id, 'sort_order' => $target->sort_order]], 201);
    }

    public function updateTarget(Request $request, ActionTarget $target)
    {
        abort_unless($target->plan->student_id === $request->user()->id, 403);

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:190'],
            'success_indicator' => ['sometimes', 'string', 'max:1000'],
            'status' => ['sometimes', Rule::in(['not_started', 'in_progress', 'achieved', 'not_achieved'])],
            'progress_note' => ['nullable', 'string', 'max:2000'],
        ]);

        $target->fill($data)->save();

        return response()->json(['success' => true, 'data' => ['id' => $target->id, 'status' => $target->status]]);
    }

    public function destroyTarget(Request $request, ActionTarget $target)
    {
        abort_unless($target->plan->student_id === $request->user()->id, 403);
        $target->delete();

        return response()->json(['success' => true, 'data' => null, 'message' => 'Target dihapus']);
    }

    public function evaluation(Request $request, ActionPlan $plan)
    {
        abort_unless($plan->student_id === $request->user()->id, 403);

        $evaluation = $plan->evaluation;

        if (! $evaluation) {
            $snapshot = $this->reports->monthlySnapshot(
                $request->user(),
                Carbon::parse($plan->period_start)->startOfDay(),
                Carbon::parse($plan->period_end)->endOfDay(),
            );

            $evaluation = $plan->evaluation()->create(['snapshot' => $snapshot]);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'snapshot' => $evaluation->snapshot,
                'evaluation_text' => $evaluation->evaluation_text,
                'improvement_text' => $evaluation->improvement_text,
            ],
        ]);
    }

    public function saveEvaluation(Request $request, ActionPlan $plan)
    {
        abort_unless($plan->student_id === $request->user()->id, 403);

        $data = $request->validate([
            'evaluation_text' => ['nullable', 'string', 'max:5000'],
            'improvement_text' => ['nullable', 'string', 'max:5000'],
        ]);

        $evaluation = $plan->evaluation ?: $plan->evaluation()->create([
            'snapshot' => $this->reports->monthlySnapshot(
                $request->user(),
                Carbon::parse($plan->period_start)->startOfDay(),
                Carbon::parse($plan->period_end)->endOfDay(),
            ),
        ]);

        $evaluation->fill($data)->save();

        return response()->json([
            'success' => true,
            'data' => ['id' => $evaluation->id, 'updated_at' => $evaluation->updated_at?->toIso8601String()],
        ]);
    }

    public function futurePlan(Request $request)
    {
        $plan = FuturePlan::firstOrCreate(['student_id' => $request->user()->id]);

        return response()->json([
            'success' => true,
            'data' => [
                'dream' => $plan->dream,
                'career_plan' => $plan->career_plan,
                'education_plan' => $plan->education_plan,
                'concrete_targets' => $plan->concrete_targets,
                'updated_at' => $plan->updated_at?->toIso8601String(),
            ],
        ]);
    }

    public function updateFuturePlan(Request $request)
    {
        $data = $request->validate([
            'dream' => ['nullable', 'string', 'max:3000'],
            'career_plan' => ['nullable', 'string', 'max:3000'],
            'education_plan' => ['nullable', 'string', 'max:3000'],
            'concrete_targets' => ['nullable', 'string', 'max:3000'],
        ]);

        $plan = FuturePlan::firstOrCreate(['student_id' => $request->user()->id]);
        $plan->fill($data)->save();

        $version = $plan->versions()->max('version') + 1;

        FuturePlanVersion::create([
            'future_plan_id' => $plan->id,
            'version' => $version,
            'snapshot' => $plan->only(['dream', 'career_plan', 'education_plan', 'concrete_targets']),
            'created_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'data' => ['version' => $version, 'updated_at' => $plan->updated_at?->toIso8601String()],
        ]);
    }

    private function planFor(Request $request): ActionPlan
    {
        $start = now()->startOfMonth()->toDateString();

        return ActionPlan::firstOrCreate(
            ['student_id' => $request->user()->id, 'period_start' => $start],
            [
                'period_end' => now()->endOfMonth()->toDateString(),
                'status' => 'active',
            ],
        )->load('targets', 'evaluation');
    }

    private function planPayload(ActionPlan $plan): array
    {
        return [
            'id' => $plan->id,
            'period_start' => $plan->period_start->toDateString(),
            'period_end' => $plan->period_end->toDateString(),
            'status' => $plan->status,
            'targets' => $plan->targets->map(fn ($t) => [
                'id' => $t->id,
                'title' => $t->title,
                'success_indicator' => $t->success_indicator,
                'status' => $t->status,
                'progress_note' => $t->progress_note,
                'sort_order' => $t->sort_order,
            ])->all(),
            'evaluation' => $plan->evaluation ? [
                'snapshot' => $plan->evaluation->snapshot,
                'evaluation_text' => $plan->evaluation->evaluation_text,
                'improvement_text' => $plan->evaluation->improvement_text,
            ] : null,
        ];
    }
}
