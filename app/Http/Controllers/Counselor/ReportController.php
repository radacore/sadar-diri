<?php

namespace App\Http\Controllers\Counselor;

use App\Http\Controllers\Controller;
use App\Models\ClassStudent;
use App\Models\SchoolClass;
use App\Services\AccessScope;
use App\Services\AuditLogger;
use App\Services\ReportService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    public function __construct(
        private readonly ReportService $reports,
        private readonly AccessScope $access,
        private readonly AuditLogger $audit,
    ) {}

    public function classReport(Request $request)
    {
        $data = $request->validate([
            'class_id' => ['required', 'exists:classes,id'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $this->ensureClassAccess($request, (int) $data['class_id']);

        $report = $this->reports->classReport(
            (int) $data['class_id'],
            Carbon::parse($data['from'] ?? now()->subDays(30)->toDateString())->startOfDay(),
            Carbon::parse($data['to'] ?? now()->toDateString())->endOfDay(),
        );

        return response()->json(['success' => true, 'data' => $report]);
    }

    public function export(Request $request)
    {
        $data = $request->validate([
            'class_id' => ['required', 'exists:classes,id'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'format' => ['required', 'in:pdf,csv'],
        ]);

        $classId = (int) $data['class_id'];
        $this->ensureClassAccess($request, $classId);

        $from = Carbon::parse($data['from'] ?? now()->subDays(30)->toDateString())->startOfDay();
        $to = Carbon::parse($data['to'] ?? now()->toDateString())->endOfDay();
        $report = $this->reports->classReport($classId, $from, $to);

        $this->audit->record('report.exported', 'classes', $classId, null, null, ['format' => $data['format']]);

        if ($data['format'] === 'pdf') {
            $html = view('pdf.class-report', ['report' => $report])->render();

            return \Barryvdh\DomPDF\Facade\Pdf::loadHTML($html)->setPaper('a4')->download(
                'laporan-kelas-'.$report['class']['name'].'.pdf',
            );
        }

        $filename = 'laporan-kelas-'.str($report['class']['name'])->slug().'.csv';

        return new StreamedResponse(function () use ($report) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Metrik', 'Nilai']);
            fputcsv($handle, ['Kelas', $report['class']['name']]);
            fputcsv($handle, ['Periode', $report['period']['from'].' s/d '.$report['period']['to']]);
            fputcsv($handle, ['Siswa aktif', $report['activity']['active_students']]);
            fputcsv($handle, ['Siswa tidak aktif', $report['activity']['inactive_students']]);
            fputcsv($handle, ['Hari mood positif', $report['mood']['positive_days']]);
            fputcsv($handle, ['Hari mood negatif', $report['mood']['negative_days']]);
            fputcsv($handle, ['Refleksi terkirim', $report['reflections_submitted']]);
            fputcsv($handle, ['Prestasi terverifikasi', $report['achievements_verified']]);
            fputcsv($handle, ['Alert total', $report['alerts']['total']]);
            fputcsv($handle, ['Alert selesai', $report['alerts']['resolved']]);
            fputcsv($handle, ['Alert terbuka', $report['alerts']['open']]);
            fclose($handle);
        }, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    }

    private function ensureClassAccess(Request $request, int $classId): void
    {
        if (! in_array($classId, $this->access->counselorClassIds($request->user()), true)) {
            $this->audit->record('access.denied', 'classes', $classId, null);
            abort(response()->json(['success' => false, 'error' => 'FORBIDDEN', 'message' => 'Kelas bukan binaan Anda.'], 403));
        }
    }
}
