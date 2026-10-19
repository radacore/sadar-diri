<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: DejaVu Sans, sans-serif; color: #1e293b; font-size: 12px; }
        h1 { font-size: 20px; margin: 0 0 4px; }
        .muted { color: #475569; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th { text-align: left; font-size: 10px; text-transform: uppercase; color: #475569; border-bottom: 1px solid #e2e8f0; padding: 8px; }
        td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
        td.num { text-align: right; font-weight: bold; }
    </style>
</head>
<body>
    <h1>Laporan Kelas {{ $report['class']['name'] }}</h1>
    <p class="muted">Periode {{ $report['period']['from'] }} – {{ $report['period']['to'] }}</p>
    <p class="muted">Dicetak {{ now()->translatedFormat('d F Y H:i') }}</p>

    <table>
        <thead><tr><th>Metrik</th><th>Nilai</th></tr></thead>
        <tbody>
            <tr><td>Siswa aktif</td><td class="num">{{ $report['activity']['active_students'] }}</td></tr>
            <tr><td>Siswa belum aktif</td><td class="num">{{ $report['activity']['inactive_students'] }}</td></tr>
            <tr><td>Hari mood positif</td><td class="num">{{ $report['mood']['positive_days'] }}</td></tr>
            <tr><td>Hari mood negatif</td><td class="num">{{ $report['mood']['negative_days'] }}</td></tr>
            <tr><td>Refleksi terkirim</td><td class="num">{{ $report['reflections_submitted'] }}</td></tr>
            <tr><td>Prestasi terverifikasi</td><td class="num">{{ $report['achievements_verified'] }}</td></tr>
            <tr><td>Alert total</td><td class="num">{{ $report['alerts']['total'] }}</td></tr>
            <tr><td>Alert selesai</td><td class="num">{{ $report['alerts']['resolved'] }}</td></tr>
            <tr><td>Alert terbuka</td><td class="num">{{ $report['alerts']['open'] }}</td></tr>
            <tr><td>Rata-rata respons alert (jam)</td><td class="num">{{ $report['follow_ups']['average_response_hours'] ?? '—' }}</td></tr>
        </tbody>
    </table>

    <p class="muted" style="margin-top: 24px; font-size: 10px;">
        Laporan ini hanya memuat data agregat. Tidak memuat isi jurnal, curhat, atau catatan konseling.
    </p>
</body>
</html>
