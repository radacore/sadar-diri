@extends('mail.layout')

@section('content')
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;letter-spacing:-0.01em;">Kode verifikasi</h1>
    <p style="margin:0 0 20px;font-size:13px;line-height:1.6;color:#475569;">
        Halo {{ $user->name }}, gunakan kode berikut untuk menyelesaikan proses masuk ke panel admin.
    </p>

    <div style="background:#f1f5f9;border-radius:18px;padding:22px;text-align:center;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#64748b;">Kode 6 digit</p>
        <p style="margin:0;font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:34px;font-weight:700;letter-spacing:0.32em;color:#3f51b5;">{{ $code }}</p>
    </div>

    <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#475569;">
        Kode berlaku <strong>{{ $ttlMinutes }} menit</strong> dan hanya dapat dipakai sekali.
        Jika Anda tidak mencoba masuk, segera ganti kata sandi akun Anda.
    </p>
@endsection
