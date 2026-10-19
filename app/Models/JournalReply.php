<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class JournalReply extends Model
{
    protected $fillable = [
        'journal_entry_id',
        'counselor_id',
        'content',
    ];

    protected function casts(): array
    {
        return [
            'content' => 'encrypted',
        ];
    }

    public function entry(): BelongsTo
    {
        return $this->belongsTo(JournalEntry::class, 'journal_entry_id');
    }

    public function counselor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'counselor_id');
    }
}
