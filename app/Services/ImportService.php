<?php

namespace App\Services;

use App\Models\AcademicYear;
use App\Models\ClassStudent;
use App\Models\ImportBatch;
use App\Models\ImportBatchRow;
use App\Models\SchoolClass;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ImportService
{
    public function __construct(private readonly AuditLogger $audit) {}

    // Header template Indonesia -> kolom internal. Kunci: mb_strtolower + spasi dirapatkan.
    private const HEADER_ALIASES = [
        'nama' => 'name',
        'nis/nip' => 'identity_number',
        'nis' => 'identity_number',
        'nip' => 'identity_number',
        'identity_number' => 'identity_number',
        'peran' => 'role',
        'role' => 'role',
        'email' => 'email',
        'kata sandi' => 'password',
        'password' => 'password',
        'id kelas' => 'class_id',
        'id_kelas' => 'class_id',
        'class_id' => 'class_id',
        'id' => 'class_id',
        'nama kelas' => 'class_name',
        'class_name' => 'class_name',
        'kelas' => 'class_name',
        'name' => 'name',
    ];

    private const ROLE_ALIASES = [
        'siswa' => 'student',
        'student' => 'student',
        'murid' => 'student',
        'guru bk' => 'counselor',
        'guru_bk' => 'counselor',
        'guru-bk' => 'counselor',
        'gurubk' => 'counselor',
        'counselor' => 'counselor',
        'konselor' => 'counselor',
    ];

    private function normalizeHeader(string $header): string
    {
        $key = mb_strtolower(trim(preg_replace('/\s+/u', ' ', $header) ?? ''));

        return self::HEADER_ALIASES[$key] ?? Str::snake($key);
    }

    private function normalizeRole(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $key = mb_strtolower(trim(preg_replace('/\s+/u', ' ', $value) ?? ''));

        return self::ROLE_ALIASES[$key] ?? $value;
    }


    public function handle(ImportBatch $batch, User $actor): ImportBatch
    {
        $batch->update(['status' => 'processing']);

        $ext = strtolower(pathinfo($batch->disk_path, PATHINFO_EXTENSION));

        if ($ext === 'xlsx') {
            return $this->handleXlsx($batch, $actor);
        }

        return $this->handleCsv($batch, $actor);
    }

    private function handleCsv(ImportBatch $batch, User $actor): ImportBatch
    {
        $stream = Storage::disk(config('filesystems.upload_disk', 'local'))->readStream($batch->disk_path);
        if (! is_resource($stream)) {
            $batch->update(['status' => 'failed', 'finished_at' => now()]);
            $this->audit->record('user.imported', 'import_batches', $batch->id, null, null, [
                'success' => 0,
                'failed' => 0,
                'error' => 'Berkas impor tidak dapat dibaca dari penyimpanan.',
            ], $actor);

            return $batch->fresh();
        }
        $header = null;
        $rowNumber = 0;
        $success = 0;
        $failed = 0;

        while (($row = fgetcsv($stream)) !== false) {
            $rowNumber++;

            if ($rowNumber === 1) {
                $header = array_map(fn ($h) => $this->normalizeHeader((string) $h), $row);
                continue;
            }

            $payload = [];
            foreach ($header as $index => $column) {
                $payload[$column] = isset($row[$index]) ? trim((string) $row[$index]) : null;
            }

            $this->processRow($batch, $payload, $rowNumber, $success, $failed);
        }

        fclose($stream);

        return $this->finishBatch($batch, $rowNumber, $success, $failed, $actor);
    }

    private function handleXlsx(ImportBatch $batch, User $actor): ImportBatch
    {
        $disk = Storage::disk(config('filesystems.upload_disk', 'local'));
        $tmp = tempnam(sys_get_temp_dir(), 'impor');
        if ($tmp === false) {
            return $this->failBatch($batch, $actor);
        }

        try {
            $contents = $disk->readStream($batch->disk_path);
            if (! is_resource($contents)) {
                return $this->failBatch($batch, $actor);
            }
            file_put_contents($tmp, stream_get_contents($contents));
            if (is_resource($contents)) {
                fclose($contents);
            }

            $reader = \PhpOffice\PhpSpreadsheet\IOFactory::createReaderForFile($tmp);
            $reader->setReadDataOnly(true);
            $rows = $reader->load($tmp)->getActiveSheet()->toArray(null, true, true, false);
        } catch (\Throwable) {
            @unlink($tmp);

            return $this->failBatch($batch, $actor);
        }

        $header = null;
        $rowNumber = 0;
        $success = 0;
        $failed = 0;

        try {
            foreach ($rows as $row) {
                $cells = array_values(is_array($row) ? $row : []);
                $empty = true;
                foreach ($cells as $cell) {
                    if ($cell !== null && trim((string) $cell) !== '') {
                        $empty = false;
                        break;
                    }
                }
                if ($empty) {
                    continue;
                }
                $rowNumber++;

                if ($rowNumber === 1) {
                    $header = array_map(fn ($h) => $this->normalizeHeader((string) ($h ?? '')), $cells);
                    continue;
                }

                $payload = [];
                foreach ($header as $index => $column) {
                    $payload[$column] = isset($cells[$index]) && $cells[$index] !== null ? trim((string) $cells[$index]) : null;
                }

                $this->processRow($batch, $payload, $rowNumber, $success, $failed);
            }
        } finally {
            @unlink($tmp);
        }

        return $this->finishBatch($batch, $rowNumber, $success, $failed, $actor);
    }

    private function failBatch(ImportBatch $batch, User $actor): ImportBatch
    {
        $batch->update(['status' => 'failed', 'finished_at' => now()]);
        $this->audit->record('user.imported', 'import_batches', $batch->id, null, null, [
            'success' => 0,
            'failed' => 0,
            'error' => 'Berkas impor tidak dapat dibaca dari penyimpanan.',
        ], $actor);

        return $batch->fresh();
    }

    private function processRow(ImportBatch $batch, array $payload, int $rowNumber, int &$success, int &$failed): void
    {
        $payload = $this->normalizePayload($payload);
        $error = $this->validateRow($payload);

        if ($error) {
            $failed++;
            ImportBatchRow::create([
                'import_batch_id' => $batch->id,
                'row_number' => $rowNumber,
                'payload' => $payload,
                'status' => 'failed',
                'error_message' => $error,
            ]);

            return;
        }

        DB::transaction(function () use ($payload, $batch, $rowNumber) {
            $class = $this->resolveClassForRow($payload);

            $user = User::create([
                'name' => $payload['name'],
                'email' => $payload['email'] ?: null,
                'identity_number' => $payload['identity_number'],
                'password' => ($payload['password'] ?? null) ?: $payload['identity_number'],
                'role' => $payload['role'],
                'status' => 'active',
                'must_change_password' => true,
            ]);

            if ($class && $user->isStudent()) {
                ClassStudent::create([
                    'class_id' => $class->id,
                    'student_id' => $user->id,
                    'academic_year_id' => $class->academic_year_id,
                    'joined_at' => now()->toDateString(),
                    'status' => 'active',
                ]);
            }

            ImportBatchRow::create([
                'import_batch_id' => $batch->id,
                'row_number' => $rowNumber,
                'payload' => $payload,
                'status' => 'success',
            ]);
        });

        $success++;
    }

    private function finishBatch(ImportBatch $batch, int $rowNumber, int $success, int $failed, User $actor): ImportBatch
    {
        $batch->update([
            'total_rows' => max(0, $rowNumber - 1),
            'success_rows' => $success,
            'failed_rows' => $failed,
            'status' => 'completed',
            'finished_at' => now(),
        ]);

        $this->audit->record('user.imported', 'import_batches', $batch->id, null, null, [
            'success' => $success,
            'failed' => $failed,
        ], $actor);

        return $batch->fresh();
    }
    private function normalizePayload(array $payload): array
    {
        foreach ($payload as $key => $value) {
            if (is_string($value)) {
                $value = trim($value);
                $payload[$key] = $value === '' ? null : $value;
            }
        }

        if (array_key_exists('role', $payload)) {
            $payload['role'] = $this->normalizeRole($payload['role']);
        }

        if (array_key_exists('class_id', $payload) && $payload['class_id'] !== null) {
            $raw = trim((string) $payload['class_id']);
            if (preg_match('/^(\d+)(?:\.0+)?$/', $raw, $m)) {
                $payload['class_id'] = $m[1];
            } else {
                $payload['class_id'] = $raw === '' ? null : $raw;
            }
        }

        return $payload;
    }

    private function validateRow(array $payload): ?string
    {
        foreach (['name', 'identity_number', 'role'] as $field) {
            if (blank($payload[$field] ?? null)) {
                return "Kolom {$field} wajib diisi";
            }
        }

        if (! in_array($payload['role'], ['student', 'counselor'], true)) {
            return 'Peran tidak dikenal';
        }

        if (! blank($payload['email'] ?? null) && ! filter_var($payload['email'], FILTER_VALIDATE_EMAIL)) {
            return 'Format email tidak valid';
        }

        if (User::where('identity_number', $payload['identity_number'])->exists()) {
            return 'NIS/NIP sudah terdaftar';
        }

        if (! blank($payload['email'] ?? null) && User::where('email', $payload['email'])->exists()) {
            return 'Email sudah terdaftar';
        }

        if ($payload['role'] === 'student') {
            $class = $this->resolveClassForRow($payload);

            if ($class === null) {
                if (! blank($payload['class_id'] ?? null)) {
                    return 'ID kelas tidak ditemukan atau sudah diarsip';
                }

                if (blank($payload['class_name'] ?? null)) {
                    return 'Kelas wajib untuk siswa';
                }

                return 'Kelas tidak ditemukan';
            }
        }

        return null;
    }

    private function resolveClassForRow(array $payload): ?SchoolClass
    {
        if (! blank($payload['class_id'] ?? null)) {
            $byId = $this->resolveClassById($payload['class_id']);
            if ($byId !== null) {
                return $byId;
            }
        }

        if (! blank($payload['class_name'] ?? null)) {
            return $this->resolveClass($payload['class_name']);
        }

        return null;
    }

    private function resolveClassById(mixed $value): ?SchoolClass
    {
        if ($value === null) {
            return null;
        }
        $raw = trim((string) $value);
        if (! preg_match('/^(\d+)(?:\.0+)?$/', $raw, $m)) {
            return null;
        }

        return SchoolClass::query()
            ->whereKey((int) $m[1])
            ->where('is_active', true)
            ->first();
    }

    private function resolveClass(?string $name): ?SchoolClass
    {
        if (blank($name)) {
            return null;
        }

        return SchoolClass::query()
            ->where('name', $name)
            ->where('is_active', true)
            ->first();
    }
}
