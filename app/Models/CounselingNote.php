<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CounselingNote extends Model
{
    protected $fillable = [
        'student_id',
        'counselor_id',
        'title',
        'occurred_at',
        'summary',
        'content',
        'status',
        'is_sensitive',
        'visible_to_student',
    ];

    protected function casts(): array
    {
        return [
            'occurred_at' => 'datetime',
            'content' => 'encrypted',
            'is_sensitive' => 'boolean',
            'visible_to_student' => 'boolean',
        ];
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function counselor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'counselor_id');
    }

    public function versions(): HasMany
    {
        return $this->hasMany(CounselingNoteVersion::class);
    }
}
