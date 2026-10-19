<?php

namespace App\Services;

use App\Models\SchoolClass;
use App\Models\User;

class AccessScope
{
    /**
     * Counselor may access a student who is, or was, in one of their assigned classes.
     */
    public function counselorCanAccess(User $counselor, User $student): bool
    {
        if (! $counselor->isCounselor() || ! $student->isStudent()) {
            return false;
        }

        $classIds = $counselor->counselorAssignments()->pluck('class_id');

        if ($classIds->isEmpty()) {
            return false;
        }

        return $student->classMemberships()
            ->whereIn('class_id', $classIds)
            ->exists();
    }

    public function counselorClassIds(User $counselor): array
    {
        return $counselor->counselorAssignments()->pluck('class_id')->all();
    }

    public function counselorStudentIds(User $counselor): array
    {
        $classIds = $this->counselorClassIds($counselor);

        if ($classIds === []) {
            return [];
        }

        return \App\Models\ClassStudent::query()
            ->whereIn('class_id', $classIds)
            ->where('status', 'active')
            ->pluck('student_id')
            ->unique()
            ->values()
            ->all();
    }

    public function studentClass(User $student): ?SchoolClass
    {
        return $student->activeClass();
    }
}
