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
        // Build-time (composer dump-autoload / package:discover tanpa .env):
        // lewati guard agar image bisa dibangun; guard tetap berlaku saat runtime.
        if ($this->app->runningInConsole() && ! file_exists($this->app->environmentFilePath())) {
            return;
        }

        // Produksi wajib memakai Resend dengan API key terisi; gagal cepat
        // saat boot agar tidak ada email yang terkirim diam-diam via mailer lain.
        if ($this->app->environment('production')) {
            if (config('mail.default') !== 'resend' || blank(config('services.resend.key'))) {
                Log::warning('Konfigurasi email produksi belum lengkap.');

                throw new \RuntimeException('Konfigurasi email produksi belum lengkap.');
            }

            return;
        }

        // Lokal: tanpa API key, Resend akan melempar error pada setiap email.
        // Alihkan ke log agar alur tetap bisa diuji tanpa Mailpit.
        if (config('mail.default') === 'resend' && blank(config('services.resend.key'))) {
            config(['mail.default' => 'log']);
            Log::warning('RESEND_API_KEY belum diisi. Email dialihkan ke driver log.');
        }
    }
}
