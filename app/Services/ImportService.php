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

    public function handle(ImportBatch $batch, User $actor): ImportBatch
    {
        $batch->update(['status' => 'processing']);

        $stream = Storage::disk('local')->readStream($batch->disk_path);
        $header = null;
        $rowNumber = 0;
        $success = 0;
        $failed = 0;

        while (($row = fgetcsv($stream)) !== false) {
            $rowNumber++;

            if ($rowNumber === 1) {
                $header = array_map(fn ($h) => Str::snake(trim((string) $h)), $row);
                continue;
            }

            $payload = [];
            foreach ($header as $index => $column) {
                $payload[$column] = isset($row[$index]) ? trim((string) $row[$index]) : null;
            }

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

                continue;
            }

            DB::transaction(function () use ($payload, $batch, $rowNumber) {
                $class = $this->resolveClass($payload['class_name'] ?? null);

                $user = User::create([
                    'name' => $payload['name'],
                    'email' => $payload['email'] ?: null,
                    'identity_number' => $payload['identity_number'],
                    'password' => Str::random(16),
                    'role' => $payload['role'],
                    'status' => 'pending',
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

        fclose($stream);

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

    private function validateRow(array $payload): ?string
    {
        foreach (['name', 'identity_number', 'role'] as $field) {
            if (blank($payload[$field] ?? null)) {
                return "Kolom {$field} wajib diisi";
            }
        }

        if (! in_array($payload['role'], ['student', 'counselor', 'superadmin'], true)) {
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

        if ($payload['role'] === 'student' && blank($payload['class_name'] ?? null)) {
            return 'Kelas wajib untuk siswa';
        }

        if ($payload['role'] === 'student' && $this->resolveClass($payload['class_name'] ?? null) === null) {
            return 'Kelas tidak ditemukan';
        }

        return null;
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
