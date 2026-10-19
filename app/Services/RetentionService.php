<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;

class RetentionService
{
    public function __construct(
        private readonly SettingsService $settings,
        private readonly AuditLogger $audit,
    ) {}

    public function preview(): array
    {
        $years = (int) $this->settings->get('privacy.retention_years_after_graduation', 3);
        $cutoff = now()->subYears($years);

        $students = User::query()
            ->where('role', 'student')
            ->where('status', 'alumni')
            ->where('anonymized_at', null)
            ->where('updated_at', '<=', $cutoff)
            ->get();

        return [
            'students_to_anonymize' => $students->count(),
            'journals_to_purge' => DB::table('journal_entries')->whereIn('student_id', $students->pluck('id'))->count()
                + DB::table('reflections')->whereIn('student_id', $students->pluck('id'))->count(),
            'cutoff_date' => $cutoff->toDateString(),
            'policy_years_after_graduation' => $years,
        ];
    }

    public function run(User $actor, string $reason): array
    {
        $years = (int) $this->settings->get('privacy.retention_years_after_graduation', 3);
        $cutoff = now()->subYears($years);

        $students = User::query()
            ->where('role', 'student')
            ->where('status', 'alumni')
            ->where('anonymized_at', null)
            ->where('updated_at', '<=', $cutoff)
            ->get();

        $processed = 0;

        foreach ($students as $student) {
            DB::transaction(function () use ($student) {
                $student->update([
                    'name' => 'Alumni Anonim #'.$student->id,
                    'email' => null,
                    'identity_number' => 'ANON-'.$student->id,
                    'anonymized_at' => now(),
                ]);

                DB::table('journal_entries')->where('student_id', $student->id)->delete();
                DB::table('reflections')->where('student_id', $student->id)->delete();
                DB::table('counseling_notes')->where('student_id', $student->id)->update([
                    'summary' => null,
                    'content' => encrypt('Data dianonimkan sesuai kebijakan retensi.'),
                ]);
            });

            $processed++;
        }

        $this->audit->record('retention.run', 'users', null, null, $reason, [
            'students_anonymized' => $processed,
            'cutoff_date' => $cutoff->toDateString(),
        ], $actor);

        return [
            'job_id' => 'ret_'.now()->format('YmdHis'),
            'status' => 'completed',
            'students_anonymized' => $processed,
        ];
    }
}
