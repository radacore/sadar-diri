<?php

namespace Tests\Feature;

use App\Models\AcademicYear;
use App\Models\ClassStudent;
use App\Models\JournalEntry;
use App\Models\SchoolClass;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AccessControlTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role, string $identity, array $attributes = []): User
    {
        return User::create($attributes + [
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

    private function classWithStudents(User $counselor, int $count = 1): array
    {
        $year = AcademicYear::create([
            'name' => '2026/2027',
            'starts_on' => '2026-07-01',
            'ends_on' => '2027-06-30',
            'is_active' => true,
        ]);

        $class = SchoolClass::create([
            'academic_year_id' => $year->id,
            'name' => 'X IPA 1',
            'level' => 'X',
        ]);

        \App\Models\CounselorClass::create([
            'counselor_id' => $counselor->id,
            'class_id' => $class->id,
            'assigned_at' => now(),
        ]);

        $students = collect(range(1, $count))->map(function (int $i) use ($class, $year) {
            $student = $this->user('student', '2024'.str_pad((string) $i, 3, '0', STR_PAD_LEFT));
            ClassStudent::create([
                'class_id' => $class->id,
                'student_id' => $student->id,
                'academic_year_id' => $year->id,
                'joined_at' => '2026-07-01',
                'status' => 'active',
            ]);

            return $student;
        });

        return [$class, $students];
    }

    public function test_guests_are_redirected_to_login(): void
    {
        $this->get('/')->assertRedirect('/masuk');
        $this->get('/masuk')->assertOk();
    }

    public function test_students_cannot_reach_counselor_or_admin_endpoints(): void
    {
        $student = $this->user('student', '2024001');

        $this->actingAs($student)->getJson('/api/counselor/students')->assertForbidden();
        $this->actingAs($student)->getJson('/api/admin/users')->assertForbidden();
    }

    public function test_counselors_cannot_reach_student_or_admin_endpoints(): void
    {
        $counselor = $this->user('counselor', '199001');

        $this->actingAs($counselor)->getJson('/api/student/moods')->assertForbidden();
        $this->actingAs($counselor)->getJson('/api/admin/users')->assertForbidden();
    }

    public function test_counselor_only_reads_journals_of_own_class(): void
    {
        $counselor = $this->user('counselor', '199001');
        [, $students] = $this->classWithStudents($counselor);
        $outsider = $this->user('student', '2024999');

        JournalEntry::create([
            'student_id' => $students->first()->id,
            'type' => 'grateful',
            'entry_date' => now()->toDateString(),
            'gratitude_text' => 'Bersyukur bisa belajar.',
            'status' => 'published',
        ]);

        $this->actingAs($counselor)
            ->getJson('/api/counselor/students/'.$students->first()->id.'/journals')
            ->assertOk();

        $this->actingAs($counselor)
            ->getJson('/api/counselor/students/'.$outsider->id.'/journals')
            ->assertForbidden();
    }

    public function test_superadmin_cannot_read_journals(): void
    {
        $admin = $this->user('superadmin', 'admin');
        $student = $this->user('student', '2024001');

        $this->actingAs($admin)
            ->withSession(['two_factor_passed' => true])
            ->getJson('/api/counselor/students/'.$student->id.'/journals')
            ->assertForbidden();
    }

    public function test_admin_api_requires_two_factor_session(): void
    {
        $admin = $this->user('superadmin', 'admin');

        $this->actingAs($admin)->getJson('/api/admin/users')
            ->assertForbidden()
            ->assertJsonPath('error', 'TWO_FACTOR_REQUIRED');

        $this->actingAs($admin)
            ->withSession(['two_factor_passed' => true])
            ->getJson('/api/admin/users')
            ->assertOk();
    }
}
