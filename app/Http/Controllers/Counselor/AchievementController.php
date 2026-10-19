<?php

namespace App\Http\Controllers\Counselor;

use App\Http\Controllers\Controller;
use App\Models\Achievement;
use App\Services\AccessScope;
use App\Services\AuditLogger;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AchievementController extends Controller
{
    public function __construct(
        private readonly AccessScope $access,
        private readonly AuditLogger $audit,
        private readonly NotificationService $notifications,
    ) {}

    public function verify(Request $request, Achievement $achievement)
    {
        if (! $this->access->counselorCanAccess($request->user(), $achievement->student)) {
            $this->audit->record('access.denied', 'achievements', $achievement->id, $achievement->student_id);
            abort(response()->json(['success' => false, 'error' => 'FORBIDDEN', 'message' => 'Anda tidak memiliki akses ke prestasi ini'], 403));
        }

        $data = $request->validate([
            'status' => ['required', Rule::in(['verified', 'rejected'])],
            'rejection_reason' => ['nullable', 'string', 'max:1000', 'required_if:status,rejected'],
        ]);

        $achievement->fill([
            'verification_status' => $data['status'],
            'verified_by' => $request->user()->id,
            'verified_at' => now(),
            'rejection_reason' => $data['rejection_reason'] ?? null,
        ])->save();

        $this->notifications->achievementVerified($achievement->student, $achievement->title, $data['status']);
        $this->audit->record('achievement.verified', 'achievements', $achievement->id, $achievement->student_id, $data['rejection_reason'] ?? null, [
            'status' => $data['status'],
        ]);

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $achievement->id,
                'verification_status' => $achievement->verification_status,
                'verified_by' => $achievement->verified_by,
                'verified_at' => $achievement->verified_at?->toIso8601String(),
            ],
        ]);
    }

    public function pending(Request $request)
    {
        $studentIds = $this->access->counselorStudentIds($request->user());

        $items = Achievement::query()
            ->whereIn('student_id', $studentIds)
            ->where('verification_status', 'pending')
            ->with('student')
            ->withCount('attachments')
            ->orderBy('achieved_at')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $items->map(fn ($a) => [
                'id' => $a->id,
                'student' => ['id' => $a->student->id, 'name' => $a->student->name],
                'title' => $a->title,
                'category' => $a->category,
                'level' => $a->level,
                'achieved_at' => $a->achieved_at->toDateString(),
                'attachments_count' => $a->attachments_count,
                'attachments' => $a->attachments->map(fn ($att) => [
                    'id' => $att->id,
                    'original_name' => $att->original_name,
                    'url' => $att->signedUrl(),
                ])->all(),
            ]),
        ]);
    }
}
