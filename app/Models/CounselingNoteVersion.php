<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CounselingNoteVersion extends Model
{
    public $timestamps = false;

    protected $fillable = ['counseling_note_id', 'version', 'snapshot', 'changed_by', 'created_at'];

    protected function casts(): array
    {
        return ['snapshot' => 'array', 'created_at' => 'datetime'];
    }

    public function note(): BelongsTo
    {
        return $this->belongsTo(CounselingNote::class, 'counseling_note_id');
    }
}
