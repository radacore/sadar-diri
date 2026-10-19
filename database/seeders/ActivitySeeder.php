<?php

namespace Database\Seeders;

use App\Models\AcademicYear;
use App\Models\Achievement;
use App\Models\ActionPlan;
use App\Models\ClassStudent;
use App\Models\ContentItem;
use App\Models\JournalEntry;
use App\Models\MoodEntry;
use App\Models\Reflection;
use App\Models\ReflectionSession;
use App\Models\User;
use App\Services\AlertEngine;
use Illuminate\Database\Seeder;

class ActivitySeeder extends Seeder
{
    public function run(): void
    {
        $students = User::query()->where('role', 'student')->orderBy('id')->get();
        $counselor = User::query()->where('role', 'counselor')->first();
        $abcPrompt = ContentItem::query()->where('type', 'abc_prompt')->first();

        if ($students->isEmpty() || ! $counselor) {
            return;
        }

        foreach ($students as $index => $student) {
            foreach (range(0, 9) as $daysAgo) {
                $date = now()->subDays($daysAgo);
                $negative = ($index + $daysAgo) % 5 === 0;
                $highRisk = $index < 3 && $daysAgo < 3;

                MoodEntry::firstOrCreate(
                    ['student_id' => $student->id, 'entry_date' => $date->toDateString()],
                    [
                        'valence' => ($negative || $highRisk) ? 'negative' : 'positive',
                        'intensity' => $highRisk ? 5 : ($negative ? 4 : 4),
                        'emotion_tags' => ($negative || $highRisk) ? ['cemas', 'lelah'] : ['tenang', 'bersemangat'],
                        'note' => ($negative || $highRisk) ? 'Tugas menumpuk dan sulit fokus.' : 'Hari berjalan lancar.',
                    ],
                );
            }

            JournalEntry::firstOrCreate(
                ['student_id' => $student->id, 'type' => 'abc', 'entry_date' => now()->toDateString()],
                [
                    'prompt_content_id' => $abcPrompt?->id,
                    'activating_event' => 'Presentasi kelompok di depan kelas.',
                    'belief' => 'Saya takut dinilai buruk oleh teman.',
                    'consequence' => 'Tangan gemetar, tetapi tetap maju sampai selesai.',
                    'status' => 'published',
                ],
            );

            JournalEntry::firstOrCreate(
                ['student_id' => $student->id, 'type' => 'grateful', 'entry_date' => now()->subDay()->toDateString()],
                [
                    'gratitude_text' => 'Keluarga yang selalu mendukung.',
                    'happiness_text' => 'Makan siang bersama teman sekelas.',
                    'status' => 'published',
                ],
            );

            Achievement::firstOrCreate(
                ['student_id' => $student->id, 'title' => 'Juara '.($index % 3 + 1).' Lomba Karya Ilmiah'],
                [
                    'category' => 'competition',
                    'organizer' => 'Dinas Pendidikan Kota',
                    'level' => 'city',
                    'achieved_at' => now()->subMonths(2)->toDateString(),
                    'rank' => 'Juara '.($index % 3 + 1),
                    'description' => 'Karya tentang pengelolaan sampah sekolah.',
                    'verification_status' => $index % 2 === 0 ? 'verified' : 'pending',
                    'verified_by' => $index % 2 === 0 ? $counselor->id : null,
                    'verified_at' => $index % 2 === 0 ? now()->subMonth() : null,
                ],
            );

            Reflection::firstOrCreate(
                ['student_id' => $student->id, 'type' => 'self', 'week_start' => now()->startOfWeek()->toDateString()],
                [
                    'positive_experience' => 'Berhasil menyelesaikan tugas tepat waktu.',
                    'negative_experience' => 'Sempat bertengkar dengan teman sekelas.',
                    'status' => 'submitted',
                    'submitted_at' => now()->subDay(),
                ],
            );

            $plan = ActionPlan::firstOrCreate(
                ['student_id' => $student->id, 'period_start' => now()->startOfMonth()->toDateString()],
                ['period_end' => now()->endOfMonth()->toDateString(), 'status' => 'active'],
            );

            $plan->targets()->firstOrCreate(
                ['title' => 'Belajar matematika 3x seminggu'],
                ['success_indicator' => 'Nilai ulangan minimal 80', 'status' => 'in_progress', 'sort_order' => 1],
            );

            $plan->targets()->firstOrCreate(
                ['title' => 'Tidur sebelum pukul 22.00'],
                ['success_indicator' => 'Lima hari dalam sepekan', 'status' => 'not_started', 'sort_order' => 2],
            );
        }

        $class = \App\Models\SchoolClass::query()->first();

        if ($class) {
            ReflectionSession::firstOrCreate(
                ['counselor_id' => $counselor->id, 'class_id' => $class->id, 'topic' => 'Mengelola kecemasan ujian'],
                [
                    'instructions' => 'Jawab dengan jujur. Tidak ada jawaban yang salah.',
                    'questions' => [
                        'Apa pemicu utama kecemasanmu menjelang ujian?',
                        'Apa yang bisa kamu kendalikan?',
                        'Satu langkah kecil apa yang akan kamu coba pekan ini?',
                    ],
                    'due_at' => now()->addDays(5),
                    'status' => 'ongoing',
                ],
            );
        }

        app(AlertEngine::class)->evaluateAll();
    }
}
