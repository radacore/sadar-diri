<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Reflection extends Model
{
    protected $fillable = [
        'student_id',
        'session_id',
        'type',
        'week_start',
        'positive_experience',
        'negative_experience',
        'answers',
        'status',
        'submitted_at',
    ];

    protected function casts(): array
    {
        return [
            'week_start' => 'date',
            'positive_experience' => 'encrypted',
            'negative_experience' => 'encrypted',
            'answers' => 'encrypted:array',
            'submitted_at' => 'datetime',
        ];
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(ReflectionSession::class, 'session_id');
    }

    public function feedbacks(): HasMany
    {
        return $this->hasMany(ReflectionFeedback::class);
    }

    public function latestFeedback(): ?ReflectionFeedback
    {
        return $this->feedbacks()->latest('id')->first();
    }
}
