<?php

namespace App\Providers;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Tanpa API key, Resend akan melempar error pada setiap email.
        // Saat pengembangan, email ditulis ke log agar alur tetap bisa diuji.
        if (config('mail.default') === 'resend' && blank(config('services.resend.key'))) {
            config(['mail.default' => 'log']);

            if ($this->app->environment('local')) {
                Log::warning('RESEND_API_KEY belum diisi. Email dialihkan ke driver log.');
            }
        }
    }
}
