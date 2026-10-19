<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class SettingsSeeder extends Seeder
{
    public function run(): void
    {
        $values = [
            ['school.name', 'SMA Negeri 1 Contoh', 'school', 'string'],
            ['school.npsn', '12345678', 'school', 'string'],
            ['school.address', 'Jl. Pendidikan No. 1, Kota Contoh', 'school', 'string'],
            ['school.timezone', 'Asia/Jakarta', 'school', 'string'],
            ['school.whatsapp_number', '6281234567890', 'school', 'string'],
            ['school.service_hours', 'Senin–Jumat 08.00–15.00', 'school', 'string'],
            ['notification.digest_hour', '7', 'notification', 'integer'],
            ['notification.reminder_hour', '19', 'notification', 'integer'],
            ['privacy.retention_years_after_graduation', '3', 'privacy', 'integer'],
            ['privacy.consent_version', '2026-08-01', 'privacy', 'string'],
            ['feature.journaling', '1', 'feature', 'boolean'],
            ['feature.portfolio', '1', 'feature', 'boolean'],
            ['feature.reflection', '1', 'feature', 'boolean'],
            ['feature.whatsapp_escalation', '1', 'feature', 'boolean'],
        ];

        foreach ($values as [$key, $value, $group, $type]) {
            Setting::updateOrCreate(['key' => $key], ['value' => $value, 'group' => $group, 'type' => $type]);
        }
    }
}
