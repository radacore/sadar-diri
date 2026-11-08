<?php

namespace Tests\Feature;

use App\Models\AcademicYear;
use App\Models\ClassStudent;
use App\Models\ImportBatch;
use App\Models\SchoolClass;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class UserImportXlsxTest extends TestCase
{
    use RefreshDatabase;

    private SchoolClass $class;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $year = AcademicYear::create([
            'name' => '2026/2027',
            'starts_on' => '2026-07-01',
            'ends_on' => '2027-06-30',
            'is_active' => true,
        ]);

        $this->class = SchoolClass::create([
            'academic_year_id' => $year->id,
            'name' => 'X IPA 1',
            'level' => 'X',
        ]);

        $this->admin = User::create([
            'name' => 'Admin',
            'email' => 'admin@example.test',
            'identity_number' => 'ADM001',
            'password' => 'Password123',
            'role' => 'superadmin',
            'status' => 'active',
            'must_change_password' => false,
        ]);
    }

    private function xlsxFile(array $rows, string $name = 'impor.xlsx'): UploadedFile
    {
        $sheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
        $sheet->getActiveSheet()->fromArray($rows, null, 'A1');
        $tmp = tempnam(sys_get_temp_dir(), 'impor-test').'.xlsx';
        \PhpOffice\PhpSpreadsheet\IOFactory::createWriter($sheet, 'Xlsx')->save($tmp);

        return new UploadedFile($tmp, $name, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);
    }

    private function importAsAdmin(UploadedFile $file): void
    {
        $this->actingAs($this->admin)
            ->withoutMiddleware(\App\Http\Middleware\EnsureTwoFactor::class)
            ->postJson('/api/admin/users/import', ['file' => $file])
            ->assertStatus(202);
    }

    public function test_xlsx_empat_kolom_membuat_siswa_dengan_password_nis(): void
    {
        $this->importAsAdmin($this->xlsxFile([
            ['Nama', 'NIS/NIP', 'Email', 'ID Kelas'],
            ['Ayu Lestari', '2024001', '', (string) $this->class->id],
        ]));

        $batch = ImportBatch::firstOrFail();
        $this->assertSame(1, $batch->success_rows);
        $this->assertSame(0, $batch->failed_rows);

        $user = User::where('identity_number', '2024001')->firstOrFail();
        $this->assertSame('student', $user->role);
        $this->assertTrue(Hash::check('2024001', $user->password));
        $this->assertTrue($user->must_change_password);

        $membership = ClassStudent::where('student_id', $user->id)->firstOrFail();
        $this->assertSame($this->class->id, $membership->class_id);
    }

    public function test_xlsx_file_lama_enam_kolom_peran_dan_sandi_diabaikan(): void
    {
        $this->importAsAdmin($this->xlsxFile([
            ['Nama', 'NIS/NIP', 'Peran', 'Email', 'Kata Sandi', 'ID Kelas'],
            ['Budi Santoso', '198501012010', 'guru bk', 'budi@sekolah.sch.id', 'Rahasia123', (string) $this->class->id],
        ]));

        $batch = ImportBatch::firstOrFail();
        $this->assertSame(1, $batch->success_rows);

        $user = User::where('identity_number', '198501012010')->firstOrFail();
        $this->assertSame('student', $user->role);
        $this->assertTrue(Hash::check('198501012010', $user->password));
        $this->assertFalse(Hash::check('Rahasia123', $user->password));
    }

    public function test_xlsx_tanpa_id_kelas_ditolak(): void
    {
        $this->importAsAdmin($this->xlsxFile([
            ['Nama', 'NIS/NIP', 'Email', 'ID Kelas'],
            ['Citra Dewi', '2024003', '', ''],
        ]));

        $batch = ImportBatch::firstOrFail();
        $this->assertSame(0, $batch->success_rows);
        $this->assertSame(1, $batch->failed_rows);
        $this->assertSame(
            'Kelas wajib untuk siswa',
            $batch->rows()->firstOrFail()->error_message
        );
        $this->assertNull(User::where('identity_number', '2024003')->first());
    }

    public function test_xlsx_id_kelas_tak_ada_ditolak_dengan_pesan_jelas(): void
    {
        $this->importAsAdmin($this->xlsxFile([
            ['Nama', 'NIS/NIP', 'Email', 'ID Kelas'],
            ['Dimas Anggara', '2024004', '', '999999'],
        ]));

        $batch = ImportBatch::firstOrFail();
        $this->assertSame(0, $batch->success_rows);
        $this->assertSame(1, $batch->failed_rows);
        $this->assertSame(
            'ID kelas tidak ditemukan atau sudah diarsip',
            $batch->rows()->firstOrFail()->error_message
        );
        $this->assertNull(User::where('identity_number', '2024004')->first());
    }
}
