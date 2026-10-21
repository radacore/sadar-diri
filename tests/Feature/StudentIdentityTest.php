<?php

namespace Tests\Feature;

use App\Models\AcademicYear;
use App\Models\ClassStudent;
use App\Models\CounselorClass;
use App\Models\SchoolClass;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class StudentIdentityTest extends TestCase
{
    use RefreshDatabase;

    private User $student;

    private User $counselor;

    protected function setUp(): void
    {
        parent::setUp();

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

        $this->student = $this->user('student', '2024001');
        $this->counselor = $this->user('counselor', '198501012010');

        CounselorClass::create([
            'counselor_id' => $this->counselor->id,
            'class_id' => $class->id,
            'assigned_at' => now(),
        ]);

        ClassStudent::create([
            'class_id' => $class->id,
            'student_id' => $this->student->id,
            'academic_year_id' => $year->id,
            'joined_at' => '2026-07-01',
            'status' => 'active',
        ]);
    }

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

    public function test_nik_is_normalized_and_stored_encrypted(): void
    {
        $this->actingAs($this->student)
            ->putJson('/api/student/profile/biodata', [
                'nik' => '3271 0101 2008 0001',
            ])
            ->assertOk();

        $profile = StudentProfile::where('user_id', $this->student->id)->firstOrFail();
        $this->assertSame('3271010120080001', $profile->nik);

        $raw = (string) DB::table('student_profiles')->value('nik');
        $this->assertStringNotContainsString('3271010120080001', $raw);

        $this->actingAs($this->student)
            ->getJson('/api/student/profile')
            ->assertOk()
            ->assertJsonPath('data.biodata.nik', '3271010120080001');
    }

    public function test_birth_place_religion_and_family_status_are_saved(): void
    {
        $this->actingAs($this->student)
            ->putJson('/api/student/profile/biodata', [
                'birth_place' => 'Bulukumba',
                'religion' => 'islam',
                'family_status' => 'kandung',
            ])
            ->assertOk();

        $this->actingAs($this->student)
            ->getJson('/api/student/profile')
            ->assertOk()
            ->assertJsonPath('data.biodata.birth_place', 'Bulukumba')
            ->assertJsonPath('data.biodata.religion', 'islam')
            ->assertJsonPath('data.biodata.family_status', 'kandung');
    }

    public function test_religion_and_family_status_are_validated(): void
    {
        $this->actingAs($this->student)
            ->putJson('/api/student/profile/biodata', [
                'religion' => 'kepercayaan',
                'family_status' => 'tetangga',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['religion', 'family_status']);
    }

    public function test_school_identity_fields_are_saved(): void
    {
        $this->actingAs($this->student)
            ->putJson('/api/student/profile/biodata', [
                'nisn' => '0086 865 430',
                'birth_order' => 2,
                'previous_school' => 'SMP Negeri 1 Bulukumba',
                'admission_class' => 'X IPA 1',
                'admission_date' => '2024-07-15',
                'father_name' => 'Faharuddin',
                'mother_name' => 'Farida',
                'parent_address' => 'Jl. Poros Bulukumba',
                'father_occupation' => 'Petani',
                'mother_occupation' => 'Tidak bekerja',
                'guardian_name' => 'Sitti Aminah',
                'guardian_phone' => '081234567890',
                'guardian_address' => 'Jl. Melati 3',
                'guardian_occupation' => 'Guru',
            ])
            ->assertOk();

        $this->actingAs($this->student)
            ->getJson('/api/student/profile')
            ->assertOk()
            ->assertJsonPath('data.biodata.nisn', '0086865430')
            ->assertJsonPath('data.biodata.birth_order', 2)
            ->assertJsonPath('data.biodata.previous_school', 'SMP Negeri 1 Bulukumba')
            ->assertJsonPath('data.biodata.admission_date', '2024-07-15')
            ->assertJsonPath('data.biodata.father_name', 'Faharuddin')
            ->assertJsonPath('data.biodata.guardian_phone', '081234567890');

        $this->actingAs($this->counselor)
            ->getJson('/api/counselor/students/'.$this->student->id.'/overview')
            ->assertOk()
            ->assertJsonPath('data.profile.biodata.mother_name', 'Farida')
            ->assertJsonPath('data.profile.biodata.guardian_occupation', 'Guru');
    }

    public function test_birth_order_must_be_reasonable(): void
    {
        $this->actingAs($this->student)
            ->putJson('/api/student/profile/biodata', ['birth_order' => 25])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('birth_order');
    }

    public function test_nik_must_be_sixteen_digits(): void
    {
        $this->actingAs($this->student)
            ->putJson('/api/student/profile/biodata', ['nik' => '327101012008000'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('nik');
    }

    public function test_social_media_keeps_known_platforms_and_drops_empty_ones(): void
    {
        $this->actingAs($this->student)
            ->putJson('/api/student/profile/biodata', [
                'social_media' => [
                    'instagram' => ' @ayu.lestari ',
                    'tiktok' => '',
                    'youtube' => '@ayulestari',
                    'myspace' => 'diabaikan',
                ],
            ])
            ->assertOk();

        $profile = StudentProfile::where('user_id', $this->student->id)->firstOrFail();

        $this->assertSame(
            ['instagram' => 'ayu.lestari', 'youtube' => 'ayulestari'],
            $profile->social_media,
        );
    }

    public function test_counselor_can_read_and_update_parent_phones(): void
    {
        $this->actingAs($this->counselor)
            ->putJson('/api/counselor/students/'.$this->student->id.'/profile/biodata', [
                'father_phone' => '081234567890',
                'mother_phone' => '081298765432',
                'nik' => '3271010120080001',
            ])
            ->assertOk();

        $this->actingAs($this->counselor)
            ->getJson('/api/counselor/students/'.$this->student->id.'/overview')
            ->assertOk()
            ->assertJsonPath('data.profile.biodata.father_phone', '081234567890')
            ->assertJsonPath('data.profile.biodata.mother_phone', '081298765432')
            ->assertJsonPath('data.profile.biodata.nik', '3271010120080001');
    }
}
