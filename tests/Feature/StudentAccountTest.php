<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class StudentAccountTest extends TestCase
{
    use RefreshDatabase;

    private function student(string $identity = '2024001', string $email = 'ayu.lestari@example.test'): User
    {
        return User::create([
            'name' => 'Siswa '.$identity,
            'email' => $email,
            'identity_number' => $identity,
            'password' => 'Password123',
            'role' => 'student',
            'status' => 'active',
            'must_change_password' => false,
            'consent_version' => '2026-08-01',
            'consented_at' => now(),
        ]);
    }

    public function test_student_changes_password(): void
    {
        $user = $this->student();

        $response = $this->actingAs($user)->putJson('/api/student/account/password', [
            'current_password' => 'Password123',
            'password' => 'RahasiaBaru9',
            'password_confirmation' => 'RahasiaBaru9',
        ]);

        $response->assertOk()->assertJsonPath('success', true);

        $this->assertTrue(Hash::check('RahasiaBaru9', $user->fresh()->password));
        $this->assertFalse(Hash::check('Password123', $user->fresh()->password));

        $this->assertSame(1, DB::table('audit_logs')
            ->where('action', 'auth.password_changed')
            ->where('subject_user_id', $user->id)
            ->count());
    }

    public function test_password_change_rejects_wrong_current_password(): void
    {
        $user = $this->student();

        $response = $this->actingAs($user)->putJson('/api/student/account/password', [
            'current_password' => 'SalahBanget1',
            'password' => 'RahasiaBaru9',
            'password_confirmation' => 'RahasiaBaru9',
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('error', 'INVALID_PASSWORD')
            ->assertJsonValidationErrors('current_password');

        $this->assertTrue(Hash::check('Password123', $user->fresh()->password));
    }

    public function test_password_change_requires_matching_confirmation(): void
    {
        $user = $this->student();

        $response = $this->actingAs($user)->putJson('/api/student/account/password', [
            'current_password' => 'Password123',
            'password' => 'RahasiaBaru9',
            'password_confirmation' => 'RahasiaBaru8',
        ]);

        $response->assertStatus(422)->assertJsonValidationErrors('password');

        $this->assertTrue(Hash::check('Password123', $user->fresh()->password));
    }
}
