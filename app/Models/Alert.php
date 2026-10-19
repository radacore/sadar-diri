<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Alert extends Model
{
    protected $fillable = [
        'student_id',
        'trigger_type',
        'severity',
        'status',
        'detected_at',
        'handled_by',
        'handled_at',
        'resolution_note',
        'dedupe_key',
    ];

    protected function casts(): array
    {
        return [
            'detected_at' => 'datetime',
            'handled_at' => 'datetime',
        ];
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function handler(): BelongsTo
    {
        return $this->belongsTo(User::class, 'handled_by');
    }

    public function label(): string
    {
        return match ($this->trigger_type) {
            'mood_low_streak' => 'Mood negatif berturut-turut',
            'risk_keyword' => 'Kata kunci risiko pada curhat',
            'inactivity' => 'Tidak aktif 14 hari',
            'reflection_overdue' => 'Refleksi terbimbing lewat tenggat',
        };
    }
}
