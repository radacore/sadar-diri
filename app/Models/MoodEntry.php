<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MoodEntry extends Model
{
    protected $fillable = ['student_id', 'entry_date', 'valence', 'intensity', 'emotion_tags', 'note'];

    protected function casts(): array
    {
        return [
            'entry_date' => 'date',
            'emotion_tags' => 'array',
            'intensity' => 'integer',
        ];
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_id');
    }
}
