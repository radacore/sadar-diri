<?php

namespace App\Services;

use App\Models\Setting;
use App\Models\SettingVersion;
use App\Models\User;
use Illuminate\Support\Facades\Cache;

class SettingsService
{
    public const DEFAULTS = [
        'school.name' => ['SMA Negeri 1 Contoh', 'school', 'string'],
        'school.npsn' => ['12345678', 'school', 'string'],
        'school.address' => ['Jl. Pendidikan No. 1, Kota Contoh', 'school', 'string'],
        'school.logo_path' => [null, 'school', 'string'],
        'school.favicon_path' => [null, 'school', 'string'],
        'school.timezone' => ['Asia/Jakarta', 'school', 'string'],
        'school.whatsapp_number' => ['6281234567890', 'school', 'string'],
        'school.service_hours' => ['Senin–Jumat 08.00–15.00', 'school', 'string'],
        'notification.digest_hour' => ['7', 'notification', 'integer'],
        'notification.reminder_hour' => ['19', 'notification', 'integer'],
        'privacy.retention_years_after_graduation' => ['3', 'privacy', 'integer'],
        'privacy.consent_version' => ['2026-08-01', 'privacy', 'string'],
        'feature.journaling' => ['1', 'feature', 'boolean'],
        'feature.portfolio' => ['1', 'feature', 'boolean'],
        'feature.reflection' => ['1', 'feature', 'boolean'],
        'feature.whatsapp_escalation' => ['1', 'feature', 'boolean'],
    ];

    public function all(): array
    {
        return Cache::remember('settings:all', now()->addDay(), function () {
            $settings = Setting::all()->mapWithKeys(fn (Setting $s) => [$s->key => $s->castedValue()])->all();

            foreach (self::DEFAULTS as $key => [$value, $group, $type]) {
                if (! array_key_exists($key, $settings)) {
                    $settings[$key] = match ($type) {
                        'boolean' => (bool) $value,
                        'integer' => (int) $value,
                        'json' => $value,
                        default => $value,
                    };
                }
            }

            return $settings;
        });
    }

    public function get(string $key, mixed $default = null): mixed
    {
        return $this->all()[$key] ?? $default;
    }

    public function group(string $group): array
    {
        return collect($this->all())
            ->filter(fn ($value, $key) => str_starts_with($key, $group.'.'))
            ->mapWithKeys(fn ($value, $key) => [substr($key, strlen($group) + 1) => $value])
            ->all();
    }

    public function set(string $key, mixed $value, ?User $actor = null): void
    {
        $existing = Setting::firstWhere('key', $key);
        $old = $existing?->value;
        [, $group, $type] = self::DEFAULTS[$key] ?? [null, 'general', 'string'];

        $stored = match ($type) {
            'boolean' => $value ? '1' : '0',
            'integer' => (string) (int) $value,
            'json' => json_encode($value),
            default => $value === null ? null : (string) $value,
        };

        Setting::updateOrCreate(
            ['key' => $key],
            ['value' => $stored, 'group' => $group, 'type' => $type, 'updated_by' => $actor?->id],
        );

        if ($old !== $stored) {
            SettingVersion::create([
                'setting_key' => $key,
                'old_value' => $old,
                'new_value' => $stored,
                'changed_by' => $actor?->id ?? User::query()->value('id'),
                'created_at' => now(),
            ]);
        }

        Cache::forget('settings:all');
    }

    public function updateMany(array $values, ?User $actor = null): array
    {
        $updated = [];

        foreach ($values as $key => $value) {
            if (is_array($value) && (self::DEFAULTS[$key][2] ?? null) !== 'json') {
                foreach ($value as $nested => $nestedValue) {
                    $this->set($key.'.'.$nested, $nestedValue, $actor);
                    $updated[] = $key.'.'.$nested;
                }
                continue;
            }

            $this->set($key, $value, $actor);
            $updated[] = $key;
        }

        return $updated;
    }

    public function school(): array
    {
        return [
            'name' => $this->get('school.name'),
            'npsn' => $this->get('school.npsn'),
            'address' => $this->get('school.address'),
            'timezone' => $this->get('school.timezone'),
            'whatsapp_number' => $this->get('school.whatsapp_number'),
            'service_hours' => $this->get('school.service_hours'),
            'logo_url' => $this->get('school.logo_path') ? asset('storage/'.$this->get('school.logo_path')) : null,
        ];
    }
}
