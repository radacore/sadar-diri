<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ActionTarget extends Model
{
    protected $fillable = [
        'action_plan_id',
        'title',
        'success_indicator',
        'status',
        'progress_note',
        'sort_order',
    ];

    public function plan(): BelongsTo
    {
        return $this->belongsTo(ActionPlan::class, 'action_plan_id');
    }
}
