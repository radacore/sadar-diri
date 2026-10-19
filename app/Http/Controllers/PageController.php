<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\SettingsService;
use Inertia\Inertia;
use Inertia\Response;

class PageController extends Controller
{
    public function __construct(private readonly SettingsService $settings) {}

    public function home()
    {
        $user = auth()->user();

        return match ($user?->role) {
            'student' => redirect('/siswa/beranda'),
            'counselor' => redirect('/bk/dashboard'),
            'superadmin' => redirect('/admin/dashboard'),
            default => redirect('/masuk'),
        };
    }

    public function login()
    {
        return Inertia::render('Auth/Login', [
            'school' => $this->settings->school(),
        ]);
    }

    public function forgot()
    {
        return Inertia::render('Auth/Forgot');
    }

    public function reset()
    {
        return Inertia::render('Auth/Reset');
    }

    public function twoFactorChallenge()
    {
        return Inertia::render('Auth/TwoFactor', [
            'mode' => 'challenge',
        ]);
    }

    public function twoFactorEnroll()
    {
        return Inertia::render('Auth/TwoFactor', [
            'mode' => 'enroll',
        ]);
    }

    public function consent()
    {
        return Inertia::render('Onboarding/Consent', [
            'version' => $this->settings->get('privacy.consent_version', '2026-08-01'),
        ]);
    }

    public function student(string $page): Response
    {
        return Inertia::render('Student/'.ucfirst($page));
    }

    public function counselor(string $page, ?User $student = null): Response
    {
        return Inertia::render('Counselor/'.ucfirst($page), [
            'studentId' => $student?->id,
        ]);
    }

    public function admin(string $page): Response
    {
        return Inertia::render('Admin/'.ucfirst($page));
    }
}
