<?php

namespace Tests\Feature;

use App\Models\AcademicYear;
use App\Models\ClassStudent;
use App\Models\CounselorClass;
use App\Models\MoodEntry;
use App\Models\SchoolClass;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class JournalMoodTest extends TestCase
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

        $counselor = User::create([
            'name' => 'Counselor 198501012010',
            'email' => '198501012010@example.test',
            'identity_number' => '198501012010',
            'password' => 'Password123',
            'role' => 'counselor',
            'status' => 'active',
            'must_change_password' => false,
            'consent_version' => '2026-08-01',
            'consented_at' => now(),
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

        CounselorClass::create([
            'counselor_id' => $counselor->id,
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

    public function test_student_cannot_create_grateful_journal(): void
    {
        $this->actingAs($this->student)
            ->postJson('/api/student/journals', [
                'type' => 'grateful',
                'gratitude_text' => 'Bersyukur bisa sekolah.',
                'happiness_text' => 'Senang.',
                'status' => 'published',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('type');
    }

    public function test_mismatched_emotion_tags_are_rejected(): void
    {
        $this->actingAs($this->student)
            ->postJson('/api/student/moods', [
                'valence' => 'negative',
                'intensity' => 2,
                'emotion_tags' => ['senang'],
            ])
            ->assertUnprocessable()
            ->assertJsonPath('error', 'TAG_MISMATCH');

        $this->actingAs($this->student)
            ->postJson('/api/student/moods', [
                'valence' => 'positive',
                'intensity' => 4,
                'emotion_tags' => ['sedih'],
            ])
            ->assertUnprocessable()
            ->assertJsonPath('error', 'TAG_MISMATCH');
    }

    public function test_matching_emotion_tags_are_accepted(): void
    {
        $this->actingAs($this->student)
            ->postJson('/api/student/moods', [
                'valence' => 'negative',
                'intensity' => 4,
                'emotion_tags' => ['cemas', 'takut'],
            ])
            ->assertCreated();
    }

    public function test_mood_reason_is_optional(): void
    {
        $this->actingAs($this->student)
            ->postJson('/api/student/moods', [
                'valence' => 'positive',
                'intensity' => 4,
                'emotion_tags' => ['senang'],
            ])
            ->assertCreated();

        $entry = MoodEntry::where('student_id', $this->student->id)->firstOrFail();
        $this->assertNull($entry->note);

        $this->actingAs($this->student)
            ->getJson('/api/student/dashboard')
            ->assertOk()
            ->assertJsonPath('data.today_mood.note', null);
    }

    public function test_blank_mood_reason_is_stored_as_null(): void
    {
        $this->actingAs($this->student)
            ->postJson('/api/student/moods', [
                'valence' => 'negative',
                'intensity' => 2,
                'emotion_tags' => ['cemas'],
                'note' => '   ',
            ])
            ->assertCreated();

        $this->assertSame(
            [null],
            MoodEntry::where('student_id', $this->student->id)->pluck('note')->all(),
        );
    }
}
