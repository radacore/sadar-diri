<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ActionTarget extends Model
{
    protected $fillable = [
        'action_plan_id',
        'title',
        'success_indicator',
        'basis',
        'status',
        'progress_note',
        'sort_order',
    ];

    public function plan(): BelongsTo
    {
        return $this->belongsTo(ActionPlan::class, 'action_plan_id');
    }

    public function steps(): HasMany
    {
        return $this->hasMany(ActionTargetStep::class)->orderBy('sort_order');
    }
}
