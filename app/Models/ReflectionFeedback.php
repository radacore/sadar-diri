<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReflectionFeedback extends Model
{
    protected $table = 'reflection_feedbacks';

    protected $fillable = ['reflection_id', 'counselor_id', 'content', 'version'];

    protected function casts(): array
    {
        return ['content' => 'encrypted', 'version' => 'integer'];
    }

    public function reflection(): BelongsTo
    {
        return $this->belongsTo(Reflection::class);
    }

    public function counselor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'counselor_id');
    }
}
