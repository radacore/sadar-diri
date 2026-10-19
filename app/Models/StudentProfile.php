<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StudentProfile extends Model
{
    protected $fillable = [
        'user_id',
        'birth_date',
        'gender',
        'address',
        'phone',
        'height_cm',
        'weight_kg',
        'blood_type',
        'medical_history',
        'health_notes',
        'psychological_summary',
        'character_summary',
        'strengths',
        'weaknesses',
        'completeness_percent',
        'published_at',
        'version',
    ];

    protected function casts(): array
    {
        return [
            'birth_date' => 'date',
            'published_at' => 'datetime',
            'medical_history' => 'encrypted',
            'health_notes' => 'encrypted',
            'psychological_summary' => 'encrypted',
            'character_summary' => 'encrypted',
            'strengths' => 'encrypted',
            'weaknesses' => 'encrypted',
            'completeness_percent' => 'integer',
            'version' => 'integer',
        ];
    }

    public function completeness(): int
    {
        $fields = [
            'birth_date', 'gender', 'address', 'phone', 'height_cm', 'weight_kg',
            'blood_type', 'medical_history', 'health_notes',
            'psychological_summary', 'character_summary', 'strengths', 'weaknesses',
        ];

        $filled = collect($fields)->filter(fn ($field) => ! blank($this->{$field}))->count();

        return (int) round($filled / count($fields) * 100);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
