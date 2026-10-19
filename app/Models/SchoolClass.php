<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SchoolClass extends Model
{
    protected $table = 'classes';

    protected $fillable = [
        'academic_year_id',
        'name',
        'level',
        'homeroom_teacher_name',
        'is_active',
    ];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function academicYear(): BelongsTo
    {
        return $this->belongsTo(AcademicYear::class);
    }

    public function memberships(): HasMany
    {
        return $this->hasMany(ClassStudent::class, 'class_id');
    }

    public function activeMemberships(): HasMany
    {
        return $this->memberships()->where('status', 'active');
    }

    public function counselorAssignments(): HasMany
    {
        return $this->hasMany(CounselorClass::class, 'class_id');
    }

    public function counselors(): HasMany
    {
        return $this->counselorAssignments();
    }
}
