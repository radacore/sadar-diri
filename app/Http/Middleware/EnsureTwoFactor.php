<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureTwoFactor
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->requiresTwoFactor() && ! $request->session()->get('two_factor_passed')) {
            return $request->expectsJson()
                ? response()->json([
                    'success' => false,
                    'error' => 'TWO_FACTOR_REQUIRED',
                    'message' => 'Verifikasi dua faktor diperlukan.',
                ], 403)
                : redirect()->route('2fa.challenge');
        }

        return $next($request);
    }
}
