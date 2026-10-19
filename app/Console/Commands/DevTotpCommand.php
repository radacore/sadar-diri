<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\TotpService;
use Illuminate\Console\Command;

class DevTotpCommand extends Command
{
    protected $signature = 'sadar:totp {identity? : Email atau NIS/NIP pengguna}';

    protected $description = 'Tampilkan kode TOTP aktif untuk pengujian 2FA di lingkungan lokal';

    public function handle(TotpService $totp): int
    {
        if (! app()->environment('local', 'testing')) {
            $this->error('Perintah ini hanya tersedia di lingkungan local.');

            return self::FAILURE;
        }

        $identity = $this->argument('identity') ?? 'admin@sadar-diri.test';

        $user = User::query()
            ->where('email', $identity)
            ->orWhere('identity_number', $identity)
            ->first();

        if (! $user || ! $user->two_factor_secret) {
            $this->error('Pengguna tidak ditemukan atau belum memulai pendaftaran 2FA.');

            return self::FAILURE;
        }

        $remaining = TotpService::PERIOD - (time() % TotpService::PERIOD);

        $this->line('Pengguna : '.$user->name.' ('.$user->email.')');
        $this->line('Secret   : '.$user->two_factor_secret);
        $this->line('Kode     : <options=bold>'.$totp->code($user->two_factor_secret).'</>');
        $this->line('Berlaku  : '.$remaining.' detik lagi');

        return self::SUCCESS;
    }
}
