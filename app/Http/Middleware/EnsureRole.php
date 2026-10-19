<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user) {
            return $request->expectsJson()
                ? response()->json(['success' => false, 'error' => 'UNAUTHENTICATED', 'message' => 'Silakan masuk terlebih dahulu.'], 401)
                : redirect()->route('login');
        }

        if ($user->status !== 'active') {
            auth()->logout();

            return $request->expectsJson()
                ? response()->json(['success' => false, 'error' => 'ACCOUNT_INACTIVE', 'message' => 'Akun tidak aktif. Hubungi Guru BK atau admin sekolah.'], 403)
                : redirect()->route('login')->with('error', 'Akun tidak aktif.');
        }

        if ($roles !== [] && ! in_array($user->role, $roles, true)) {
            return $request->expectsJson()
                ? response()->json(['success' => false, 'error' => 'FORBIDDEN', 'message' => 'Anda tidak memiliki akses ke sumber daya ini.'], 403)
                : abort(403);
        }

        return $next($request);
    }
}
