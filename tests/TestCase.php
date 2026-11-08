<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config(['filesystems.upload_disk' => 'local']);
        \Illuminate\Support\Facades\Storage::fake('local');
    }
}
