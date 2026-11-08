<?php

namespace Tests\Feature;

use App\Models\AcademicYear;
use App\Models\ClassStudent;
use App\Models\ImportBatch;
use App\Models\SchoolClass;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
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

    public function test_xlsx_header_indonesia_dan_id_kelas_membuat_siswa(): void
    {
        $this->importAsAdmin($this->xlsxFile([
            ['Nama', 'NIS/NIP', 'Peran', 'Email', 'Kata Sandi', 'ID Kelas'],
            ['Ayu Lestari', '2024001', 'siswa', '', '', (string) $this->class->id],
        ]));

        $batch = ImportBatch::firstOrFail();
        $this->assertSame(1, $batch->success_rows);
        $this->assertSame(0, $batch->failed_rows);

        $user = User::where('identity_number', '2024001')->firstOrFail();
        $this->assertSame('student', $user->role);
        $this->assertTrue($user->must_change_password);

        $membership = ClassStudent::where('student_id', $user->id)->firstOrFail();
        $this->assertSame($this->class->id, $membership->class_id);
    }

    public function test_xlsx_peran_guru_bk_tanpa_kelas_berhasil(): void
    {
        $this->importAsAdmin($this->xlsxFile([
            ['Nama', 'NIS/NIP', 'Peran', 'Email', 'Kata Sandi', 'ID Kelas'],
            ['Budi Santoso', '198501012010', 'guru bk', 'budi@sekolah.sch.id', '', ''],
        ]));

        $batch = ImportBatch::firstOrFail();
        $this->assertSame(1, $batch->success_rows);

        $user = User::where('identity_number', '198501012010')->firstOrFail();
        $this->assertSame('counselor', $user->role);
        $this->assertSame(0, ClassStudent::where('student_id', $user->id)->count());
    }

    public function test_xlsx_id_kelas_tak_ada_ditolak_dengan_pesan_jelas(): void
    {
        $this->importAsAdmin($this->xlsxFile([
            ['Nama', 'NIS/NIP', 'Peran', 'Email', 'Kata Sandi', 'ID Kelas'],
            ['Citra Dewi', '2024003', 'siswa', '', '', '999999'],
        ]));

        $batch = ImportBatch::firstOrFail();
        $this->assertSame(0, $batch->success_rows);
        $this->assertSame(1, $batch->failed_rows);
        $this->assertSame(
            'ID kelas tidak ditemukan atau sudah diarsip',
            $batch->rows()->firstOrFail()->error_message
        );
        $this->assertNull(User::where('identity_number', '2024003')->first());
    }

    public function test_csv_inggris_nama_kelas_lama_tetap_kompatibel(): void
    {
        $csv = "name,identity_number,role,email,password,class_name\nDimas Anggara,2024004,student,,,\"X IPA 1\"\n";

        $this->actingAs($this->admin)
            ->withoutMiddleware(\App\Http\Middleware\EnsureTwoFactor::class)
            ->postJson('/api/admin/users/import', [
                'file' => UploadedFile::fake()->createWithContent('lama.csv', $csv),
            ])
            ->assertStatus(202);

        $batch = ImportBatch::firstOrFail();
        $this->assertSame(1, $batch->success_rows);

        $user = User::where('identity_number', '2024004')->firstOrFail();
        $this->assertSame($this->class->id, ClassStudent::where('student_id', $user->id)->firstOrFail()->class_id);
    }
}
