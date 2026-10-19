<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            AcademicYearSeeder::class,
            SuperadminSeeder::class,
            SettingsSeeder::class,
            ContentSeeder::class,
            DemoSeeder::class,
        ]);
    }
}
