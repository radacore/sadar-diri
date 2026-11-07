<?php

namespace Tests\Feature;

use App\Models\AcademicYear;
use App\Models\Achievement;
use App\Models\ClassStudent;
use App\Models\SchoolClass;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CompetitionFlagTest extends TestCase
{
    use RefreshDatabase;

    private User $student;

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

        $this->student = User::create([
            'name' => 'Siswa 2024001',
            'email' => '2024001@example.test',
            'identity_number' => '2024001',
            'password' => 'Password123',
            'role' => 'student',
            'status' => 'active',
            'must_change_password' => false,
            'consent_version' => '2026-08-01',
            'consented_at' => now(),
        ]);

        ClassStudent::create([
            'class_id' => $class->id,
            'student_id' => $this->student->id,
            'academic_year_id' => $year->id,
            'joined_at' => '2026-07-01',
            'status' => 'active',
        ]);
    }

    private function payload(array $overrides = []): array
    {
        return [
            'category' => 'academic',
            'title' => 'Juara 1 Olimpiade Matematika',
            'organizer' => 'Dinas Pendidikan',
            'level' => 'city',
            'achieved_at' => now()->subDay()->toDateString(),
            'rank' => 'Juara 1',
            'description' => 'Olimpiade tingkat kota.',
        ] + $overrides;
    }

    public function test_academic_entry_can_be_marked_as_competition(): void
    {
        $response = $this->actingAs($this->student)
            ->postJson('/api/student/achievements', $this->payload(['is_competition' => true]))
            ->assertCreated();

        $this->assertTrue(Achievement::findOrFail($response->json('data.id'))->is_competition);
    }

    public function test_legacy_competition_category_still_accepted(): void
    {
        $this->actingAs($this->student)
            ->postJson('/api/student/achievements', $this->payload(['category' => 'competition']))
            ->assertCreated();
    }

    public function test_competition_flag_can_be_toggled_off(): void
    {
        $response = $this->actingAs($this->student)
            ->postJson('/api/student/achievements', $this->payload(['is_competition' => true]))
            ->assertCreated();

        $id = $response->json('data.id');

        $this->actingAs($this->student)
            ->putJson("/api/student/achievements/{$id}", $this->payload(['is_competition' => false]))
            ->assertOk();

        $this->assertFalse(Achievement::findOrFail($id)->fresh()->is_competition);
    }
}
