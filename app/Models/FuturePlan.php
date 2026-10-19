<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FuturePlan extends Model
{
    protected $fillable = ['student_id', 'dream', 'career_plan', 'education_plan', 'concrete_targets'];

    protected function casts(): array
    {
        return [
            'dream' => 'encrypted',
            'career_plan' => 'encrypted',
            'education_plan' => 'encrypted',
            'concrete_targets' => 'encrypted',
        ];
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function versions(): HasMany
    {
        return $this->hasMany(FuturePlanVersion::class);
    }
}
