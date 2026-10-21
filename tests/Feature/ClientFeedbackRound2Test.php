<?php

namespace Tests\Feature;

use App\Models\AcademicYear;
use App\Models\ActionPlan;
use App\Models\ActionTarget;
use App\Models\ActionTargetStep;
use App\Models\ClassStudent;
use App\Models\CounselorClass;
use App\Models\Reflection;
use App\Models\SchoolClass;
use App\Models\StudentProfile;
use App\Models\User;
use App\Services\SettingsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class ClientFeedbackRound2Test extends TestCase
{
    use RefreshDatabase;

    private User $counselor;

    private User $student;

    protected function setUp(): void
    {
        parent::setUp();

        Notification::fake();
        Carbon::setTestNow(Carbon::parse('2026-10-21 09:00:00', 'Asia/Jakarta'));

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

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
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

    public function test_student_can_store_and_read_extra_biodata_fields(): void
    {
        $this->actingAs($this->student)
            ->putJson('/api/student/profile/biodata', [
                'extra_fields' => [
                    ['label' => 'Ukuran seragam', 'value' => 'L'],
                    ['label' => '', 'value' => 'baris tidak lengkap'],
                ],
            ])
            ->assertOk();

        $profile = StudentProfile::where('user_id', $this->student->id)->firstOrFail();
        $this->assertSame([['label' => 'Ukuran seragam', 'value' => 'L']], $profile->extra_fields);
        $this->assertStringNotContainsString('Ukuran seragam', (string) DB::table('student_profiles')->value('extra_fields'));

        $this->actingAs($this->student)
            ->getJson('/api/student/profile')
            ->assertOk()
            ->assertJsonPath('data.biodata.extra_fields.0.label', 'Ukuran seragam');
    }

    public function test_biodata_update_without_extra_fields_keeps_existing_rows(): void
    {
        $this->actingAs($this->student)
            ->putJson('/api/student/profile/biodata', [
                'extra_fields' => [['label' => 'Ukuran seragam', 'value' => 'L']],
            ])
            ->assertOk();

        $this->actingAs($this->student)
            ->putJson('/api/student/profile/biodata', ['address' => 'Jl. Baru 1'])
            ->assertOk();

        $profile = StudentProfile::where('user_id', $this->student->id)->firstOrFail();
        $this->assertSame('Jl. Baru 1', $profile->address);
        $this->assertSame([['label' => 'Ukuran seragam', 'value' => 'L']], $profile->extra_fields);
    }

    public function test_counselor_can_update_extra_fields(): void
    {
        $this->actingAs($this->counselor)
            ->putJson('/api/counselor/students/'.$this->student->id.'/profile/biodata', [
                'extra_fields' => [['label' => 'Ukuran sepatu', 'value' => '42']],
            ])
            ->assertOk();

        $profile = StudentProfile::where('user_id', $this->student->id)->firstOrFail();
        $this->assertSame([['label' => 'Ukuran sepatu', 'value' => '42']], $profile->extra_fields);

        $this->actingAs($this->counselor)
            ->getJson('/api/counselor/students/'.$this->student->id.'/overview')
            ->assertOk()
            ->assertJsonPath('data.profile.biodata.extra_fields.0.label', 'Ukuran sepatu');
    }

    public function test_mood_requires_a_reason(): void
    {
        $this->actingAs($this->student)
            ->postJson('/api/student/moods', [
                'valence' => 'positive',
                'intensity' => 4,
                'emotion_tags' => ['senang'],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('note');

        $this->actingAs($this->student)
            ->postJson('/api/student/moods', [
                'valence' => 'positive',
                'intensity' => 4,
                'emotion_tags' => ['senang'],
                'note' => 'Karena nilai ujian membaik.',
            ])
            ->assertCreated();

        $this->actingAs($this->student)
            ->getJson('/api/student/dashboard')
            ->assertOk()
            ->assertJsonPath('data.today_mood.note', 'Karena nilai ujian membaik.');
    }

    public function test_curhat_button_uses_assigned_counselor_number(): void
    {
        $this->counselor->forceFill(['phone' => '628111111111'])->save();
        app(SettingsService::class)->set('school.whatsapp_number', '628999999999');

        $this->actingAs($this->student)
            ->postJson('/api/student/whatsapp-link', ['context' => 'curhat lanjutan'])
            ->assertOk()
            ->assertJsonPath('data.counselor_name', $this->counselor->name)
            ->assertJsonPath('data.source', 'counselor')
            ->assertJsonPath('data.url', fn ($url) => str_starts_with($url, 'https://wa.me/628111111111?text='));
    }

    public function test_counselor_phone_is_rejected_when_invalid(): void
    {
        $admin = $this->user('superadmin', '9001');

        $this->actingAs($admin)
            ->withSession(['two_factor_passed' => true])
            ->postJson('/api/admin/users', [
                'name' => 'Rina Wati',
                'identity_number' => '198501012011',
                'role' => 'counselor',
                'password' => 'Password123',
                'phone' => '0812-3456',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('phone');
    }

    public function test_curhat_button_falls_back_to_school_number(): void
    {
        $this->counselor->forceFill(['phone' => null])->save();
        app(SettingsService::class)->set('school.whatsapp_number', '6281234567890');

        $this->actingAs($this->student)
            ->postJson('/api/student/whatsapp-link')
            ->assertOk()
            ->assertJsonPath('data.counselor_name', 'Layanan BK sekolah')
            ->assertJsonPath('data.source', 'school')
            ->assertJsonPath('data.url', fn ($url) => str_starts_with($url, 'https://wa.me/6281234567890?text='));
    }

    public function test_curhat_button_requires_a_number(): void
    {
        $this->counselor->forceFill(['phone' => null])->save();
        app(SettingsService::class)->set('school.whatsapp_number', null);

        $this->actingAs($this->student)
            ->postJson('/api/student/whatsapp-link')
            ->assertStatus(409)
            ->assertJsonPath('error', 'WHATSAPP_NOT_CONFIGURED');
    }

    public function test_weekly_reflection_is_mandatory_only_on_weekend(): void
    {
        $this->actingAs($this->student)
            ->getJson('/api/student/dashboard')
            ->assertOk()
            ->assertJsonPath('data.weekly_reflection.mandatory', false);

        Carbon::setTestNow(Carbon::parse('2026-10-23 09:00:00', 'Asia/Jakarta'));

        $this->actingAs($this->student)
            ->getJson('/api/student/dashboard')
            ->assertOk()
            ->assertJsonPath('data.weekly_reflection.mandatory', true)
            ->assertJsonPath('data.weekly_reflection.submitted', false);
    }

    public function test_weekly_reflection_requires_gratitude_and_marks_dashboard(): void
    {
        $this->actingAs($this->student)
            ->postJson('/api/student/reflections', [
                'positive_experience' => 'Belajar bersama teman.',
                'negative_experience' => 'Sulit bangun pagi.',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('gratitude_text');

        $this->actingAs($this->student)
            ->postJson('/api/student/reflections', [
                'gratitude_text' => 'Kesehatan keluarga.',
                'negative_experience' => 'Sulit bangun pagi.',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('positive_experience');

        $this->actingAs($this->student)
            ->postJson('/api/student/reflections', [
                'gratitude_text' => 'Kesehatan keluarga.',
                'positive_experience' => 'Belajar bersama teman.',
            ])
            ->assertCreated();

        $this->assertSame('2026-10-19', Reflection::firstOrFail()->week_start->toDateString());

        $this->actingAs($this->student)
            ->getJson('/api/student/dashboard')
            ->assertOk()
            ->assertJsonPath('data.weekly_reflection.submitted', true)
            ->assertJsonPath('data.weekly_reflection.gratitude_text', 'Kesehatan keluarga.');
    }

    public function test_reflection_reminder_only_notifies_students_without_entry(): void
    {
        $other = $this->user('student', '2024002');

        Reflection::create([
            'student_id' => $this->student->id,
            'type' => 'self',
            'week_start' => '2026-10-19',
            'gratitude_text' => 'Keluarga sehat.',
            'positive_experience' => 'Baik.',
            'negative_experience' => 'Lelah.',
            'status' => 'submitted',
            'submitted_at' => now(),
        ]);

        $this->artisan('sadar:reflection-reminder')->assertSuccessful();

        Notification::assertNotSentTo($this->student, \App\Notifications\AppNotification::class);
        Notification::assertSentTo($other, \App\Notifications\AppNotification::class);
    }

    public function test_target_steps_can_be_created_toggled_and_deleted(): void
    {
        $plan = ActionPlan::create([
            'student_id' => $this->student->id,
            'period_start' => '2026-10-01',
            'period_end' => '2026-10-31',
            'status' => 'active',
        ]);

        $response = $this->actingAs($this->student)
            ->postJson('/api/student/action-plans/'.$plan->id.'/targets', [
                'title' => 'Bangun pagi',
                'success_indicator' => 'Bangun sebelum 06.00 selama 5 hari',
                'basis' => 'reflection',
                'steps' => ['Pasang alarm', 'Tidur sebelum 22.00'],
            ])
            ->assertCreated();

        $target = ActionTarget::findOrFail($response->json('data.id'));
        $this->assertSame('reflection', $target->basis);
        $this->assertSame(2, $target->steps()->count());

        $step = $target->steps()->firstOrFail();

        $this->actingAs($this->student)
            ->putJson('/api/student/action-steps/'.$step->id, ['is_done' => true])
            ->assertOk()
            ->assertJsonPath('data.is_done', true);

        $this->actingAs($this->student)
            ->getJson('/api/student/action-plans/current')
            ->assertOk()
            ->assertJsonPath('data.targets.0.basis', 'reflection')
            ->assertJsonPath('data.targets.0.steps.0.is_done', true);

        $this->actingAs($this->student)
            ->deleteJson('/api/student/action-steps/'.$step->id)
            ->assertOk();

        $this->assertSame(1, ActionTargetStep::where('action_target_id', $target->id)->count());
    }

    public function test_counselor_sees_steps_and_missing_reflection_filter(): void
    {
        $plan = ActionPlan::create([
            'student_id' => $this->student->id,
            'period_start' => '2026-10-01',
            'period_end' => '2026-10-31',
            'status' => 'active',
        ]);

        $target = $plan->targets()->create([
            'title' => 'Bangun pagi',
            'success_indicator' => 'Lima hari',
            'basis' => 'general',
            'status' => 'in_progress',
            'sort_order' => 1,
        ]);

        $target->steps()->create(['title' => 'Pasang alarm', 'sort_order' => 1]);

        $this->actingAs($this->counselor)
            ->getJson('/api/counselor/students/'.$this->student->id.'/action-plan')
            ->assertOk()
            ->assertJsonPath('data.plan.targets.0.steps.0.title', 'Pasang alarm');

        $this->actingAs($this->counselor)
            ->getJson('/api/counselor/students?reflection=missing')
            ->assertOk()
            ->assertJsonPath('data.0.id', $this->student->id)
            ->assertJsonPath('data.0.weekly_reflection_done', false);

        $this->actingAs($this->counselor)
            ->getJson('/api/counselor/dashboard')
            ->assertOk()
            ->assertJsonPath('data.weekly_reflection.missing', 1);
    }
}
