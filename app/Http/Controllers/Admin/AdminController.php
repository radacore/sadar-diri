<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\SchoolClass;
use App\Services\AuditLogger;
use App\Services\ReportService;
use App\Services\SettingsService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AdminController extends Controller
{
    public function __construct(
        private readonly SettingsService $settings,
        private readonly ReportService $reports,
        private readonly AuditLogger $audit,
    ) {}

    public function dashboard()
    {
        return response()->json([
            'success' => true,
            'data' => $this->reports->dashboardCounters(),
        ]);
    }

    public function aggregate(Request $request)
    {
        $data = $request->validate([
            'class_id' => ['nullable', 'exists:classes,id'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->reports->aggregate($data),
        ]);
    }

    public function exportAggregate(Request $request)
    {
        $data = $request->validate([
            'class_id' => ['nullable', 'exists:classes,id'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $report = $this->reports->aggregate($data);
        $this->audit->record('report.exported', 'reports', null, null, null, ['type' => 'aggregate']);

        return new StreamedResponse(function () use ($report) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Kelas', 'Jumlah Siswa', 'Siswa Aktif', 'Mood Positif %', 'Mood Negatif %', 'Profil %', 'Mood %', 'Refleksi %', 'Alert Terbuka']);

            foreach ($report['groups'] as $group) {
                fputcsv($handle, [
                    $group['class_name'],
                    $group['students_count'],
                    $group['active_students'],
                    $group['mood_distribution']['positive'],
                    $group['mood_distribution']['negative'],
                    $group['feature_completion']['profile'],
                    $group['feature_completion']['mood'],
                    $group['feature_completion']['reflection'],
                    $group['alerts_open'],
                ]);
            }

            fclose($handle);
        }, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="laporan-agregat.csv"',
        ]);
    }

    public function settings()
    {
        return response()->json([
            'success' => true,
            'data' => [
                'school' => $this->settings->group('school'),
                'notification' => $this->settings->group('notification'),
                'privacy' => $this->settings->group('privacy'),
                'feature' => $this->settings->group('feature'),
            ],
        ]);
    }

    public function updateSettings(Request $request)
    {
        $data = $request->validate([
            'whatsapp_number' => ['nullable', 'string', 'regex:/^[0-9]{8,15}$/'],
            'reminder_hour' => ['nullable', 'integer', 'between:6,21'],
            'digest_hour' => ['nullable', 'integer', 'between:5,10'],
            'retention_years_after_graduation' => ['nullable', 'integer', 'between:1,10'],
            'consent_version' => ['nullable', 'string', 'max:20'],
            'feature' => ['nullable', 'array'],
            'school' => ['nullable', 'array'],
        ]);

        $values = [];

        if (isset($data['whatsapp_number'])) {
            $values['school.whatsapp_number'] = $data['whatsapp_number'];
        }
        if (isset($data['reminder_hour'])) {
            $values['notification.reminder_hour'] = $data['reminder_hour'];
        }
        if (isset($data['digest_hour'])) {
            $values['notification.digest_hour'] = $data['digest_hour'];
        }
        if (isset($data['retention_years_after_graduation'])) {
            $values['privacy.retention_years_after_graduation'] = $data['retention_years_after_graduation'];
        }
        if (isset($data['consent_version'])) {
            $values['privacy.consent_version'] = $data['consent_version'];
        }
        foreach ($data['feature'] ?? [] as $key => $value) {
            $values['feature.'.$key] = (bool) $value;
        }
        foreach ($data['school'] ?? [] as $key => $value) {
            $values['school.'.$key] = $value;
        }

        $updated = $this->settings->updateMany($values, $request->user());
        $this->audit->record('settings.updated', 'settings', null, null, null, ['keys' => $updated]);

        return response()->json(['success' => true, 'data' => ['updated_keys' => $updated]]);
    }

    public function auditLogs(Request $request)
    {
        $query = AuditLog::query()->with(['actor', 'subject']);

        if ($request->filled('action')) {
            $query->where('action', $request->query('action'));
        }
        if ($request->filled('entity_type')) {
            $query->where('entity_type', $request->query('entity_type'));
        }
        if ($request->filled('actor_id')) {
            $query->where('actor_id', $request->integer('actor_id'));
        }
        if ($request->filled('subject_user_id')) {
            $query->where('subject_user_id', $request->integer('subject_user_id'));
        }
        if ($request->filled('from')) {
            $query->where('created_at', '>=', Carbon::parse($request->query('from'))->startOfDay());
        }
        if ($request->filled('to')) {
            $query->where('created_at', '<=', Carbon::parse($request->query('to'))->endOfDay());
        }

        $logs = $query->orderByDesc('id')->cursorPaginate(50);

        return response()->json([
            'success' => true,
            'data' => collect($logs->items())->map(fn (AuditLog $log) => [
                'id' => $log->id,
                'actor' => $log->actor ? ['id' => $log->actor->id, 'name' => $log->actor->name, 'role' => $log->actor->role] : null,
                'action' => $log->action,
                'entity_type' => $log->entity_type,
                'entity_id' => $log->entity_id,
                'subject_user' => $log->subject ? ['id' => $log->subject->id, 'name' => $log->subject->name] : null,
                'reason' => $log->reason,
                'ip_address' => $log->ip_address,
                'created_at' => $log->created_at?->toIso8601String(),
            ]),
            'meta' => ['next_cursor' => $logs->nextCursor()?->encode(), 'per_page' => 50],
        ]);
    }

    public function classes()
    {
        return response()->json([
            'success' => true,
            'data' => SchoolClass::query()->where('is_active', true)->orderBy('name')->get(['id', 'name']),
        ]);
    }
}
