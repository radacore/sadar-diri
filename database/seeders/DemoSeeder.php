<?php

namespace Database\Seeders;

use App\Models\AcademicYear;
use App\Models\ClassStudent;
use App\Models\CounselorClass;
use App\Models\SchoolClass;
use App\Models\User;
use App\Models\StudentProfile;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DemoSeeder extends Seeder
{
    public function run(): void
    {
        $year = AcademicYear::firstOrCreate(
            ['name' => '2026/2027'],
            ['starts_on' => '2026-07-01', 'ends_on' => '2027-06-30', 'is_active' => true],
        );

        $classes = [];

        foreach (['X IPA 1', 'X IPA 2', 'X IPS 1'] as $index => $name) {
            $classes[$name] = SchoolClass::firstOrCreate(
                ['academic_year_id' => $year->id, 'name' => $name],
                [
                    'level' => explode(' ', $name)[0],
                    'homeroom_teacher_name' => ['Dewi Sartika', 'Budi Santoso', 'Siti Aminah'][$index],
                    'is_active' => true,
                ],
            );
        }

        $rina = User::firstOrCreate(
            ['identity_number' => '198501012010'],
            [
                'name' => 'Rina Wati',
                'email' => 'rina@sadar-diri.test',
                'password' => Hash::make('Password123'),
                'role' => 'counselor',
                'status' => 'active',
                'must_change_password' => false,
                'email_verified_at' => now(),
                'last_login_at' => now()->subHours(3),
                'last_activity_at' => now()->subHours(3),
            ],
        );

        $hendra = User::firstOrCreate(
            ['identity_number' => '198702022011'],
            [
                'name' => 'Hendra Saputra',
                'email' => 'hendra@sadar-diri.test',
                'password' => Hash::make('Password123'),
                'role' => 'counselor',
                'status' => 'active',
                'must_change_password' => false,
                'email_verified_at' => now(),
                'last_login_at' => now()->subDay(),
                'last_activity_at' => now()->subDay(),
            ],
        );

        // Satu angkatan, tiga kelas paralel: kedua Guru BK mendampingi seluruh kelas.
        // Pola ini mengikuti sekolah dengan banyak kelas per angkatan dan satu tim BK.
        foreach ($classes as $class) {
            foreach ([$rina, $hendra] as $counselor) {
                CounselorClass::firstOrCreate([
                    'counselor_id' => $counselor->id,
                    'class_id' => $class->id,
                ], ['assigned_at' => now()]);
            }
        }

        // Bersihkan penugasan demo lama di luar ketiga kelas di atas agar data uji tidak tumpang tindih.
        CounselorClass::query()
            ->whereIn('counselor_id', [$rina->id, $hendra->id])
            ->whereNotIn('class_id', collect($classes)->pluck('id')->all())
            ->delete();

        $names = [
            'Ayu Lestari', 'Bima Pratama', 'Citra Dewi', 'Dimas Anggara', 'Eka Putri',
            'Fajar Nugroho', 'Gita Permata', 'Hana Safitri', 'Indra Kusuma', 'Jihan Aulia',
            'Krisna Bayu', 'Laras Ayu', 'Muhammad Rizky', 'Nadia Salsabila', 'Oscar Pratama',
            'Putri Maharani', 'Qori Amalia', 'Rafi Ardiansyah', 'Sari Wulandari', 'Taufik Hidayat',
            'Umi Kalsum', 'Vino Bastian', 'Wulan Sari', 'Xavier Tanaya', 'Yusuf Maulana',
            'Zahra Nabila', 'Adi Nugraha', 'Bella Safira', 'Candra Wijaya', 'Dinda Ayu',
            'Erlangga Putra', 'Farah Nisa', 'Galih Pratama', 'Hesti Purwanti', 'Ilham Ramadhan',
            'Joko Susilo',
        ];

        foreach ($names as $index => $name) {
            $class = $classes[array_keys($classes)[$index % 3]];

            $student = User::firstOrCreate(
                ['identity_number' => '2024'.str_pad((string) ($index + 1), 3, '0', STR_PAD_LEFT)],
                [
                    'name' => $name,
                    'email' => Str::slug($name, '.').'@siswa.sadar-diri.test',
                    'password' => Hash::make('Password123'),
                    'role' => 'student',
                    'status' => 'active',
                    'must_change_password' => false,
                    'email_verified_at' => now(),
                    'consent_version' => '2026-08-01',
                    'consented_at' => now()->subWeeks(6),
                    'last_login_at' => now()->subDays($index % 5),
                    'last_activity_at' => now()->subDays($index % 5),
                ],
            );

            ClassStudent::firstOrCreate(
                ['class_id' => $class->id, 'student_id' => $student->id, 'academic_year_id' => $year->id],
                ['joined_at' => now()->subMonths(3)->toDateString(), 'status' => 'active'],
            );

            StudentProfile::firstOrCreate(
                ['user_id' => $student->id],
                [
                    'birth_date' => now()->subYears(16)->subDays($index * 20)->toDateString(),
                    'gender' => $index % 2 === 0 ? 'female' : 'male',
                    'address' => 'Jl. Melati No. '.($index + 1),
                    'phone' => '08123456'.str_pad((string) $index, 4, '0', STR_PAD_LEFT),
                    'height_cm' => 155 + ($index % 20),
                    'weight_kg' => 45 + ($index % 15),
                    'blood_type' => ['A', 'B', 'O', 'AB'][$index % 4],
                    'medical_history' => $index % 5 === 0 ? 'Asma ringan' : null,
                    'health_notes' => $index % 5 === 0 ? 'Membawa inhaler' : null,
                    'psychological_summary' => 'Cenderung tenang, butuh waktu untuk terbuka pada orang baru.',
                    'character_summary' => 'Disiplin, teliti, dan senang membantu teman.',
                    'strengths' => 'Mudah bergaul dan tekun',
                    'weaknesses' => 'Sulit menolak permintaan orang lain',
                    'completeness_percent' => 70 + ($index % 30),
                    'published_at' => now()->subWeeks(4),
                    'version' => 2,
                ],
            );
        }

        $this->call([
            ActivitySeeder::class,
        ]);
    }
}
