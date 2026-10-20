<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Akun baru dibuat dengan kata sandi awal yang sama dengan NIS/NIP, sehingga
 * pengguna wajib menggantinya sebelum bisa memakai aplikasi.
 */
class EnsurePasswordChanged
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->must_change_password) {
            return $request->expectsJson()
                ? response()->json([
                    'success' => false,
                    'error' => 'PASSWORD_CHANGE_REQUIRED',
                    'message' => 'Ganti kata sandi awal Anda terlebih dahulu.',
                ], 403)
                : redirect()->route('password.change');
        }

        return $next($request);
    }
}
