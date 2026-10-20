<?php

namespace Tests\Feature;

use App\Models\AcademicYear;
use App\Models\ClassStudent;
use App\Models\CounselorClass;
use App\Models\SchoolClass;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ClassCounselorAssignmentTest extends TestCase
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

    private function year(string $name = '2026/2027'): AcademicYear
    {
        return AcademicYear::create([
            'name' => $name,
            'starts_on' => '2026-07-01',
            'ends_on' => '2027-06-30',
            'is_active' => true,
        ]);
    }

    private function schoolClass(AcademicYear $year, string $name): SchoolClass
    {
        return SchoolClass::create([
            'academic_year_id' => $year->id,
            'name' => $name,
            'level' => explode(' ', $name)[0],
            'is_active' => true,
        ]);
    }

    public function test_a_counselor_can_be_assigned_to_many_classes_at_once(): void
    {
        $admin = $this->user('superadmin', 'admin');
        $counselor = $this->user('counselor', 'rina');
        $year = $this->year();
        $classes = [
            $this->schoolClass($year, 'X IPA 1'),
            $this->schoolClass($year, 'X IPA 2'),
            $this->schoolClass($year, 'X IPS 1'),
        ];

        $this->actingAs($admin)
            ->withSession(['two_factor_passed' => true])
            ->postJson("/api/admin/counselors/{$counselor->id}/classes", [
                'class_ids' => collect($classes)->pluck('id')->all(),
            ])
            ->assertOk()
            ->assertJsonPath('data.assigned', 3);

        $this->assertSame(3, CounselorClass::query()->where('counselor_id', $counselor->id)->count());
    }

    public function test_assigning_the_same_class_twice_is_idempotent(): void
    {
        $admin = $this->user('superadmin', 'admin');
        $counselor = $this->user('counselor', 'rina');
        $class = $this->schoolClass($this->year(), 'X IPA 1');

        $this->actingAs($admin)
            ->withSession(['two_factor_passed' => true])
            ->postJson("/api/admin/counselors/{$counselor->id}/classes", ['class_ids' => [$class->id]])
            ->assertOk()
            ->assertJsonPath('data.assigned', 1);

        $this->actingAs($admin)
            ->withSession(['two_factor_passed' => true])
            ->postJson("/api/admin/counselors/{$counselor->id}/classes", ['class_ids' => [$class->id]])
            ->assertOk()
            ->assertJsonPath('data.assigned', 0);

        $this->assertSame(1, CounselorClass::query()->where('class_id', $class->id)->count());
    }

    public function test_a_class_may_have_more_than_one_counselor(): void
    {
        $admin = $this->user('superadmin', 'admin');
        $rina = $this->user('counselor', 'rina');
        $hendra = $this->user('counselor', 'hendra');
        $class = $this->schoolClass($this->year(), 'X IPA 1');

        foreach ([$rina, $hendra] as $counselor) {
            $this->actingAs($admin)
                ->withSession(['two_factor_passed' => true])
                ->postJson("/api/admin/counselors/{$counselor->id}/classes", ['class_ids' => [$class->id]])
                ->assertOk();
        }

        $this->assertSame(2, CounselorClass::query()->where('class_id', $class->id)->count());
    }

    public function test_the_last_counselor_can_be_detached_from_a_class(): void
    {
        $admin = $this->user('superadmin', 'admin');
        $counselor = $this->user('counselor', 'rina');
        $class = $this->schoolClass($this->year(), 'X IPA 1');

        CounselorClass::create([
            'counselor_id' => $counselor->id,
            'class_id' => $class->id,
            'assigned_at' => now(),
        ]);

        $this->actingAs($admin)
            ->withSession(['two_factor_passed' => true])
            ->deleteJson("/api/admin/classes/{$class->id}/counselors/{$counselor->id}")
            ->assertOk();

        $this->assertSame(0, CounselorClass::query()->where('class_id', $class->id)->count());
    }

    public function test_promotion_carries_counselor_assignments_to_the_next_class(): void
    {
        $admin = $this->user('superadmin', 'admin');
        $counselor = $this->user('counselor', 'rina');
        $fromYear = $this->year('2026/2027');
        $toYear = $this->year('2027/2028');
        $from = $this->schoolClass($fromYear, 'X IPA 1');
        $to = $this->schoolClass($toYear, 'XI IPA 1');

        $student = $this->user('student', '2024001');

        ClassStudent::create([
            'class_id' => $from->id,
            'student_id' => $student->id,
            'academic_year_id' => $fromYear->id,
            'joined_at' => '2026-07-01',
            'status' => 'active',
        ]);

        CounselorClass::create([
            'counselor_id' => $counselor->id,
            'class_id' => $from->id,
            'assigned_at' => now(),
        ]);

        $this->actingAs($admin)
            ->withSession(['two_factor_passed' => true])
            ->postJson("/api/admin/academic-years/{$toYear->id}/promote", [
                'preview' => false,
                'carry_counselors' => true,
                'mapping' => [[
                    'from_class_id' => $from->id,
                    'to_class_id' => $to->id,
                    'graduate' => false,
                ]],
            ])
            ->assertOk()
            ->assertJsonPath('data.counselors_carried', 1);

        $this->assertTrue(
            CounselorClass::query()
                ->where('counselor_id', $counselor->id)
                ->where('class_id', $to->id)
                ->exists(),
            'Penugasan Guru BK harus disalin ke kelas tujuan.'
        );

        // Penugasan lama tetap tersimpan sebagai riwayat akses.
        $this->assertTrue(
            CounselorClass::query()
                ->where('counselor_id', $counselor->id)
                ->where('class_id', $from->id)
                ->exists()
        );
    }

    public function test_promotion_can_skip_carrying_counselors(): void
    {
        $admin = $this->user('superadmin', 'admin');
        $counselor = $this->user('counselor', 'rina');
        $fromYear = $this->year('2026/2027');
        $toYear = $this->year('2027/2028');
        $from = $this->schoolClass($fromYear, 'X IPA 1');
        $to = $this->schoolClass($toYear, 'XI IPA 1');

        CounselorClass::create([
            'counselor_id' => $counselor->id,
            'class_id' => $from->id,
            'assigned_at' => now(),
        ]);

        $this->actingAs($admin)
            ->withSession(['two_factor_passed' => true])
            ->postJson("/api/admin/academic-years/{$toYear->id}/promote", [
                'preview' => false,
                'carry_counselors' => false,
                'mapping' => [[
                    'from_class_id' => $from->id,
                    'to_class_id' => $to->id,
                    'graduate' => false,
                ]],
            ])
            ->assertOk()
            ->assertJsonPath('data.counselors_carried', 0);

        $this->assertFalse(
            CounselorClass::query()
                ->where('counselor_id', $counselor->id)
                ->where('class_id', $to->id)
                ->exists()
        );
    }

    public function test_counselor_keeps_access_to_students_after_promotion(): void
    {
        $admin = $this->user('superadmin', 'admin');
        $counselor = $this->user('counselor', 'rina');
        $fromYear = $this->year('2026/2027');
        $toYear = $this->year('2027/2028');
        $from = $this->schoolClass($fromYear, 'X IPA 1');
        $to = $this->schoolClass($toYear, 'XI IPA 1');
        $student = $this->user('student', '2024001');

        ClassStudent::create([
            'class_id' => $from->id,
            'student_id' => $student->id,
            'academic_year_id' => $fromYear->id,
            'joined_at' => '2026-07-01',
            'status' => 'active',
        ]);

        CounselorClass::create([
            'counselor_id' => $counselor->id,
            'class_id' => $from->id,
            'assigned_at' => now(),
        ]);

        $this->actingAs($admin)
            ->withSession(['two_factor_passed' => true])
            ->postJson("/api/admin/academic-years/{$toYear->id}/promote", [
                'preview' => false,
                'carry_counselors' => true,
                'mapping' => [[
                    'from_class_id' => $from->id,
                    'to_class_id' => $to->id,
                    'graduate' => false,
                ]],
            ])
            ->assertOk();

        $this->actingAs($counselor)
            ->getJson("/api/counselor/students/{$student->id}/overview")
            ->assertOk();
    }
}
