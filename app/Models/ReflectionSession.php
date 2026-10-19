<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ReflectionSession extends Model
{
    protected $fillable = [
        'counselor_id',
        'class_id',
        'student_id',
        'topic',
        'instructions',
        'questions',
        'due_at',
        'status',
        'extended_at',
        'extension_reason',
    ];

    protected function casts(): array
    {
        return [
            'questions' => 'array',
            'due_at' => 'datetime',
            'extended_at' => 'datetime',
        ];
    }

    public function counselor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'counselor_id');
    }

    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class, 'class_id');
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function reflections(): HasMany
    {
        return $this->hasMany(Reflection::class, 'session_id');
    }
}
