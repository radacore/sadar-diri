<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FuturePlanVersion extends Model
{
    public $timestamps = false;

    protected $fillable = ['future_plan_id', 'version', 'snapshot', 'created_at'];

    protected function casts(): array
    {
        return ['snapshot' => 'array', 'created_at' => 'datetime'];
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(FuturePlan::class, 'future_plan_id');
    }
}
