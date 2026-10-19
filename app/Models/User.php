<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    use HasFactory, Notifiable;

    public const ROLE_STUDENT = 'student';
    public const ROLE_COUNSELOR = 'counselor';
    public const ROLE_SUPERADMIN = 'superadmin';

    protected $fillable = [
        'name',
        'email',
        'identity_number',
        'password',
        'role',
        'status',
        'must_change_password',
        'consent_version',
        'consented_at',
        'last_login_at',
        'last_activity_at',
        'deactivated_at',
        'anonymized_at',
        'mood_reminder_enabled',
        'mood_reminder_hour',
        'reflection_reminder_enabled',
        'notification_channel',
        'two_factor_secret',
        'two_factor_recovery_codes',
        'two_factor_confirmed_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'two_factor_secret',
        'two_factor_recovery_codes',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'must_change_password' => 'boolean',
            'consented_at' => 'datetime',
            'last_login_at' => 'datetime',
            'last_activity_at' => 'datetime',
            'deactivated_at' => 'datetime',
            'anonymized_at' => 'datetime',
            'mood_reminder_enabled' => 'boolean',
            'mood_reminder_hour' => 'integer',
            'reflection_reminder_enabled' => 'boolean',
            'two_factor_confirmed_at' => 'datetime',
        ];
    }

    public function isStudent(): bool
    {
        return $this->role === self::ROLE_STUDENT;
    }

    public function isCounselor(): bool
    {
        return $this->role === self::ROLE_COUNSELOR;
    }

    public function isSuperadmin(): bool
    {
        return $this->role === self::ROLE_SUPERADMIN;
    }

    public function hasConsent(): bool
    {
        return $this->consent_version !== null && $this->consented_at !== null;
    }

    public function requiresTwoFactor(): bool
    {
        return $this->isSuperadmin();
    }

    public function profile(): HasOne
    {
        return $this->hasOne(StudentProfile::class);
    }

    public function moods(): HasMany
    {
        return $this->hasMany(MoodEntry::class, 'student_id');
    }

    public function journals(): HasMany
    {
        return $this->hasMany(JournalEntry::class, 'student_id');
    }

    public function achievements(): HasMany
    {
        return $this->hasMany(Achievement::class, 'student_id');
    }

    public function reflections(): HasMany
    {
        return $this->hasMany(Reflection::class, 'student_id');
    }

    public function actionPlans(): HasMany
    {
        return $this->hasMany(ActionPlan::class, 'student_id');
    }

    public function futurePlan(): HasOne
    {
        return $this->hasOne(FuturePlan::class, 'student_id');
    }

    public function counselingNotes(): HasMany
    {
        return $this->hasMany(CounselingNote::class, 'student_id');
    }

    public function alerts(): HasMany
    {
        return $this->hasMany(Alert::class, 'student_id');
    }

    public function classMemberships(): HasMany
    {
        return $this->hasMany(ClassStudent::class, 'student_id');
    }

    public function counselorAssignments(): HasMany
    {
        return $this->hasMany(CounselorClass::class, 'counselor_id');
    }

    public function activeClass(): ?SchoolClass
    {
        $membership = $this->classMemberships()
            ->with('schoolClass')
            ->where('status', 'active')
            ->latest('id')
            ->first();

        return $membership?->schoolClass;
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }
}
