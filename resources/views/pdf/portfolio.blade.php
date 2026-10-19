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
        td { padding: 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
        .badge { font-size: 9px; padding: 2px 6px; border-radius: 8px; background: #f1f5f9; }
    </style>
</head>
<body>
    <h1>Portofolio Prestasi</h1>
    <p class="muted">
        {{ $student->name }} · NIS {{ $student->identity_number }}
        @if ($class) · {{ $class->name }} @endif
    </p>
    <p class="muted">Dicetak {{ now()->translatedFormat('d F Y H:i') }}</p>

    <table>
        <thead>
            <tr><th>Tanggal</th><th>Prestasi</th><th>Tingkat</th><th>Penyelenggara</th><th>Status</th></tr>
        </thead>
        <tbody>
            @forelse ($items as $item)
                <tr>
                    <td>{{ $item->achieved_at->format('d/m/Y') }}</td>
                    <td>
                        <strong>{{ $item->title }}</strong>
                        @if ($item->description)<br><span class="muted">{{ $item->description }}</span>@endif
                    </td>
                    <td>{{ $item->level ?? '—' }}</td>
                    <td>{{ $item->organizer ?? '—' }}</td>
                    <td><span class="badge">{{ $item->verification_status }}</span></td>
                </tr>
            @empty
                <tr><td colspan="5" class="muted">Belum ada prestasi terverifikasi.</td></tr>
            @endforelse
        </tbody>
    </table>

    <p class="muted" style="margin-top: 24px; font-size: 10px;">
        Dokumen ini dihasilkan SADAR DIRI. Prestasi berstatus pending belum diverifikasi Guru BK.
    </p>
</body>
</html>
