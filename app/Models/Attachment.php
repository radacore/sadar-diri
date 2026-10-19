<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\URL;

class Attachment extends Model
{
    protected $fillable = [
        'achievement_id',
        'uploaded_by',
        'disk',
        'path',
        'original_name',
        'mime_type',
        'size_bytes',
        'checksum',
    ];

    protected function casts(): array
    {
        return ['size_bytes' => 'integer'];
    }

    public function achievement(): BelongsTo
    {
        return $this->belongsTo(Achievement::class);
    }

    public function signedUrl(int $minutes = 15): string
    {
        return URL::temporarySignedRoute('attachments.show', now()->addMinutes($minutes), ['attachment' => $this->id]);
    }
}
