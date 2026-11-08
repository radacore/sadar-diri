<?php

namespace Tests\Feature;

use App\Models\AcademicYear;
use App\Models\Achievement;
use App\Models\Attachment;
use App\Models\ClassStudent;
use App\Models\SchoolClass;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class S3UploadDiskTest extends TestCase
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

    public function test_achievement_attachment_uses_configured_upload_disk(): void
    {
        Storage::fake('s3');
        config(['filesystems.upload_disk' => 's3']);

        $achievement = Achievement::create([
            'student_id' => $this->student->id,
            'category' => 'academic',
            'title' => 'Juara 1 Olimpiade',
            'organizer' => 'Dinas Pendidikan',
            'level' => 'city',
            'achieved_at' => now()->subDay()->toDateString(),
        ]);

        $this->actingAs($this->student)
            ->postJson("/api/student/achievements/{$achievement->id}/attachments", [
                'file' => UploadedFile::fake()->image('bukti.jpg'),
            ])
            ->assertCreated();

        $attachment = Attachment::firstOrFail();

        $this->assertSame('s3', $attachment->disk);
        Storage::disk('s3')->assertExists($attachment->path);
    }

    public function test_achievement_attachment_download_streams_from_configured_disk(): void
    {
        Storage::fake('s3');
        config(['filesystems.upload_disk' => 's3']);

        $achievement = Achievement::create([
            'student_id' => $this->student->id,
            'category' => 'academic',
            'title' => 'Juara 1 Olimpiade',
            'organizer' => 'Dinas Pendidikan',
            'level' => 'city',
            'achieved_at' => now()->subDay()->toDateString(),
        ]);

        $this->actingAs($this->student)
            ->postJson("/api/student/achievements/{$achievement->id}/attachments", [
                'file' => UploadedFile::fake()->image('bukti.jpg'),
            ])
            ->assertCreated();

        $attachment = Attachment::firstOrFail();

        $response = $this->actingAs($this->student)->get($attachment->signedUrl());

        $response->assertOk();
        $response->assertHeader('content-type', 'image/jpeg');
    }

    public function test_attachment_limit_of_five_is_enforced(): void
    {
        Storage::fake('s3');
        config(['filesystems.upload_disk' => 's3']);

        $achievement = Achievement::create([
            'student_id' => $this->student->id,
            'category' => 'academic',
            'title' => 'Juara 1 Olimpiade',
            'organizer' => 'Dinas Pendidikan',
            'level' => 'city',
            'achieved_at' => now()->subDay()->toDateString(),
        ]);

        for ($i = 0; $i < 5; $i++) {
            $this->actingAs($this->student)
                ->postJson("/api/student/achievements/{$achievement->id}/attachments", [
                    'file' => UploadedFile::fake()->image("bukti-$i.jpg"),
                ])
                ->assertCreated();
        }

        $this->actingAs($this->student)
            ->postJson("/api/student/achievements/{$achievement->id}/attachments", [
                'file' => UploadedFile::fake()->image('bukti-6.jpg'),
            ])
            ->assertUnprocessable()
            ->assertJsonPath('error', 'LIMIT_REACHED');

        $this->assertSame(5, Attachment::count());
        $this->assertCount(5, Storage::disk('s3')->allFiles('private/achievements/'.$this->student->id));
    }

    public function test_rejected_file_type_leaves_no_orphan_on_disk(): void
    {
        Storage::fake('s3');
        config(['filesystems.upload_disk' => 's3']);

        $achievement = Achievement::create([
            'student_id' => $this->student->id,
            'category' => 'academic',
            'title' => 'Juara 1 Olimpiade',
            'organizer' => 'Dinas Pendidikan',
            'level' => 'city',
            'achieved_at' => now()->subDay()->toDateString(),
        ]);

        $this->actingAs($this->student)
            ->postJson("/api/student/achievements/{$achievement->id}/attachments", [
                'file' => UploadedFile::fake()->create('jahat.exe', 200, 'application/x-msdownload'),
            ])
            ->assertUnprocessable();

        $this->assertSame(0, Attachment::count());
        $this->assertCount(0, Storage::disk('s3')->allFiles('private/achievements/'.$this->student->id));
    }

    public function test_student_cannot_download_other_students_attachment(): void
    {
        Storage::fake('s3');
        config(['filesystems.upload_disk' => 's3']);

        $other = User::create([
            'name' => 'Siswa Lain',
            'email' => 'lain@example.test',
            'identity_number' => '2024999',
            'password' => 'Password123',
            'role' => 'student',
            'status' => 'active',
            'must_change_password' => false,
        ]);

        $achievement = Achievement::create([
            'student_id' => $other->id,
            'category' => 'academic',
            'title' => 'Milik orang lain',
            'organizer' => 'Sekolah',
            'level' => 'school',
            'achieved_at' => now()->subDay()->toDateString(),
        ]);

        $attachment = Attachment::create([
            'achievement_id' => $achievement->id,
            'uploaded_by' => $other->id,
            'disk' => 's3',
            'path' => 'private/achievements/'.$other->id.'/milik-orang.jpg',
            'original_name' => 'milik-orang.jpg',
            'mime_type' => 'image/jpeg',
            'size_bytes' => 10,
            'checksum' => 'x',
        ]);
        Storage::disk('s3')->put($attachment->path, 'data');

        $this->actingAs($this->student)->get($attachment->signedUrl())->assertForbidden();
    }

    public function test_deleted_attachment_removes_object_from_disk(): void
    {
        Storage::fake('s3');
        config(['filesystems.upload_disk' => 's3']);

        $achievement = Achievement::create([
            'student_id' => $this->student->id,
            'category' => 'academic',
            'title' => 'Juara 1 Olimpiade',
            'organizer' => 'Dinas Pendidikan',
            'level' => 'city',
            'achieved_at' => now()->subDay()->toDateString(),
        ]);

        $this->actingAs($this->student)
            ->postJson("/api/student/achievements/{$achievement->id}/attachments", [
                'file' => UploadedFile::fake()->image('hapus.jpg'),
            ])
            ->assertCreated();

        $attachment = Attachment::firstOrFail();
        Storage::disk('s3')->assertExists($attachment->path);

        $this->actingAs($this->student)
            ->deleteJson("/api/student/attachments/{$attachment->id}")
            ->assertOk();

        Storage::disk('s3')->assertMissing($attachment->path);
        $this->actingAs($this->student)->get($attachment->signedUrl())->assertNotFound();
    }

    public function test_attachment_download_returns_404_when_object_missing_from_disk(): void
    {
        Storage::fake('local');

        $achievement = Achievement::create([
            'student_id' => $this->student->id,
            'category' => 'academic',
            'title' => 'Juara 1 Olimpiade',
            'organizer' => 'Dinas Pendidikan',
            'level' => 'city',
            'achieved_at' => now()->subDay()->toDateString(),
        ]);

        $attachment = Attachment::create([
            'achievement_id' => $achievement->id,
            'uploaded_by' => $this->student->id,
            'disk' => 'local',
            'path' => 'private/achievements/'.$this->student->id.'/hilang.jpg',
            'original_name' => 'hilang.jpg',
            'mime_type' => 'image/jpeg',
            'size_bytes' => 10,
            'checksum' => 'x',
        ]);

        $this->actingAs($this->student)->get($attachment->signedUrl())->assertNotFound();
    }

    public function test_admin_csv_import_reports_unreadable_storage_file(): void
    {
        Storage::fake('local');

        $admin = User::create([
            'name' => 'Admin',
            'email' => 'admin@example.test',
            'identity_number' => 'ADM001',
            'password' => 'Password123',
            'role' => 'superadmin',
            'status' => 'active',
            'must_change_password' => false,
        ]);

        $batch = \App\Models\ImportBatch::create([
            'filename' => 'hilang.csv',
            'disk_path' => 'private/imports/hilang.csv',
            'status' => 'queued',
            'created_by' => $admin->id,
        ]);

        $service = app(\App\Services\ImportService::class);
        $result = $service->handle($batch, $admin);

        $this->assertSame('failed', $result->status);
        $this->assertNotNull($result->finished_at);
    }

    public function test_attachment_upload_reports_storage_failure_instead_of_corrupt_row(): void
    {
        file_put_contents($broken = sys_get_temp_dir().'/s3test-broken-root', 'bukan direktori');
        config([
            'filesystems.upload_disk' => 'broken',
            'filesystems.disks.broken' => ['driver' => 'local', 'root' => $broken, 'throw' => false],
        ]);

        $achievement = Achievement::create([
            'student_id' => $this->student->id,
            'category' => 'academic',
            'title' => 'Juara 1 Olimpiade',
            'organizer' => 'Dinas Pendidikan',
            'level' => 'city',
            'achieved_at' => now()->subDay()->toDateString(),
        ]);

        $this->actingAs($this->student)
            ->postJson("/api/student/achievements/{$achievement->id}/attachments", [
                'file' => UploadedFile::fake()->image('gagal.jpg'),
            ])
            ->assertStatus(503)
            ->assertJsonPath('error', 'STORAGE_UNAVAILABLE');

        $this->assertSame(0, Attachment::count());

        @unlink($broken);
    }

    public function test_admin_import_reports_storage_failure(): void
    {
        file_put_contents($broken = sys_get_temp_dir().'/s3test-broken-import', 'bukan direktori');
        config([
            'filesystems.upload_disk' => 'broken',
            'filesystems.disks.broken' => ['driver' => 'local', 'root' => $broken, 'throw' => false],
        ]);

        $admin = User::create([
            'name' => 'Admin',
            'email' => 'admin2@example.test',
            'identity_number' => 'ADM002',
            'password' => 'Password123',
            'role' => 'superadmin',
            'status' => 'active',
            'must_change_password' => false,
        ]);

        $csv = "name,email,identity_number,role,class_name\nsiswa impor,impor@example.test,2024100,student,X IPA 1\n";

        $this->actingAs($admin)
            ->withoutMiddleware(\App\Http\Middleware\EnsureTwoFactor::class)
            ->postJson('/api/admin/users/import', [
                'file' => UploadedFile::fake()->createWithContent('siswa.csv', $csv),
            ])
            ->assertStatus(503)
            ->assertJsonPath('error', 'STORAGE_UNAVAILABLE');

        @unlink($broken);
    }

    public function test_expired_signed_url_is_rejected(): void
    {
        Storage::fake('s3');
        config(['filesystems.upload_disk' => 's3']);

        $achievement = Achievement::create([
            'student_id' => $this->student->id,
            'category' => 'academic',
            'title' => 'Juara 1 Olimpiade',
            'organizer' => 'Dinas Pendidikan',
            'level' => 'city',
            'achieved_at' => now()->subDay()->toDateString(),
        ]);

        $attachment = Attachment::create([
            'achievement_id' => $achievement->id,
            'uploaded_by' => $this->student->id,
            'disk' => 's3',
            'path' => 'private/achievements/'.$this->student->id.'/kedaluwarsa.jpg',
            'original_name' => 'kedaluwarsa.jpg',
            'mime_type' => 'image/jpeg',
            'size_bytes' => 10,
            'checksum' => 'x',
        ]);
        Storage::disk('s3')->put($attachment->path, 'data');

        $expired = \Illuminate\Support\Facades\URL::temporarySignedRoute(
            'attachments.show', now()->subMinute(), ['attachment' => $attachment->id]
        );

        $this->actingAs($this->student)->get($expired)->assertForbidden();

        $fresh = $attachment->signedUrl();
        $this->actingAs($this->student)->get($fresh)->assertOk();
    }

    public function test_admin_csv_import_uses_configured_upload_disk(): void
    {
        Storage::fake('s3');
        config(['filesystems.upload_disk' => 's3', 'filesystems.disks.s3.throw' => true]);

        $admin = User::create([
            'name' => 'Admin',
            'two_factor_secret' => null,
            'email' => 'admin@example.test',
            'identity_number' => 'ADM001',
            'password' => 'Password123',
            'role' => 'superadmin',
            'status' => 'active',
            'must_change_password' => false,
        ]);

        $csv = "name,email,identity_number,role,class_name\nsiswa baru,baru@example.test,2024099,student,X IPA 1\n";

        $this->actingAs($admin)
            ->withoutMiddleware(\App\Http\Middleware\EnsureTwoFactor::class)
            ->postJson('/api/admin/users/import', [
                'file' => UploadedFile::fake()->createWithContent('siswa.csv', $csv),
            ])
            ->assertStatus(202);

        $batch = \App\Models\ImportBatch::firstOrFail();

        Storage::disk('s3')->assertExists($batch->disk_path);
        $this->assertSame(1, $batch->total_rows);
    }
}
