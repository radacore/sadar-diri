<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\EmailOtpService;
use App\Services\SettingsService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PageController extends Controller
{
    public function __construct(private readonly SettingsService $settings) {}

    public function home()
    {
        $user = auth()->user();

        if ($user?->must_change_password) {
            return redirect('/ganti-sandi');
        }

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

    public function twoFactorChallenge(Request $request)
    {
        $user = $request->user();
        $email = (string) $user?->email;

        return Inertia::render('Auth/TwoFactor', [
            'mode' => 'challenge',
            'maskedEmail' => $email && str_contains($email, '@') ? $this->maskEmail($email) : null,
            'resendSeconds' => $user ? app(EmailOtpService::class)->secondsUntilResend($user) : 0,
        ]);
    }

    private function maskEmail(string $email): string
    {
        [$name, $domain] = explode('@', $email, 2);

        return mb_substr($name, 0, 2).str_repeat('•', max(1, mb_strlen($name) - 2)).'@'.$domain;
    }

    public function consent()
    {
        return Inertia::render('Onboarding/Consent', [
            'version' => $this->settings->get('privacy.consent_version', '2026-08-01'),
        ]);
    }

    public function changePassword()
    {
        return Inertia::render('Auth/ChangePassword', [
            'identityNumber' => auth()->user()?->identity_number,
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
