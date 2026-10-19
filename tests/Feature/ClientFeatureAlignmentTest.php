<?php

namespace Tests\Feature;

use App\Models\AcademicYear;
use App\Models\Achievement;
use App\Models\ActionPlan;
use App\Models\ActionTarget;
use App\Models\ClassStudent;
use App\Models\CounselorClass;
use App\Models\FuturePlan;
use App\Models\JournalEntry;
use App\Models\JournalReply;
use App\Models\SchoolClass;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class ClientFeatureAlignmentTest extends TestCase
{
    use RefreshDatabase;

    private User $counselor;

    private User $student;

    private User $outsider;

    protected function setUp(): void
    {
        parent::setUp();

        Notification::fake();

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

        $this->counselor = $this->user('counselor', '198501012010');
        $this->student = $this->user('student', '2024001');
        $this->outsider = $this->user('student', '2024099');

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

    private function journal(array $attributes = []): JournalEntry
    {
        return JournalEntry::create($attributes + [
            'student_id' => $this->student->id,
            'type' => 'abc',
            'entry_date' => now()->toDateString(),
            'activating_event' => 'Presentasi kelompok.',
            'belief' => 'Saya akan gagal.',
            'consequence' => 'Cemas seharian.',
            'status' => 'published',
        ]);
    }

    public function test_counselor_can_read_and_update_biodata(): void
    {
        $response = $this->actingAs($this->counselor)
            ->putJson('/api/counselor/students/'.$this->student->id.'/profile/biodata', [
                'birth_date' => '2010-05-04',
                'gender' => 'female',
                'address' => 'Jl. Melati 2',
                'phone' => '081200000000',
                'height_cm' => 155,
                'weight_kg' => 48,
                'blood_type' => 'A',
                'medical_history' => 'Asma',
                'health_notes' => 'Membawa inhaler',
            ])
            ->assertOk();

        $this->assertGreaterThan(0, $response->json('data.completeness_percent'));

        $profile = StudentProfile::where('user_id', $this->student->id)->firstOrFail();
        $this->assertSame('Jl. Melati 2', $profile->address);
        $this->assertSame('Asma', $profile->medical_history);
    }

    public function test_counselor_can_update_self_profile_and_version_is_recorded(): void
    {
        $this->actingAs($this->counselor)
            ->putJson('/api/counselor/students/'.$this->student->id.'/profile/self', [
                'psychological_summary' => 'Cenderung tenang.',
                'character_summary' => 'Disiplin.',
                'strengths' => 'Tekun',
                'weaknesses' => 'Sulit menolak',
            ])
            ->assertOk();

        $this->assertDatabaseHas('student_profile_versions', [
            'created_by' => $this->counselor->id,
        ]);
    }

    public function test_counselor_cannot_edit_student_outside_their_class(): void
    {
        $this->actingAs($this->counselor)
            ->putJson('/api/counselor/students/'.$this->outsider->id.'/profile/biodata', ['address' => 'X'])
            ->assertForbidden();
    }

    public function test_counselor_can_add_verified_achievement(): void
    {
        $response = $this->actingAs($this->counselor)
            ->postJson('/api/counselor/students/'.$this->student->id.'/achievements', [
                'category' => 'competition',
                'title' => 'Juara 1 Cerdas Cermat',
                'level' => 'district',
                'achieved_at' => now()->subDay()->toDateString(),
            ])
            ->assertCreated();

        $achievement = Achievement::findOrFail($response->json('data.id'));

        $this->assertSame('verified', $achievement->verification_status);
        $this->assertSame($this->counselor->id, $achievement->created_by);
        $this->assertSame($this->student->id, $achievement->student_id);
    }

    public function test_student_follow_up_request_notifies_counselor(): void
    {
        $response = $this->actingAs($this->student)
            ->postJson('/api/student/journals', [
                'type' => 'grateful',
                'gratitude_text' => 'Bersyukur bisa sekolah.',
                'follow_up_requested' => true,
                'status' => 'published',
            ])
            ->assertCreated();

        $entry = JournalEntry::findOrFail($response->json('data.id'));

        $this->assertTrue($entry->follow_up_requested);
        $this->assertNotNull($entry->follow_up_requested_at);
        Notification::assertSentTo($this->counselor, \App\Notifications\AppNotification::class);
    }

    public function test_student_can_skip_follow_up(): void
    {
        $response = $this->actingAs($this->student)
            ->postJson('/api/student/journals', [
                'type' => 'grateful',
                'gratitude_text' => 'Hari biasa saja.',
                'follow_up_requested' => false,
                'status' => 'published',
            ])
            ->assertCreated();

        $this->assertFalse(JournalEntry::findOrFail($response->json('data.id'))->follow_up_requested);
        Notification::assertNothingSent();
    }

    public function test_counselor_reply_is_visible_to_student(): void
    {
        $entry = $this->journal();

        $this->actingAs($this->counselor)
            ->postJson('/api/counselor/journals/'.$entry->id.'/replies', [
                'content' => 'Terima kasih sudah bercerita. Kita bicarakan besok, ya.',
            ])
            ->assertCreated();

        $this->assertSame(1, JournalReply::where('journal_entry_id', $entry->id)->count());

        $this->actingAs($this->student)
            ->getJson('/api/student/journals/'.$entry->id)
            ->assertOk()
            ->assertJsonPath('data.replies.0.content', 'Terima kasih sudah bercerita. Kita bicarakan besok, ya.')
            ->assertJsonPath('data.replies.0.counselor_name', $this->counselor->name);

        Notification::assertSentTo($this->student, \App\Notifications\AppNotification::class);
    }

    public function test_counselor_cannot_reply_to_outsider_journal(): void
    {
        $entry = JournalEntry::create([
            'student_id' => $this->outsider->id,
            'type' => 'grateful',
            'entry_date' => now()->toDateString(),
            'gratitude_text' => 'Hari ini tenang.',
            'status' => 'published',
        ]);

        $this->actingAs($this->counselor)
            ->postJson('/api/counselor/journals/'.$entry->id.'/replies', ['content' => 'Halo'])
            ->assertForbidden();
    }

    public function test_journal_reply_is_encrypted_at_rest(): void
    {
        $entry = $this->journal();

        $this->actingAs($this->counselor)
            ->postJson('/api/counselor/journals/'.$entry->id.'/replies', ['content' => 'Tetap tenang ya.'])
            ->assertCreated();

        $raw = \DB::table('journal_replies')->where('journal_entry_id', $entry->id)->value('content');

        $this->assertStringNotContainsString('Tetap tenang ya.', (string) $raw);
        $this->assertSame('Tetap tenang ya.', JournalReply::firstOrFail()->content);
    }

    public function test_counselor_can_see_action_plan_and_future_plan(): void
    {
        $plan = ActionPlan::create([
            'student_id' => $this->student->id,
            'period_start' => now()->startOfMonth()->toDateString(),
            'period_end' => now()->endOfMonth()->toDateString(),
            'status' => 'active',
        ]);

        ActionTarget::create([
            'action_plan_id' => $plan->id,
            'title' => 'Belajar matematika 3x seminggu',
            'success_indicator' => 'Nilai minimal 80',
            'status' => 'in_progress',
            'sort_order' => 1,
        ]);

        FuturePlan::create([
            'student_id' => $this->student->id,
            'dream' => 'Menjadi dokter',
            'career_plan' => 'Kedokteran',
            'education_plan' => 'Kedokteran UI',
            'concrete_targets' => 'Ikut bimbel biologi',
        ]);

        $this->actingAs($this->counselor)
            ->getJson('/api/counselor/students/'.$this->student->id.'/action-plan')
            ->assertOk()
            ->assertJsonPath('data.plan.targets.0.title', 'Belajar matematika 3x seminggu')
            ->assertJsonPath('data.future_plan.dream', 'Menjadi dokter');
    }

    public function test_counselor_overview_includes_biodata_and_self_profile(): void
    {
        StudentProfile::create([
            'user_id' => $this->student->id,
            'birth_date' => '2010-05-04',
            'address' => 'Jl. Melati 2',
            'psychological_summary' => 'Cenderung tenang.',
            'completeness_percent' => 40,
        ]);

        $this->actingAs($this->counselor)
            ->getJson('/api/counselor/students/'.$this->student->id.'/overview')
            ->assertOk()
            ->assertJsonPath('data.profile.biodata.address', 'Jl. Melati 2')
            ->assertJsonPath('data.profile.self_profile.psychological_summary', 'Cenderung tenang.');
    }
}
