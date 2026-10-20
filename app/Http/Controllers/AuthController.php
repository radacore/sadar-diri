<?php

namespace App\Http\Controllers;

use App\Mail\PasswordResetMail;
use App\Models\ConsentRecord;
use App\Models\LoginAttempt;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\EmailOtpService;
use App\Services\SettingsService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Throwable;

class AuthController extends Controller
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly EmailOtpService $otp,
    ) {}

    public function login(Request $request)
    {
        $data = $request->validate([
            'identity' => ['required', 'string', 'max:190'],
            'password' => ['required', 'string'],
            'remember' => ['boolean'],
        ]);

        $key = 'login:'.strtolower($data['identity']).'|'.$request->ip();

        if (RateLimiter::tooManyAttempts($key, 5)) {
            return response()->json([
                'success' => false,
                'error' => 'TOO_MANY_REQUESTS',
                'message' => 'Terlalu banyak percobaan. Coba lagi dalam satu menit.',
            ], 429);
        }

        $user = User::query()
            ->where('email', $data['identity'])
            ->orWhere('identity_number', $data['identity'])
            ->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            RateLimiter::hit($key, 60);
            LoginAttempt::create([
                'identity' => $data['identity'],
                'ip_address' => $request->ip(),
                'successful' => false,
                'attempted_at' => now(),
            ]);

            return response()->json([
                'success' => false,
                'error' => 'INVALID_CREDENTIALS',
                'message' => 'Identitas atau kata sandi salah.',
            ], 401);
        }

        if (! in_array($user->status, ['active'], true)) {
            LoginAttempt::create([
                'identity' => $data['identity'],
                'ip_address' => $request->ip(),
                'successful' => false,
                'attempted_at' => now(),
            ]);

            $message = $user->status === 'pending'
                ? 'Akun belum diaktivasi. Hubungi admin sekolah.'
                : 'Akun tidak aktif. Hubungi Guru BK atau admin sekolah.';

            return response()->json([
                'success' => false,
                'error' => $user->status === 'pending' ? 'ACCOUNT_PENDING' : 'ACCOUNT_INACTIVE',
                'message' => $message,
            ], 403);
        }

        RateLimiter::clear($key);

        Auth::login($user, (bool) ($data['remember'] ?? false));
        $request->session()->regenerate();
        $request->session()->forget('two_factor_passed');

        $user->forceFill([
            'last_login_at' => now(),
            'last_activity_at' => now(),
        ])->save();

        LoginAttempt::create([
            'identity' => $data['identity'],
            'ip_address' => $request->ip(),
            'successful' => true,
            'attempted_at' => now(),
        ]);

        $this->audit->record('auth.login', 'users', $user->id, $user->id, null, [], $user);

        if ($user->requiresTwoFactor()) {
            if (! $user->email) {
                Auth::logout();

                return response()->json([
                    'success' => false,
                    'error' => 'EMAIL_REQUIRED',
                    'message' => 'Akun admin belum memiliki email. Hubungi pengelola sistem.',
                ], 403);
            }

            $sent = $this->sendOtp($user, $request);

            return response()->json([
                'success' => true,
                'data' => [
                    'user' => $this->userPayload($user),
                    'redirect_to' => '/2fa/challenge',
                    'two_factor_required' => true,
                    'otp_sent' => $sent,
                    'otp_email' => $this->maskedEmail($user->email),
                ],
                'message' => $sent
                    ? 'Kode verifikasi dikirim ke email Anda.'
                    : 'Kode gagal dikirim. Periksa konfigurasi email atau hubungi admin.',
            ]);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'user' => $this->userPayload($user),
                'redirect_to' => $this->redirectFor($user),
                'two_factor_required' => false,
            ],
            'message' => 'Login berhasil',
        ]);
    }

    public function logout(Request $request)
    {
        $user = $request->user();
        $this->audit->record('auth.logout', 'users', $user?->id, $user?->id);

        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['success' => true, 'data' => null, 'message' => 'Logout berhasil']);
    }

    public function me(Request $request)
    {
        $user = $request->user()->load('profile');
        $class = $user->activeClass();

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'identity_number' => $user->identity_number,
                'role' => $user->role,
                'status' => $user->status,
                'consent_version' => $user->consent_version,
                'consented_at' => $user->consented_at?->toIso8601String(),
                'must_change_password' => $user->must_change_password,
                'class' => $class ? ['id' => $class->id, 'name' => $class->name] : null,
                'permissions' => $this->permissionsFor($user),
            ],
        ]);
    }

    public function forgotPassword(Request $request)
    {
        $data = $request->validate(['email' => ['required', 'email']]);

        $user = User::firstWhere('email', $data['email']);

        if ($user?->email) {
            $token = app('auth.password.broker')->createToken($user);
            $url = url('/reset-password?token='.$token.'&email='.urlencode($user->email));

            try {
                Mail::to($user->email)->send(new PasswordResetMail($user, $url, config('auth.passwords.users.expire', 30)));
            } catch (Throwable $e) {
                Log::error('Gagal mengirim tautan reset kata sandi.', ['user_id' => $user->id, 'error' => $e->getMessage()]);
            }
        }

        return response()->json([
            'success' => true,
            'data' => null,
            'message' => 'Jika email terdaftar, tautan reset telah dikirim.',
        ]);
    }

    public function resetPassword(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => ['required', 'email'],
            'token' => ['required', 'string'],
            'password' => ['required', 'string', 'min:10', 'regex:/[a-z]/', 'regex:/[A-Z]/', 'regex:/[0-9]/'],
            'password_confirmation' => ['required', 'string', 'same:password'],
        ], [
            'email.required' => 'Email wajib diisi.',
            'email.email' => 'Format email tidak valid.',
            'token.required' => 'Tautan reset tidak lengkap. Buka kembali tautan dari email Anda.',
            'password.required' => 'Kata sandi baru wajib diisi.',
            'password.min' => 'Kata sandi minimal 10 karakter.',
            'password.regex' => 'Kata sandi harus memuat huruf besar, huruf kecil, dan angka.',
            'password_confirmation.required' => 'Ulangi kata sandi baru Anda.',
            'password_confirmation.same' => 'Konfirmasi kata sandi tidak sama dengan kata sandi baru.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'VALIDATION_ERROR',
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors()->toArray(),
            ], 422);
        }

        $data = $validator->validated();

        $status = app('auth.password.broker')->reset(
            $data,
            function (User $user, string $password) {
                $user->forceFill(['password' => $password, 'must_change_password' => false])->save();
                $this->audit->record('auth.password_reset', 'users', $user->id, $user->id, null, [], $user);
            },
        );

        if ($status !== \Illuminate\Auth\Passwords\PasswordBroker::PASSWORD_RESET) {
            return response()->json([
                'success' => false,
                'error' => 'INVALID_TOKEN',
                'message' => 'Tautan reset tidak valid atau sudah kedaluwarsa.',
            ], 410);
        }

        return response()->json(['success' => true, 'data' => null, 'message' => 'Kata sandi berhasil diperbarui']);
    }

    public function updatePassword(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:10', 'regex:/[a-z]/', 'regex:/[A-Z]/', 'regex:/[0-9]/', 'confirmed'],
        ], [
            'current_password.required' => 'Kata sandi saat ini wajib diisi.',
            'password.required' => 'Kata sandi baru wajib diisi.',
            'password.min' => 'Kata sandi minimal 10 karakter.',
            'password.regex' => 'Kata sandi harus memuat huruf besar, huruf kecil, dan angka.',
            'password.confirmed' => 'Konfirmasi kata sandi tidak sama dengan kata sandi baru.',
        ]);

        if (! Hash::check($data['current_password'], $user->password)) {
            return response()->json([
                'success' => false,
                'error' => 'INVALID_PASSWORD',
                'message' => 'Kata sandi saat ini tidak sesuai.',
                'errors' => ['current_password' => ['Kata sandi saat ini tidak sesuai.']],
            ], 422);
        }

        if (Hash::check($data['password'], $user->password)) {
            return response()->json([
                'success' => false,
                'error' => 'SAME_PASSWORD',
                'message' => 'Kata sandi baru tidak boleh sama dengan kata sandi sebelumnya.',
                'errors' => ['password' => ['Gunakan kata sandi yang berbeda dari kata sandi awal.']],
            ], 422);
        }

        $user->forceFill([
            'password' => $data['password'],
            'must_change_password' => false,
        ])->save();

        $this->audit->record('auth.password_changed', 'users', $user->id, $user->id, null, [], $user);

        return response()->json([
            'success' => true,
            'data' => ['redirect_to' => $this->redirectFor($user)],
            'message' => 'Kata sandi diperbarui.',
        ]);
    }

    public function consent(Request $request)
    {
        $data = $request->validate([
            'version' => ['required', 'string'],
            'accepted' => ['required', 'accepted'],
        ]);

        $user = $request->user();

        ConsentRecord::create([
            'user_id' => $user->id,
            'version' => $data['version'],
            'accepted_at' => now(),
            'ip_address' => $request->ip(),
            'user_agent' => substr((string) $request->userAgent(), 0, 500),
        ]);

        $user->forceFill([
            'consent_version' => $data['version'],
            'consented_at' => now(),
        ])->save();

        $this->audit->record('consent.accepted', 'consent_records', null, $user->id, null, ['version' => $data['version']], $user);

        return response()->json([
            'success' => true,
            'data' => [
                'consent_version' => $user->consent_version,
                'consented_at' => $user->consented_at?->toIso8601String(),
            ],
            'message' => 'Persetujuan tercatat',
        ]);
    }

    public function revokeConsent(Request $request)
    {
        $user = $request->user();

        ConsentRecord::query()
            ->where('user_id', $user->id)
            ->whereNull('revoked_at')
            ->update(['revoked_at' => now()]);

        $user->forceFill(['consent_version' => null, 'consented_at' => null])->save();

        $this->audit->record('consent.revoked', 'consent_records', null, $user->id, 'Pencabutan oleh siswa', [], $user);

        return response()->json(['success' => true, 'data' => null, 'message' => 'Persetujuan dicabut']);
    }

    public function resendOtp(Request $request)
    {
        $user = $request->user();

        if (! $user || ! $user->requiresTwoFactor()) {
            return response()->json(['success' => false, 'error' => 'FORBIDDEN', 'message' => 'Tidak tersedia untuk akun ini.'], 403);
        }

        if ($request->session()->get('two_factor_passed')) {
            return response()->json(['success' => true, 'data' => ['redirect_to' => $this->redirectFor($user)]]);
        }

        $wait = $this->otp->secondsUntilResend($user);

        if ($wait > 0) {
            return response()->json([
                'success' => false,
                'error' => 'RESEND_COOLDOWN',
                'message' => "Tunggu {$wait} detik sebelum meminta kode baru.",
                'data' => ['retry_after' => $wait],
            ], 429);
        }

        $sent = $this->sendOtp($user, $request);

        return response()->json([
            'success' => $sent,
            'error' => $sent ? null : 'MAIL_FAILED',
            'data' => ['retry_after' => EmailOtpService::RESEND_SECONDS, 'otp_email' => $this->maskedEmail($user->email)],
            'message' => $sent ? 'Kode baru dikirim ke email Anda.' : 'Kode gagal dikirim. Coba lagi nanti.',
        ], $sent ? 200 : 502);
    }

    public function verifyTwoFactor(Request $request)
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'digits:6'],
        ]);

        $user = $request->user();

        if (! $user) {
            return response()->json(['success' => false, 'error' => 'UNAUTHENTICATED', 'message' => 'Sesi tidak ditemukan.'], 401);
        }

        $key = 'otp:'.$user->id;

        if (RateLimiter::tooManyAttempts($key, 5)) {
            Auth::logout();

            return response()->json(['success' => false, 'error' => 'TOO_MANY_REQUESTS', 'message' => 'Terlalu banyak percobaan. Silakan masuk kembali.'], 429);
        }

        if (! $this->otp->verify($user, $data['code'])) {
            RateLimiter::hit($key, 300);

            return response()->json(['success' => false, 'error' => 'INVALID_CODE', 'message' => 'Kode salah atau sudah kedaluwarsa.'], 422);
        }

        RateLimiter::clear($key);
        $request->session()->put('two_factor_passed', true);
        $this->audit->record('auth.otp_verified', 'users', $user->id, $user->id, null, [], $user);

        return response()->json([
            'success' => true,
            'data' => ['redirect_to' => $this->redirectFor($user)],
            'message' => 'Verifikasi berhasil',
        ]);
    }

    private function sendOtp(User $user, Request $request): bool
    {
        try {
            $this->otp->issue($user, $request->ip());

            return true;
        } catch (Throwable $e) {
            Log::error('Gagal mengirim kode OTP.', ['user_id' => $user->id, 'error' => $e->getMessage()]);

            return false;
        }
    }

    private function maskedEmail(?string $email): ?string
    {
        if (! $email || ! str_contains($email, '@')) {
            return null;
        }

        [$name, $domain] = explode('@', $email, 2);

        return mb_substr($name, 0, 2).str_repeat('•', max(1, mb_strlen($name) - 2)).'@'.$domain;
    }

    private function redirectFor(User $user): string
    {
        if ($user->must_change_password) {
            return '/ganti-sandi';
        }

        return match ($user->role) {
            'student' => '/siswa/beranda',
            'counselor' => '/bk/dashboard',
            default => '/admin/dashboard',
        };
    }

    private function userPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'role' => $user->role,
            'status' => $user->status,
            'must_change_password' => $user->must_change_password,
            'two_factor_required' => $user->requiresTwoFactor(),
        ];
    }

    private function permissionsFor(User $user): array
    {
        return match ($user->role) {
            'student' => ['journal.create', 'portfolio.manage', 'reflection.manage', 'actionplan.manage'],
            'counselor' => ['students.view', 'alerts.manage', 'notes.manage', 'reports.view'],
            default => ['users.manage', 'classes.manage', 'content.manage', 'settings.manage', 'audit.view'],
        };
    }
}
