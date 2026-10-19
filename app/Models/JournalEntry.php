<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class JournalEntry extends Model
{
    protected $fillable = [
        'student_id',
        'type',
        'entry_date',
        'prompt_content_id',
        'activating_event',
        'belief',
        'consequence',
        'gratitude_text',
        'happiness_text',
        'status',
        'is_flagged',
        'flagged_at',
    ];

    protected function casts(): array
    {
        return [
            'entry_date' => 'date',
            'activating_event' => 'encrypted',
            'belief' => 'encrypted',
            'consequence' => 'encrypted',
            'gratitude_text' => 'encrypted',
            'happiness_text' => 'encrypted',
            'is_flagged' => 'boolean',
            'flagged_at' => 'datetime',
        ];
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function prompt(): BelongsTo
    {
        return $this->belongsTo(ContentItem::class, 'prompt_content_id');
    }

    public function excerpt(int $length = 120): string
    {
        $text = $this->type === 'abc'
            ? (string) $this->activating_event
            : (string) ($this->gratitude_text ?? $this->happiness_text);

        return \Illuminate\Support\Str::limit($text, $length);
    }
}
