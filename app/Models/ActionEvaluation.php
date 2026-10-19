<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ActionEvaluation extends Model
{
    protected $fillable = ['action_plan_id', 'snapshot', 'evaluation_text', 'improvement_text'];

    protected function casts(): array
    {
        return [
            'snapshot' => 'array',
            'evaluation_text' => 'encrypted',
            'improvement_text' => 'encrypted',
        ];
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(ActionPlan::class, 'action_plan_id');
    }
}
