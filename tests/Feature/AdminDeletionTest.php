<?php

namespace Tests\Feature;

use App\Models\AcademicYear;
use App\Models\Achievement;
use App\Models\Attachment;
use App\Models\ClassStudent;
use App\Models\CounselorClass;
use App\Models\SchoolClass;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AdminDeletionTest extends TestCase
{
    use RefreshDatabase;

    private SchoolClass $class;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');

        $year = AcademicYear::firstOrCreate(
            ['name' => '2026/2027'],
            ['starts_on' => '2026-07-01', 'ends_on' => '2027-06-30', 'is_active' => true],
        );

        $this->class = SchoolClass::create([
            'academic_year_id' => $year->id,
            'name' => 'X IPA 1',
            'level' => 'X',
            'is_active' => true,
        ]);

        $this->admin = User::create([
            'name' => 'Admin Uji',
            'email' => 'admin.uji@example.test',
            'identity_number' => 'ADM900',
            'password' => 'Password123',
            'role' => 'superadmin',
            'status' => 'active',
            'must_change_password' => false,
        ]);
    }

    private function member(string $identity, ?SchoolClass $class = null): User
    {
        $class ??= $this->class;

        $student = User::create([
            'name' => 'Siswa '.$identity,
            'email' => $identity.'@example.test',
            'identity_number' => $identity,
            'password' => 'Password123',
            'role' => 'student',
            'status' => 'active',
            'must_change_password' => false,
        ]);

        ClassStudent::create([
            'class_id' => $class->id,
            'student_id' => $student->id,
            'academic_year_id' => $class->academic_year_id,
            'joined_at' => now()->toDateString(),
            'status' => 'active',
        ]);

        return $student;
    }

    public function test_superadmin_can_delete_student_with_data_and_files(): void
    {
        $student = $this->member('S-1');

        StudentProfile::create(['user_id' => $student->id, 'nickname' => 'Satu']);

        $achievement = Achievement::create([
            'student_id' => $student->id,
            'category' => 'academic',
            'title' => 'Juara 1',
            'organizer' => 'Dinas',
            'level' => 'city',
            'achieved_at' => now()->subDay()->toDateString(),
        ]);

        Storage::disk('local')->put('proofs/bukti.jpg', 'isi');
        Attachment::create([
            'achievement_id' => $achievement->id,
            'uploaded_by' => $student->id,
            'disk' => 'local',
            'path' => 'proofs/bukti.jpg',
            'original_name' => 'bukti.jpg',
            'mime_type' => 'image/jpeg',
            'size_bytes' => 3,
        ]);

        $this->actingAs($this->admin)
            ->withSession(['two_factor_passed' => true])
            ->deleteJson('/api/admin/users/'.$student->id, ['reason' => 'Salah input'])
            ->assertOk()
            ->assertJsonPath('data.id', $student->id);

        $this->assertDatabaseMissing('users', ['id' => $student->id]);
        $this->assertDatabaseMissing('student_profiles', ['user_id' => $student->id]);
        $this->assertDatabaseMissing('class_student', ['student_id' => $student->id]);
        $this->assertDatabaseMissing('attachments', ['uploaded_by' => $student->id]);
        Storage::disk('local')->assertMissing('proofs/bukti.jpg');
        $this->assertSame(1, DB::table('audit_logs')->where('action', 'user.deleted')->count());
    }

    public function test_counselor_account_cannot_be_deleted(): void
    {
        $counselor = User::create([
            'name' => 'Guru BK',
            'email' => 'bk@example.test',
            'identity_number' => '198501019999',
            'password' => 'Password123',
            'role' => 'counselor',
            'status' => 'active',
            'must_change_password' => false,
        ]);

        $this->actingAs($this->admin)
            ->withSession(['two_factor_passed' => true])
            ->deleteJson('/api/admin/users/'.$counselor->id, ['reason' => 'Uji'])
            ->assertStatus(409)
            ->assertJsonPath('error', 'CONFLICT');

        $this->assertDatabaseHas('users', ['id' => $counselor->id]);
    }

    public function test_reason_is_required_to_delete_student(): void
    {
        $student = $this->member('S-2');

        $this->actingAs($this->admin)
            ->withSession(['two_factor_passed' => true])
            ->deleteJson('/api/admin/users/'.$student->id)
            ->assertStatus(422)
            ->assertJsonValidationErrors('reason');

        $this->assertDatabaseHas('users', ['id' => $student->id]);
    }

    public function test_deleting_class_removes_its_active_students(): void
    {
        $first = $this->member('S-3');
        $second = $this->member('S-4');

        $otherYear = AcademicYear::create([
            'name' => '2025/2026',
            'starts_on' => '2025-07-01',
            'ends_on' => '2026-06-30',
            'is_active' => false,
        ]);
        $otherClass = SchoolClass::create([
            'academic_year_id' => $otherYear->id,
            'name' => 'XI IPA 1',
            'level' => 'XI',
            'is_active' => true,
        ]);
        $survivor = $this->member('S-5', $otherClass);

        $counselor = User::create([
            'name' => 'Guru BK Uji',
            'email' => 'bk.uji@example.test',
            'identity_number' => '198501018888',
            'password' => 'Password123',
            'role' => 'counselor',
            'status' => 'active',
            'must_change_password' => false,
        ]);
        CounselorClass::create([
            'counselor_id' => $counselor->id,
            'class_id' => $this->class->id,
            'assigned_at' => now(),
        ]);

        $this->actingAs($this->admin)
            ->withSession(['two_factor_passed' => true])
            ->deleteJson('/api/admin/classes/'.$this->class->id, ['reason' => 'Kelas dibubarkan'])
            ->assertOk()
            ->assertJsonPath('data.students_deleted', 2);

        $this->assertDatabaseMissing('classes', ['id' => $this->class->id]);
        $this->assertDatabaseMissing('users', ['id' => $first->id]);
        $this->assertDatabaseMissing('users', ['id' => $second->id]);
        $this->assertDatabaseHas('users', ['id' => $survivor->id]);
        $this->assertDatabaseMissing('class_student', ['class_id' => $this->class->id]);
        $this->assertDatabaseMissing('counselor_class', ['class_id' => $this->class->id]);
        $this->assertSame(1, DB::table('audit_logs')->where('action', 'class.deleted')->count());
    }

    public function test_deleting_class_requires_reason(): void
    {
        $this->actingAs($this->admin)
            ->withSession(['two_factor_passed' => true])
            ->deleteJson('/api/admin/classes/'.$this->class->id)
            ->assertStatus(422)
            ->assertJsonValidationErrors('reason');

        $this->assertDatabaseHas('classes', ['id' => $this->class->id]);
    }
}