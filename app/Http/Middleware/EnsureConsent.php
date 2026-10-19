<?php

namespace App\Http\Middleware;

use App\Services\SettingsService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureConsent
{
    public function handle(Request $request, Closure $next, string $feature = 'journaling'): Response
    {
        $user = $request->user();
        $settings = app(SettingsService::class);

        if ($user && $user->isStudent() && ! $user->hasConsent()) {
            return $request->expectsJson()
                ? response()->json([
                    'success' => false,
                    'error' => 'CONSENT_REQUIRED',
                    'message' => 'Setujui pemrosesan data terlebih dahulu untuk membuka fitur ini.',
                ], 403)
                : redirect()->route('onboarding.consent');
        }

        $flag = match ($feature) {
            'portfolio' => 'feature.portfolio',
            'reflection' => 'feature.reflection',
            default => 'feature.journaling',
        };

        if (! $settings->get($flag, true)) {
            return $request->expectsJson()
                ? response()->json(['success' => false, 'error' => 'FEATURE_DISABLED', 'message' => 'Fitur sedang dinonaktifkan.'], 403)
                : abort(403);
        }

        return $next($request);
    }
}
