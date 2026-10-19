@extends('mail.layout')

@section('content')
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;letter-spacing:-0.01em;">Aktifkan akun Anda</h1>
    <p style="margin:0 0 20px;font-size:13px;line-height:1.6;color:#475569;">
        Halo {{ $user->name }}, akun SADAR DIRI Anda sudah dibuat. Buat kata sandi pertama melalui tombol berikut.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
        <tr>
            <td style="border-radius:999px;background:#3f51b5;">
                <a href="{{ $url }}" style="display:inline-block;padding:13px 26px;font-size:13px;font-weight:700;color:#ffffff;text-decoration:none;">Aktifkan akun</a>
            </td>
        </tr>
    </table>

    <p style="margin:0;padding:12px 14px;background:#f1f5f9;border-radius:12px;font-size:11px;line-height:1.6;color:#334155;word-break:break-all;">{{ $url }}</p>

    <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#475569;">
        Tautan berlaku <strong>{{ $ttlHours }} jam</strong>. Setelah aktivasi, Anda dapat masuk dengan email atau NIS/NIP.
    </p>
@endsection
