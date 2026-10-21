<?php

namespace Tests\Feature;

use App\Models\AcademicYear;
use App\Models\AuditLog;
use App\Models\ClassStudent;
use App\Models\CounselorClass;
use App\Models\JournalEntry;
use App\Models\Reflection;
use App\Models\ReflectionSession;
use App\Models\SchoolClass;
use App\Models\User;
use App\Services\RetentionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PrivacyFlowTest extends TestCase
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

    private function classWithStudents(User $counselor, int $count): SchoolClass
    {
        static $seq = 0;
        $seq++;

        $year = AcademicYear::create([
            'name' => '2026/202'.$seq,
            'starts_on' => '2026-07-01',
            'ends_on' => '2027-06-30',
            'is_active' => true,
        ]);

        $class = SchoolClass::create([
            'academic_year_id' => $year->id,
            'name' => 'X IPA '.$seq,
            'level' => 'X',
        ]);

        CounselorClass::create([
            'counselor_id' => $counselor->id,
            'class_id' => $class->id,
            'assigned_at' => now(),
        ]);

        foreach (range(1, $count) as $i) {
            $student = $this->user('student', '2024'.$seq.str_pad((string) $i, 2, '0', STR_PAD_LEFT));
            ClassStudent::create([
                'class_id' => $class->id,
                'student_id' => $student->id,
                'academic_year_id' => $year->id,
                'joined_at' => '2026-07-01',
                'status' => 'active',
            ]);
        }

        return $class;
    }

    public function test_student_can_revoke_and_reactivate_consent_without_counselor(): void
    {
        $counselor = $this->user('counselor', '199001');
        $class = $this->classWithStudents($counselor, 1);
        $student = User::where('role', 'student')->firstOrFail();

        $this->actingAs($student)
            ->getJson('/api/student/privacy/consent')
            ->assertOk()
            ->assertJsonPath('data.has_consent', true);

        $this->actingAs($student)
            ->deleteJson('/api/auth/consent')
            ->assertOk();

        $this->assertFalse($student->fresh()->hasConsent());

        $this->actingAs($student)
            ->getJson('/api/student/privacy/consent')
            ->assertOk()
            ->assertJsonPath('data.has_consent', false)
            ->assertJsonPath('data.consented_at', null);

        // Fitur jurnal terkunci selama persetujuan dicabut.
        $this->actingAs($student)
            ->getJson('/api/student/journals')
            ->assertForbidden();

        $version = app(\App\Services\SettingsService::class)->get('privacy.consent_version', '2026-08-01');

        $this->actingAs($student)
            ->postJson('/api/auth/consent', ['version' => $version, 'accepted' => true])
            ->assertOk();

        $this->assertTrue($student->fresh()->hasConsent());

        $this->actingAs($student)
            ->getJson('/api/student/journals')
            ->assertOk();
    }

    public function test_guided_session_stays_open_until_counselor_closes_it(): void
    {
        $counselor = $this->user('counselor', '199001');
        $class = $this->classWithStudents($counselor, 2);
        $students = User::where('role', 'student')->orderBy('id')->get();

        $session = ReflectionSession::create([
            'counselor_id' => $counselor->id,
            'class_id' => $class->id,
            'topic' => 'Menjaga fokus belajar',
            'questions' => ['Apa yang mengganggu fokusmu?'],
            'due_at' => now()->addDays(3),
            'status' => 'scheduled',
        ]);

        $payload = ['answers' => [['question' => 'Apa yang mengganggu fokusmu?', 'answer' => 'Media sosial.']]];

        $this->actingAs($students[0])
            ->postJson('/api/student/reflection-sessions/'.$session->id.'/submit', $payload)
            ->assertCreated();

        $this->assertSame('ongoing', $session->fresh()->status);
        $this->assertSame(1, $session->reflections()->count());

        // Siswa kedua tetap bisa mengirim setelah siswa pertama mengirim.
        $this->actingAs($students[1])
            ->postJson('/api/student/reflection-sessions/'.$session->id.'/submit', $payload)
            ->assertCreated();

        $this->assertSame(2, $session->reflections()->count());

        $session->update(['status' => 'completed']);

        $this->actingAs($students[0])
            ->postJson('/api/student/reflection-sessions/'.$session->id.'/submit', $payload)
            ->assertStatus(409);
    }

    public function test_guided_answers_are_encrypted_at_rest(): void
    {
        $counselor = $this->user('counselor', '199001');
        $class = $this->classWithStudents($counselor, 1);
        $student = User::where('role', 'student')->firstOrFail();

        $session = ReflectionSession::create([
            'counselor_id' => $counselor->id,
            'class_id' => $class->id,
            'topic' => 'Refleksi pekan',
            'questions' => ['Satu langkah kecil?'],
            'due_at' => now()->addDays(3),
            'status' => 'scheduled',
        ]);

        $this->actingAs($student)
            ->postJson('/api/student/reflection-sessions/'.$session->id.'/submit', [
                'answers' => [['question' => 'Satu langkah kecil?', 'answer' => 'Tidur lebih awal.']],
            ])
            ->assertCreated();

        $raw = DB::table('reflections')->where('session_id', $session->id)->value('answers');
        $this->assertNotSame('', (string) $raw);
        $this->assertStringNotContainsString('Tidur lebih awal', (string) $raw);
        $this->assertSame('Tidur lebih awal.', Reflection::firstOrFail()->answers[0]['answer']);
    }

    public function test_retention_anonymizes_old_alumni_and_purges_their_journals(): void
    {
        $admin = $this->user('superadmin', 'admin');

        $oldAlumni = $this->user('student', '2015001', ['status' => 'alumni']);
        $recentAlumni = $this->user('student', '2025001', ['status' => 'alumni']);

        JournalEntry::create([
            'student_id' => $oldAlumni->id,
            'type' => 'grateful',
            'entry_date' => now()->toDateString(),
            'gratitude_text' => 'Catatan lama.',
            'status' => 'published',
        ]);

        DB::table('users')->where('id', $oldAlumni->id)->update(['updated_at' => now()->subYears(5)]);
        DB::table('users')->where('id', $recentAlumni->id)->update(['updated_at' => now()->subMonths(2)]);

        $result = app(RetentionService::class)->run($admin, 'Kebijakan retensi sekolah');

        $this->assertSame(1, $result['students_anonymized']);
        $this->assertSame('Alumni Anonim #'.$oldAlumni->id, $oldAlumni->fresh()->name);
        $this->assertNull($oldAlumni->fresh()->email);
        $this->assertNotNull($oldAlumni->fresh()->anonymized_at);
        $this->assertSame(0, JournalEntry::where('student_id', $oldAlumni->id)->count());
        $this->assertNotNull($recentAlumni->fresh()->email);
        $this->assertTrue(AuditLog::where('action', 'retention.run')->exists());
    }

    public function test_aggregate_suppresses_classes_smaller_than_ten_students(): void
    {
        $admin = $this->user('superadmin', 'admin');
        $counselor = $this->user('counselor', '199001');

        $small = $this->classWithStudents($counselor, 9);
        $large = $this->classWithStudents($counselor, 10);

        $response = $this->actingAs($admin)
            ->withSession(['two_factor_passed' => true])
            ->getJson('/api/admin/reports/aggregate')
            ->assertOk();

        $suppressed = collect($response->json('data.suppressed_groups'))->pluck('class_name');
        $groups = collect($response->json('data.groups'))->pluck('class_name');

        $this->assertTrue($suppressed->contains($small->name));
        $this->assertFalse($groups->contains($small->name));
        $this->assertTrue($groups->contains($large->name));
    }
}
