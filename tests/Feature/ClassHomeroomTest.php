<?php

namespace Tests\Feature;

use App\Models\AcademicYear;
use App\Models\AuditLog;
use App\Models\ClassStudent;
use App\Models\CounselorClass;
use App\Models\SchoolClass;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ClassHomeroomTest extends TestCase
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

    private function schoolClass(AcademicYear $year, string $name, ?string $homeroom = null): SchoolClass
    {
        return SchoolClass::create([
            'academic_year_id' => $year->id,
            'name' => $name,
            'level' => explode(' ', $name)[0],
            'homeroom_teacher_name' => $homeroom,
            'is_active' => true,
        ]);
    }

    public function test_class_list_returns_the_homeroom_teacher_name(): void
    {
        $admin = $this->user('superadmin', 'admin');
        $this->schoolClass($this->year(), 'X IPA 1', 'Dewi Sartika');

        $this->actingAs($admin)
            ->withSession(['two_factor_passed' => true])
            ->getJson('/api/admin/classes')
            ->assertOk()
            ->assertJsonPath('data.0.homeroom_teacher_name', 'Dewi Sartika');
    }

    public function test_changing_one_homeroom_does_not_touch_students_or_counselors(): void
    {
        $admin = $this->user('superadmin', 'admin');
        $counselor = $this->user('counselor', 'rina');
        $student = $this->user('student', '2024001');
        $year = $this->year();
        $class = $this->schoolClass($year, 'X IPA 1', 'Dewi Sartika');
        $other = $this->schoolClass($year, 'X IPA 2', 'Budi Santoso');

        ClassStudent::create([
            'class_id' => $class->id,
            'student_id' => $student->id,
            'academic_year_id' => $year->id,
            'joined_at' => '2026-07-01',
            'status' => 'active',
        ]);

        CounselorClass::create([
            'counselor_id' => $counselor->id,
            'class_id' => $class->id,
            'assigned_at' => now(),
        ]);

        $this->actingAs($admin)
            ->withSession(['two_factor_passed' => true])
            ->putJson("/api/admin/classes/{$class->id}", [
                'homeroom_teacher_name' => 'Dewi Sartika (pindah tugas)',
            ])
            ->assertOk()
            ->assertJsonPath('data.homeroom_teacher_name', 'Dewi Sartika (pindah tugas)');

        $this->assertSame('Dewi Sartika (pindah tugas)', $class->fresh()->homeroom_teacher_name);
        $this->assertSame('Budi Santoso', $other->fresh()->homeroom_teacher_name, 'Wali kelas kelas lain tidak boleh ikut berubah.');
        $this->assertSame(1, ClassStudent::query()->where('class_id', $class->id)->where('status', 'active')->count());
        $this->assertTrue(CounselorClass::query()->where('class_id', $class->id)->where('counselor_id', $counselor->id)->exists());
    }

    public function test_class_update_audit_stores_the_old_and_new_homeroom(): void
    {
        $admin = $this->user('superadmin', 'admin');
        $class = $this->schoolClass($this->year(), 'X IPA 1', 'Dewi Sartika');

        $this->actingAs($admin)
            ->withSession(['two_factor_passed' => true])
            ->putJson("/api/admin/classes/{$class->id}", ['homeroom_teacher_name' => 'Budi Santoso'])
            ->assertOk();

        $log = AuditLog::query()->where('action', 'class.updated')->latest('id')->first();

        $this->assertNotNull($log);
        $this->assertSame('Dewi Sartika', $log->metadata['changes']['homeroom_teacher_name']['from']);
        $this->assertSame('Budi Santoso', $log->metadata['changes']['homeroom_teacher_name']['to']);
    }

    public function test_promotion_copies_the_homeroom_teacher_to_an_empty_target_class(): void
    {
        $admin = $this->user('superadmin', 'admin');
        $fromYear = $this->year('2026/2027');
        $toYear = $this->year('2027/2028');
        $from = $this->schoolClass($fromYear, 'X IPA 1', 'Dewi Sartika');
        $to = $this->schoolClass($toYear, 'XI IPA 1');

        $this->actingAs($admin)
            ->withSession(['two_factor_passed' => true])
            ->postJson("/api/admin/academic-years/{$toYear->id}/promote", [
                'preview' => false,
                'carry_homeroom' => true,
                'mapping' => [[
                    'from_class_id' => $from->id,
                    'to_class_id' => $to->id,
                    'graduate' => false,
                ]],
            ])
            ->assertOk()
            ->assertJsonPath('data.homerooms_carried', 1);

        $this->assertSame('Dewi Sartika', $to->fresh()->homeroom_teacher_name);
        $this->assertSame('Dewi Sartika', $from->fresh()->homeroom_teacher_name, 'Kelas asal tetap menyimpan riwayat wali kelasnya.');
    }

    public function test_promotion_does_not_overwrite_a_target_class_that_already_has_a_homeroom(): void
    {
        $admin = $this->user('superadmin', 'admin');
        $fromYear = $this->year('2026/2027');
        $toYear = $this->year('2027/2028');
        $from = $this->schoolClass($fromYear, 'X IPA 1', 'Dewi Sartika');
        $to = $this->schoolClass($toYear, 'XI IPA 1', 'Rudi Hartono');

        $this->actingAs($admin)
            ->withSession(['two_factor_passed' => true])
            ->postJson("/api/admin/academic-years/{$toYear->id}/promote", [
                'preview' => false,
                'mapping' => [[
                    'from_class_id' => $from->id,
                    'to_class_id' => $to->id,
                    'graduate' => false,
                ]],
            ])
            ->assertOk()
            ->assertJsonPath('data.homerooms_carried', 0);

        $this->assertSame('Rudi Hartono', $to->fresh()->homeroom_teacher_name);
    }

    public function test_promotion_can_skip_copying_the_homeroom_teacher(): void
    {
        $admin = $this->user('superadmin', 'admin');
        $fromYear = $this->year('2026/2027');
        $toYear = $this->year('2027/2028');
        $from = $this->schoolClass($fromYear, 'X IPA 1', 'Dewi Sartika');
        $to = $this->schoolClass($toYear, 'XI IPA 1');

        $this->actingAs($admin)
            ->withSession(['two_factor_passed' => true])
            ->postJson("/api/admin/academic-years/{$toYear->id}/promote", [
                'preview' => false,
                'carry_homeroom' => false,
                'mapping' => [[
                    'from_class_id' => $from->id,
                    'to_class_id' => $to->id,
                    'graduate' => false,
                ]],
            ])
            ->assertOk()
            ->assertJsonPath('data.homerooms_carried', 0);

        $this->assertNull($to->fresh()->homeroom_teacher_name);
    }

    public function test_promotion_preview_reports_how_many_homerooms_will_be_copied(): void
    {
        $admin = $this->user('superadmin', 'admin');
        $fromYear = $this->year('2026/2027');
        $toYear = $this->year('2027/2028');
        $from = $this->schoolClass($fromYear, 'X IPA 1', 'Dewi Sartika');
        $to = $this->schoolClass($toYear, 'XI IPA 1');

        $this->actingAs($admin)
            ->withSession(['two_factor_passed' => true])
            ->postJson("/api/admin/academic-years/{$toYear->id}/promote", [
                'preview' => true,
                'mapping' => [[
                    'from_class_id' => $from->id,
                    'to_class_id' => $to->id,
                    'graduate' => false,
                ]],
            ])
            ->assertOk()
            ->assertJsonPath('data.homerooms_carried', 1);

        $this->assertNull($to->fresh()->homeroom_teacher_name, 'Pratinjau tidak boleh mengubah data.');
    }

    public function test_student_profile_shows_the_class_and_homeroom_teacher(): void
    {
        $year = $this->year();
        $class = $this->schoolClass($year, 'XI IPA 1', 'Nina Kartika');
        $student = $this->user('student', '2024001');

        ClassStudent::create([
            'class_id' => $class->id,
            'student_id' => $student->id,
            'academic_year_id' => $year->id,
            'joined_at' => '2026-07-01',
            'status' => 'active',
        ]);

        $this->actingAs($student)
            ->getJson('/api/student/profile')
            ->assertOk()
            ->assertJsonPath('data.class.name', 'XI IPA 1')
            ->assertJsonPath('data.class.homeroom_teacher_name', 'Nina Kartika')
            ->assertJsonPath('data.class.academic_year', '2026/2027');
    }

    public function test_student_profile_returns_null_class_when_not_assigned(): void
    {
        $student = $this->user('student', '2024002');

        $this->actingAs($student)
            ->getJson('/api/student/profile')
            ->assertOk()
            ->assertJsonPath('data.class', null);
    }
}
