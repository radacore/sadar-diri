<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class ActionPlan extends Model
{
    protected $fillable = ['student_id', 'period_start', 'period_end', 'status'];

    protected function casts(): array
    {
        return [
            'period_start' => 'date',
            'period_end' => 'date',
        ];
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function targets(): HasMany
    {
        return $this->hasMany(ActionTarget::class)->orderBy('sort_order');
    }

    public function evaluation(): HasOne
    {
        return $this->hasOne(ActionEvaluation::class);
    }
}
