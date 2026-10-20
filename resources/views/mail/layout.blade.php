<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $subject ?? 'SADAR DIRI' }}</title>
</head>
<body style="margin:0;padding:0;background:#eceff4;font-family:Inter,Helvetica,Arial,sans-serif;color:#1e293b;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eceff4;padding:28px 16px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 12px 32px -18px rgba(15,23,42,0.35);">
                    <tr>
                        <td style="background:#374987;padding:22px 28px;">
                            <p style="margin:0;font-size:17px;font-weight:800;color:#ffffff;letter-spacing:-0.01em;">SADAR DIRI</p>
                            <p style="margin:4px 0 0;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#c7d2fe;">Sistem Informasi dan Portofolio Diri</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:28px;">
                            @yield('content')
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 28px 26px;">
                            <p style="margin:0 0 6px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;font-weight:700;line-height:1.6;color:#475569;">
                                Jangan balas email ini.
                            </p>
                            <p style="margin:0;font-size:11px;line-height:1.6;color:#64748b;">
                                Email ini dikirim otomatis oleh SADAR DIRI dan hanya digunakan untuk kode verifikasi serta tautan reset kata sandi. Pesan yang dikirim ke alamat ini tidak akan dibaca. Jangan bagikan tautan atau kode di dalamnya kepada siapa pun, termasuk yang mengaku pihak sekolah.
                            </p>
                        </td>
                    </tr>
                </table>
                <p style="margin:16px 0 0;font-size:10.5px;color:#94a3b8;">{{ config('app.name') }}</p>
            </td>
        </tr>
    </table>
</body>
</html>
