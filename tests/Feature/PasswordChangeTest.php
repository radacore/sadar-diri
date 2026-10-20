<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class PasswordChangeTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role = 'student', bool $mustChange = true): User
    {
        return User::create([
            'name' => 'Pengguna Uji',
            'email' => $role.'@example.test',
            'identity_number' => $role === 'student' ? '2024001' : '198801012020',
            'password' => '2024001',
            'role' => $role,
            'status' => 'active',
            'must_change_password' => $mustChange,
            'consent_version' => '2026-08-01',
            'consented_at' => now(),
        ]);
    }

    public function test_login_redirects_to_password_change_when_flag_is_set(): void
    {
        $this->user();

        $this->postJson('/api/auth/login', [
            'identity' => '2024001',
            'password' => '2024001',
        ])
            ->assertOk()
            ->assertJsonPath('data.redirect_to', '/ganti-sandi');
    }

    public function test_app_pages_redirect_to_password_change_page(): void
    {
        $user = $this->user();

        $this->actingAs($user)
            ->get('/siswa/beranda')
            ->assertRedirect('/ganti-sandi');

        $this->actingAs($user)
            ->get('/ganti-sandi')
            ->assertOk();
    }

    public function test_password_can_be_changed_with_current_password(): void
    {
        $user = $this->user();

        $this->actingAs($user)
            ->putJson('/api/auth/password', [
                'current_password' => '2024001',
                'password' => 'RahasiaBaru123',
                'password_confirmation' => 'RahasiaBaru123',
            ])
            ->assertOk()
            ->assertJsonPath('data.redirect_to', '/siswa/beranda');

        $user->refresh();

        $this->assertTrue(Hash::check('RahasiaBaru123', $user->password));
        $this->assertFalse($user->must_change_password);

        $this->actingAs($user)
            ->get('/siswa/beranda')
            ->assertOk();
    }

    public function test_wrong_current_password_is_rejected(): void
    {
        $user = $this->user();

        $this->actingAs($user)
            ->putJson('/api/auth/password', [
                'current_password' => 'salah',
                'password' => 'RahasiaBaru123',
                'password_confirmation' => 'RahasiaBaru123',
            ])
            ->assertStatus(422)
            ->assertJsonPath('error', 'INVALID_PASSWORD');

        $this->assertTrue($user->fresh()->must_change_password);
    }

    public function test_same_password_is_rejected(): void
    {
        $user = $this->user();
        $user->forceFill(['password' => 'Password123'])->save();

        $this->actingAs($user)
            ->putJson('/api/auth/password', [
                'current_password' => 'Password123',
                'password' => 'Password123',
                'password_confirmation' => 'Password123',
            ])
            ->assertStatus(422)
            ->assertJsonPath('error', 'SAME_PASSWORD');
    }

    public function test_counselor_can_change_password_through_the_same_endpoint(): void
    {
        $counselor = $this->user('counselor');

        $this->actingAs($counselor)
            ->putJson('/api/auth/password', [
                'current_password' => '2024001',
                'password' => 'RahasiaBaru123',
                'password_confirmation' => 'RahasiaBaru123',
            ])
            ->assertOk()
            ->assertJsonPath('data.redirect_to', '/bk/dashboard');

        $this->assertFalse($counselor->fresh()->must_change_password);
    }

    public function test_student_account_endpoint_still_works(): void
    {
        $user = $this->user(mustChange: false);

        $this->actingAs($user)
            ->putJson('/api/student/account/password', [
                'current_password' => '2024001',
                'password' => 'RahasiaBaru123',
                'password_confirmation' => 'RahasiaBaru123',
            ])
            ->assertOk();
    }
}
