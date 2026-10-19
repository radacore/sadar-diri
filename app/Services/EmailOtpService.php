<?php

namespace App\Services;

use App\Mail\LoginOtpMail;
use App\Models\LoginOtpCode;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;

class EmailOtpService
{
    public const TTL_MINUTES = 10;
    public const RESEND_SECONDS = 60;

    public function issue(User $user, ?string $ip = null): string
    {
        $code = (string) random_int(100000, 999999);

        LoginOtpCode::query()
            ->where('user_id', $user->id)
            ->whereNull('consumed_at')
            ->update(['consumed_at' => now()]);

        LoginOtpCode::create([
            'user_id' => $user->id,
            'code_hash' => Hash::make($code),
            'ip_address' => $ip,
            'expires_at' => now()->addMinutes(self::TTL_MINUTES),
        ]);

        Mail::to($user->email)->send(new LoginOtpMail($user, $code, self::TTL_MINUTES));

        return $code;
    }

    public function verify(User $user, string $code): bool
    {
        $record = LoginOtpCode::query()
            ->where('user_id', $user->id)
            ->whereNull('consumed_at')
            ->latest('id')
            ->first();

        if (! $record || $record->isExpired() || ! Hash::check($code, $record->code_hash)) {
            return false;
        }

        $record->update(['consumed_at' => now()]);

        return true;
    }

    public function secondsUntilResend(User $user): int
    {
        $last = LoginOtpCode::query()
            ->where('user_id', $user->id)
            ->latest('id')
            ->first()?->created_at;

        if (! $last) {
            return 0;
        }

        return max(0, self::RESEND_SECONDS - (time() - $last->getTimestamp()));
    }
}
