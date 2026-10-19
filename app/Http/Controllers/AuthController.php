<?php

namespace App\Http\Controllers;

use App\Models\ConsentRecord;
use App\Models\LoginAttempt;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\SettingsService;
use App\Services\TotpService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly TotpService $totp,
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
                ? 'Akun belum diaktivasi. Buka tautan undangan di email Anda.'
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
            if (! $user->two_factor_confirmed_at) {
                return response()->json([
                    'success' => true,
                    'data' => [
                        'user' => $this->userPayload($user),
                        'redirect_to' => '/2fa/enroll',
                        'two_factor_required' => true,
                    ],
                    'message' => 'Aktifkan verifikasi dua faktor untuk melanjutkan.',
                ]);
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'user' => $this->userPayload($user),
                    'redirect_to' => '/2fa/challenge',
                    'two_factor_required' => true,
                ],
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
                'two_factor_confirmed' => $user->two_factor_confirmed_at !== null,
                'class' => $class ? ['id' => $class->id, 'name' => $class->name] : null,
                'permissions' => $this->permissionsFor($user),
            ],
        ]);
    }

    public function forgotPassword(Request $request)
    {
        $data = $request->validate(['email' => ['required', 'email']]);

        $user = User::firstWhere('email', $data['email']);

        if ($user) {
            $token = app('auth.password.broker')->createToken($user);
            $url = url('/reset-password?token='.$token.'&email='.urlencode($user->email));

            \Illuminate\Support\Facades\Mail::raw(
                "Halo {$user->name},\n\nGunakan tautan berikut untuk mengatur ulang kata sandi Anda (berlaku 30 menit):\n{$url}\n\nJika Anda tidak meminta ini, abaikan email ini.",
                fn ($message) => $message->to($user->email)->subject('Reset kata sandi SADAR DIRI'),
            );
        }

        return response()->json([
            'success' => true,
            'data' => null,
            'message' => 'Jika email terdaftar, tautan reset telah dikirim.',
        ]);
    }

    public function resetPassword(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'token' => ['required', 'string'],
            'password' => ['required', 'string', 'min:10', 'regex:/[a-z]/', 'regex:/[A-Z]/', 'regex:/[0-9]/', 'confirmed'],
        ]);

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

    public function activationForm(Request $request, User $user)
    {
        return \Inertia\Inertia::render('Auth/Activate', [
            'userId' => $user->id,
            'name' => $user->name,
            'signature' => $request->query('signature'),
            'expires' => $request->query('expires'),
        ]);
    }

    public function activate(Request $request)
    {
        $data = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'password' => ['required', 'string', 'min:10', 'regex:/[a-z]/', 'regex:/[A-Z]/', 'regex:/[0-9]/', 'confirmed'],
        ]);

        $user = User::findOrFail($data['user_id']);

        if (! $request->hasValidSignature()) {
            return response()->json([
                'success' => false,
                'error' => 'INVALID_SIGNATURE',
                'message' => 'Tautan aktivasi tidak valid atau kedaluwarsa.',
            ], 410);
        }

        $user->forceFill([
            'password' => $data['password'],
            'status' => 'active',
            'must_change_password' => false,
            'email_verified_at' => now(),
        ])->save();

        $this->audit->record('auth.activated', 'users', $user->id, $user->id, null, [], $user);

        return response()->json([
            'success' => true,
            'data' => ['redirect_to' => '/masuk'],
            'message' => 'Akun berhasil diaktifkan',
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

    public function enrollTwoFactor(Request $request)
    {
        $user = $request->user();

        if ($user->two_factor_confirmed_at) {
            return response()->json(['success' => false, 'error' => 'ALREADY_ENROLLED', 'message' => '2FA sudah aktif.'], 409);
        }

        // Rahasia yang belum dikonfirmasi dipakai ulang supaya memuat ulang
        // halaman tidak membatalkan kode yang sudah dipindai ke aplikasi authenticator.
        $secret = $user->two_factor_secret ?: $this->totp->generateSecret();
        $codes = $request->session()->get('2fa_pending_recovery_codes');

        if (! $secret || ! $codes) {
            $codes = $this->totp->recoveryCodes();
            $user->forceFill([
                'two_factor_secret' => $secret,
                'two_factor_recovery_codes' => json_encode(array_map(fn ($c) => Hash::make($c), $codes)),
            ])->save();
        }

        $request->session()->put('2fa_pending_recovery_codes', $codes);

        return response()->json([
            'success' => true,
            'data' => [
                'secret' => $secret,
                'otpauth_url' => $this->totp->otpauthUrl(config('app.name'), $user->email ?? $user->identity_number, $secret),
                'recovery_codes' => $codes,
            ],
        ]);
    }

    public function confirmTwoFactor(Request $request)
    {
        $data = $request->validate(['code' => ['required', 'string']]);
        $user = $request->user();

        if (! $user->two_factor_secret || ! $this->totp->verify($user->two_factor_secret, $data['code'])) {
            return response()->json(['success' => false, 'error' => 'INVALID_CODE', 'message' => 'Kode verifikasi salah.'], 422);
        }

        $user->forceFill(['two_factor_confirmed_at' => now()])->save();
        $request->session()->forget('2fa_pending_recovery_codes');
        $request->session()->put('two_factor_passed', true);
        $this->audit->record('auth.2fa_enrolled', 'users', $user->id, $user->id, null, [], $user);

        return response()->json([
            'success' => true,
            'data' => ['two_factor_confirmed_at' => $user->two_factor_confirmed_at->toIso8601String(), 'redirect_to' => $this->redirectFor($user)],
        ]);
    }

    public function verifyTwoFactor(Request $request)
    {
        $data = $request->validate([
            'code' => ['nullable', 'string'],
            'recovery_code' => ['nullable', 'string'],
        ]);

        $user = $request->user();

        if (! $user) {
            return response()->json(['success' => false, 'error' => 'UNAUTHENTICATED', 'message' => 'Sesi tidak ditemukan.'], 401);
        }

        $key = '2fa:'.$user->id;
        if (RateLimiter::tooManyAttempts($key, 5)) {
            Auth::logout();

            return response()->json(['success' => false, 'error' => 'TOO_MANY_REQUESTS', 'message' => 'Terlalu banyak percobaan.'], 429);
        }

        $valid = false;

        if (! blank($data['code'] ?? null) && $user->two_factor_secret) {
            $valid = $this->totp->verify($user->two_factor_secret, $data['code']);
        }

        if (! $valid && ! blank($data['recovery_code'] ?? null)) {
            $codes = json_decode((string) $user->two_factor_recovery_codes, true) ?: [];
            foreach ($codes as $index => $hash) {
                if (Hash::check($data['recovery_code'], $hash)) {
                    unset($codes[$index]);
                    $user->forceFill(['two_factor_recovery_codes' => json_encode(array_values($codes))])->save();
                    $valid = true;
                    break;
                }
            }
        }

        if (! $valid) {
            RateLimiter::hit($key, 300);

            return response()->json(['success' => false, 'error' => 'INVALID_CODE', 'message' => 'Kode verifikasi salah.'], 422);
        }

        RateLimiter::clear($key);
        $request->session()->put('two_factor_passed', true);
        $this->audit->record('auth.2fa_verified', 'users', $user->id, $user->id, null, [], $user);

        return response()->json([
            'success' => true,
            'data' => ['redirect_to' => $this->redirectFor($user)],
            'message' => 'Verifikasi berhasil',
        ]);
    }

    public function activationUrl(User $user): string
    {
        return URL::temporarySignedRoute('activate.form', now()->addHours(72), ['user' => $user->id]);
    }

    private function redirectFor(User $user): string
    {
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
