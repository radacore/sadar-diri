<?php

namespace Tests\Feature;

use App\Mail\LoginOtpMail;
use App\Mail\PasswordResetMail;
use App\Models\LoginOtpCode;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class EmailAuthTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role, string $email, array $attributes = []): User
    {
        return User::create($attributes + [
            'name' => ucfirst($role).' '.$email,
            'email' => $email,
            'identity_number' => 'ID'.random_int(1000, 9999),
            'password' => 'Password123',
            'role' => $role,
            'status' => 'active',
            'must_change_password' => false,
            'consent_version' => '2026-08-01',
            'consented_at' => now(),
        ]);
    }

    public function test_superadmin_login_sends_otp_to_email(): void
    {
        Mail::fake();
        $admin = $this->user('superadmin', 'rahmatdanisyw@gmail.com');

        $response = $this->postJson('/api/auth/login', [
            'identity' => 'rahmatdanisyw@gmail.com',
            'password' => 'Password123',
        ])->assertOk();

        $response->assertJsonPath('data.redirect_to', '/2fa/challenge');
        $this->assertTrue($response->json('data.otp_sent'));
        $this->assertSame(1, LoginOtpCode::where('user_id', $admin->id)->count());
        Mail::assertSent(LoginOtpMail::class, fn ($mail) => $mail->hasTo('rahmatdanisyw@gmail.com'));
    }

    public function test_otp_code_logs_superadmin_in_once(): void
    {
        Mail::fake();
        $admin = $this->user('superadmin', 'rahmatdanisyw@gmail.com');

        $this->postJson('/api/auth/login', [
            'identity' => 'rahmatdanisyw@gmail.com',
            'password' => 'Password123',
        ])->assertOk();

        $code = $this->capturedCode();

        $this->postJson('/api/auth/2fa/verify', ['code' => $code])
            ->assertOk()
            ->assertJsonPath('data.redirect_to', '/admin/dashboard');

        $this->assertTrue(session('two_factor_passed'));

        // Kode sekali pakai: percobaan kedua harus ditolak.
        $this->postJson('/api/auth/2fa/verify', ['code' => $code])->assertStatus(422);
    }

    public function test_wrong_otp_is_rejected(): void
    {
        Mail::fake();
        $this->user('superadmin', 'rahmatdanisyw@gmail.com');

        $this->postJson('/api/auth/login', [
            'identity' => 'rahmatdanisyw@gmail.com',
            'password' => 'Password123',
        ])->assertOk();

        $this->postJson('/api/auth/2fa/verify', ['code' => '000000'])->assertStatus(422);
        $this->assertFalse((bool) session('two_factor_passed'));
    }

    public function test_expired_otp_is_rejected(): void
    {
        Mail::fake();
        $admin = $this->user('superadmin', 'rahmatdanisyw@gmail.com');

        $this->postJson('/api/auth/login', [
            'identity' => 'rahmatdanisyw@gmail.com',
            'password' => 'Password123',
        ])->assertOk();

        $code = $this->capturedCode();
        LoginOtpCode::where('user_id', $admin->id)->update(['expires_at' => now()->subMinute()]);

        $this->postJson('/api/auth/2fa/verify', ['code' => $code])->assertStatus(422);
    }

    public function test_resend_is_rate_limited_by_cooldown(): void
    {
        Mail::fake();
        $this->user('superadmin', 'rahmatdanisyw@gmail.com');

        $this->postJson('/api/auth/login', [
            'identity' => 'rahmatdanisyw@gmail.com',
            'password' => 'Password123',
        ])->assertOk();

        $this->postJson('/api/auth/2fa/resend')
            ->assertStatus(429)
            ->assertJsonPath('error', 'RESEND_COOLDOWN');
    }

    public function test_students_and_counselors_skip_otp(): void
    {
        Mail::fake();
        $this->user('student', 'siswa@example.test');
        $this->user('counselor', 'guru@example.test');

        $this->postJson('/api/auth/login', ['identity' => 'siswa@example.test', 'password' => 'Password123'])
            ->assertOk()
            ->assertJsonPath('data.two_factor_required', false)
            ->assertJsonPath('data.redirect_to', '/siswa/beranda');

        $this->postJson('/api/auth/login', ['identity' => 'guru@example.test', 'password' => 'Password123'])
            ->assertOk()
            ->assertJsonPath('data.redirect_to', '/bk/dashboard');

        Mail::assertNothingSent();
    }

    public function test_password_reset_email_is_sent_for_every_role(): void
    {
        Mail::fake();
        $this->user('student', 'siswa@example.test');
        $this->user('counselor', 'guru@example.test');
        $this->user('superadmin', 'rahmatdanisyw@gmail.com');

        foreach (['siswa@example.test', 'guru@example.test', 'rahmatdanisyw@gmail.com'] as $email) {
            $this->postJson('/api/auth/forgot-password', ['email' => $email])
                ->assertOk()
                ->assertJsonPath('message', 'Jika email terdaftar, tautan reset telah dikirim.');
        }

        Mail::assertSent(PasswordResetMail::class, 3);
        Mail::assertSent(PasswordResetMail::class, fn ($mail) => $mail->hasTo('rahmatdanisyw@gmail.com'));
    }

    public function test_password_reset_link_changes_the_password(): void
    {
        Mail::fake();
        $student = $this->user('student', 'siswa@example.test');

        $this->postJson('/api/auth/forgot-password', ['email' => 'siswa@example.test'])->assertOk();

        $url = null;
        Mail::assertSent(PasswordResetMail::class, function ($mail) use (&$url) {
            $url = $mail->url;

            return true;
        });

        parse_str(parse_url($url, PHP_URL_QUERY), $query);

        $this->postJson('/api/auth/reset-password', [
            'email' => 'siswa@example.test',
            'token' => $query['token'],
            'password' => 'KataSandiBaru9',
            'password_confirmation' => 'KataSandiBaru9',
        ])->assertOk();

        $this->assertTrue(password_verify('KataSandiBaru9', $student->fresh()->password));
    }

    public function test_unknown_email_does_not_leak_account_existence(): void
    {
        Mail::fake();

        $this->postJson('/api/auth/forgot-password', ['email' => 'tidak-ada@example.test'])
            ->assertOk()
            ->assertJsonPath('message', 'Jika email terdaftar, tautan reset telah dikirim.');

        Mail::assertNothingSent();
    }

    private function capturedCode(): string
    {
        $code = null;

        Mail::assertSent(LoginOtpMail::class, function (LoginOtpMail $mail) use (&$code) {
            $code = $mail->code;

            return true;
        });

        return (string) $code;
    }
}
