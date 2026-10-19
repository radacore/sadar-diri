<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class SuperadminSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::firstOrCreate(
            ['identity_number' => 'ADM001'],
            [
                'name' => 'Admin Sekolah',
                'email' => 'admin@sadar-diri.test',
                'password' => Hash::make('Password123'),
                'role' => 'superadmin',
                'status' => 'active',
                'must_change_password' => false,
                'email_verified_at' => now(),
                'two_factor_confirmed_at' => null,
            ],
        );

        $this->command?->info('Superadmin: admin@sadar-diri.test / Password123');
    }
}
