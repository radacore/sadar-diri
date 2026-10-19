<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;

class AuditLogger
{
    public function __construct(private readonly Request $request) {}

    public function record(
        string $action,
        ?string $entityType = null,
        ?int $entityId = null,
        ?int $subjectUserId = null,
        ?string $reason = null,
        array $metadata = [],
        ?User $actor = null,
    ): AuditLog {
        $actor ??= $this->request->user();

        return AuditLog::create([
            'actor_id' => $actor?->id,
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'subject_user_id' => $subjectUserId,
            'reason' => $reason,
            'ip_address' => $this->request->ip(),
            'user_agent' => substr((string) $this->request->userAgent(), 0, 500),
            'metadata' => $metadata ?: null,
            'created_at' => now(),
        ]);
    }
}
