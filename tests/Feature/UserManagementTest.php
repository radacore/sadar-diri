<?php

namespace Tests\Feature;

use App\Models\AcademicYear;
use App\Models\CounselorClass;
use App\Models\SchoolClass;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class UserManagementTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role, string $identity): User
    {
        return User::create([
            'name' => ucfirst($role).' '.$identity,
            'email' => $identity.'@example.test',
            'identity_number' => $identity,
            'password' => 'Password123',
            'role' => $role,
            'status' => 'active',
            'must_change_password' => false,
            'consent_version' => '2026-08-01',
            'consented_at' => now(),
        ]);
    }

    private function admin(): User
    {
        return $this->user('superadmin', 'admin');
    }

    private function schoolClass(string $name): SchoolClass
    {
        $year = AcademicYear::firstOrCreate(
            ['name' => '2026/2027'],
            ['starts_on' => '2026-07-01', 'ends_on' => '2027-06-30', 'is_active' => true],
        );

        return SchoolClass::create([
            'academic_year_id' => $year->id,
            'name' => $name,
            'level' => explode(' ', $name)[0],
            'is_active' => true,
        ]);
    }

    public function test_user_list_is_paginated_20_rows_by_default(): void
    {
        $admin = $this->admin();

        foreach (range(1, 25) as $index) {
            $this->user('student', 'S'.str_pad((string) $index, 3, '0', STR_PAD_LEFT));
        }

        $response = $this->actingAs($admin)
            ->withSession(['two_factor_passed' => true])
            ->getJson('/api/admin/users')
            ->assertOk();

        $this->assertCount(20, $response->json('data'));
        $this->assertSame(20, $response->json('meta.per_page'));
        $this->assertSame(25, $response->json('meta.total'));
        $this->assertSame(2, $response->json('meta.last_page'));
        $this->assertSame(1, $response->json('meta.from'));
        $this->assertSame(20, $response->json('meta.to'));
    }

    public function test_user_list_honours_per_page_and_page_parameters(): void
    {
        $admin = $this->admin();

        foreach (range(1, 30) as $index) {
            $this->user('student', 'S'.str_pad((string) $index, 3, '0', STR_PAD_LEFT));
        }

        $response = $this->actingAs($admin)
            ->withSession(['two_factor_passed' => true])
            ->getJson('/api/admin/users?per_page=10&page=3')
            ->assertOk();

        $this->assertCount(10, $response->json('data'));
        $this->assertSame(3, $response->json('meta.current_page'));
        $this->assertSame(21, $response->json('meta.from'));

        $this->actingAs($admin)
            ->withSession(['two_factor_passed' => true])
            ->getJson('/api/admin/users?per_page=1000')
            ->assertOk()
            ->assertJsonPath('meta.per_page', 20);
    }

    public function test_superadmin_accounts_are_never_listed(): void
    {
        $admin = $this->admin();
        $this->user('counselor', 'rina');

        $response = $this->actingAs($admin)
            ->withSession(['two_factor_passed' => true])
            ->getJson('/api/admin/users')
            ->assertOk();

        $roles = collect($response->json('data'))->pluck('role')->unique()->values()->all();

        $this->assertSame(['counselor'], $roles);

        $this->actingAs($admin)
            ->withSession(['two_factor_passed' => true])
            ->getJson('/api/admin/users?role=superadmin')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_superadmin_cannot_be_created_through_the_admin_api(): void
    {
        $this->actingAs($this->admin())
            ->withSession(['two_factor_passed' => true])
            ->postJson('/api/admin/users', [
                'name' => 'Admin Kedua',
                'identity_number' => 'ADM002',
                'role' => 'superadmin',
                'password' => 'Password123',
            ])
            ->assertStatus(422);
    }

    public function test_new_student_uses_identity_number_as_initial_password(): void
    {
        $this->actingAs($this->admin())
            ->withSession(['two_factor_passed' => true])
            ->postJson('/api/admin/users', [
                'name' => 'Siswa Baru',
                'identity_number' => '2024100',
                'email' => 'siswa.baru@example.test',
                'role' => 'student',
                'class_id' => $this->schoolClass('X IPA 1')->id,
            ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.initial_password', '2024100');

        $user = User::where('identity_number', '2024100')->firstOrFail();

        $this->assertTrue(Hash::check('2024100', $user->password));
        $this->assertTrue($user->must_change_password);
    }

    public function test_explicit_initial_password_is_kept(): void
    {
        $this->actingAs($this->admin())
            ->withSession(['two_factor_passed' => true])
            ->postJson('/api/admin/users', [
                'name' => 'Guru BK Kedua',
                'identity_number' => '198801012021',
                'role' => 'counselor',
                'password' => 'Password123',
            ])
            ->assertCreated()
            ->assertJsonPath('data.initial_password', null);

        $user = User::where('identity_number', '198801012021')->firstOrFail();

        $this->assertTrue(Hash::check('Password123', $user->password));
    }

    public function test_counselor_can_be_created_with_class_assignments(): void
    {
        $classA = $this->schoolClass('X IPA 1');
        $classB = $this->schoolClass('X IPA 2');
        $admin = $this->admin();

        $this->actingAs($admin)
            ->withSession(['two_factor_passed' => true])
            ->postJson('/api/admin/users', [
                'name' => 'Guru BK Baru',
                'identity_number' => '198801012020',
                'email' => 'bk.baru@example.test',
                'role' => 'counselor',
                'password' => 'Password123',
                'class_ids' => [$classA->id, $classB->id],
            ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'active');

        $counselor = User::where('identity_number', '198801012020')->firstOrFail();

        $this->assertSame(2, CounselorClass::where('counselor_id', $counselor->id)->count());

        $this->actingAs($admin)
            ->withSession(['two_factor_passed' => true])
            ->getJson('/api/admin/users?role=counselor')
            ->assertOk()
            ->assertJsonPath('data.0.classes.0.name', 'X IPA 1')
            ->assertJsonPath('data.0.classes.1.name', 'X IPA 2');
    }

    public function test_weak_explicit_password_is_rejected(): void
    {
        $this->actingAs($this->admin())
            ->withSession(['two_factor_passed' => true])
            ->postJson('/api/admin/users', [
                'name' => 'Sandi Lemah',
                'identity_number' => '2024101',
                'role' => 'counselor',
                'password' => 'rahasia',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('password');
    }
}
