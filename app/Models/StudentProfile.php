<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Validation\ValidationException;

class StudentProfile extends Model
{
    /** Platform media sosial yang diterima formulir biodata. */
    public const SOCIAL_PLATFORMS = ['instagram', 'facebook', 'youtube', 'threads', 'tiktok'];

    /** Agama yang diterima, mengikuti kolom "Agama" pada identitas peserta didik. */
    public const RELIGIONS = ['islam', 'kristen', 'katolik', 'hindu', 'buddha', 'konghucu'];

    /** Status siswa dalam keluarga. */
    public const FAMILY_STATUSES = ['kandung', 'angkat', 'tiri', 'wali'];

    /** Aturan validasi bersama untuk field kependudukan & keluarga. */
    public const IDENTITY_RULES = [
        'birth_place' => ['nullable', 'string', 'max:100'],
        'religion' => ['nullable', 'in:islam,kristen,katolik,hindu,buddha,konghucu'],
        'family_status' => ['nullable', 'in:kandung,angkat,tiri,wali'],
        'nik' => ['nullable', 'string', 'max:20'],
        'father_phone' => ['nullable', 'string', 'regex:/^[0-9+\-\s()]{6,20}$/'],
        'mother_phone' => ['nullable', 'string', 'regex:/^[0-9+\-\s()]{6,20}$/'],
        'social_media' => ['nullable', 'array'],
        'social_media.*' => ['nullable', 'string', 'max:100'],

        // Identitas peserta didik pada lembar sekolah.
        'nisn' => ['nullable', 'string', 'max:20'],
        'birth_order' => ['nullable', 'integer', 'between:1,20'],
        'previous_school' => ['nullable', 'string', 'max:150'],
        'admission_class' => ['nullable', 'string', 'max:50'],
        'admission_date' => ['nullable', 'date'],
        'father_name' => ['nullable', 'string', 'max:120'],
        'mother_name' => ['nullable', 'string', 'max:120'],
        'parent_address' => ['nullable', 'string', 'max:500'],
        'father_occupation' => ['nullable', 'string', 'max:100'],
        'mother_occupation' => ['nullable', 'string', 'max:100'],
        'guardian_name' => ['nullable', 'string', 'max:120'],
        'guardian_phone' => ['nullable', 'string', 'regex:/^[0-9+\-\s()]{6,20}$/'],
        'guardian_address' => ['nullable', 'string', 'max:500'],
        'guardian_occupation' => ['nullable', 'string', 'max:100'],
    ];

    protected $fillable = [
        'user_id',
        'birth_date',
        'birth_place',
        'religion',
        'family_status',
        'nisn',
        'birth_order',
        'previous_school',
        'admission_class',
        'admission_date',
        'gender',
        'address',
        'phone',
        'nik',
        'father_phone',
        'mother_phone',
        'father_name',
        'mother_name',
        'parent_address',
        'father_occupation',
        'mother_occupation',
        'guardian_name',
        'guardian_phone',
        'guardian_address',
        'guardian_occupation',
        'social_media',
        'height_cm',
        'weight_kg',
        'blood_type',
        'medical_history',
        'health_notes',
        'psychological_summary',
        'character_summary',
        'strengths',
        'weaknesses',
        'extra_fields',
        'completeness_percent',
        'published_at',
        'version',
    ];

    protected function casts(): array
    {
        return [
            'birth_date' => 'date',
            'admission_date' => 'date',
            'birth_order' => 'integer',
            'published_at' => 'datetime',
            'nik' => 'encrypted',
            'social_media' => 'array',
            'medical_history' => 'encrypted',
            'health_notes' => 'encrypted',
            'psychological_summary' => 'encrypted',
            'character_summary' => 'encrypted',
            'strengths' => 'encrypted',
            'weaknesses' => 'encrypted',
            'extra_fields' => 'encrypted:array',
            'completeness_percent' => 'integer',
            'version' => 'integer',
        ];
    }

    /**
     * Merapikan NISN/NIK, nomor telepon keluarga, dan akun media sosial sebelum disimpan.
     * Media sosial dikirim sebagai satu objek; key yang tidak dikenal dibuang.
     */
    public static function normalizeIdentity(array $data): array
    {
        if (array_key_exists('nik', $data)) {
            $digits = preg_replace('/\D+/', '', (string) $data['nik']);

            if ($digits === '') {
                $data['nik'] = null;
            } elseif (strlen($digits) !== 16) {
                throw ValidationException::withMessages(['nik' => 'NIK harus terdiri dari 16 digit angka.']);
            } else {
                $data['nik'] = $digits;
            }
        }

        foreach (['nisn'] as $key) {
            if (array_key_exists($key, $data)) {
                $data[$key] = filled($data[$key]) ? preg_replace('/\D+/', '', (string) $data[$key]) : null;
            }
        }

        foreach (['father_phone', 'mother_phone', 'guardian_phone'] as $key) {
            if (array_key_exists($key, $data)) {
                $data[$key] = filled($data[$key]) ? trim((string) $data[$key]) : null;
            }
        }

        if (array_key_exists('social_media', $data)) {
            $clean = [];

            foreach (self::SOCIAL_PLATFORMS as $platform) {
                $value = ltrim(trim((string) ($data['social_media'][$platform] ?? '')), '@');

                if ($value !== '') {
                    $clean[$platform] = mb_substr($value, 0, 100);
                }
            }

            $data['social_media'] = $clean;
        }

        return $data;
    }

    public function completeness(): int
    {
        $fields = [
            'birth_date', 'gender', 'address', 'phone', 'height_cm', 'weight_kg',
            'blood_type', 'medical_history', 'health_notes',
            'psychological_summary', 'character_summary', 'strengths', 'weaknesses',
        ];

        $filled = collect($fields)->filter(fn ($field) => ! blank($this->{$field}))->count();

        return (int) round($filled / count($fields) * 100);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
