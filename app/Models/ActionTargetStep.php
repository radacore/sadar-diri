<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ActionTargetStep extends Model
{
    protected $fillable = [
        'action_target_id',
        'title',
        'is_done',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'is_done' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function target(): BelongsTo
    {
        return $this->belongsTo(ActionTarget::class, 'action_target_id');
    }
}
