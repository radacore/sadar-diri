<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LoginAttempt extends Model
{
    public $timestamps = false;

    protected $fillable = ['identity', 'ip_address', 'successful', 'attempted_at'];

    protected function casts(): array
    {
        return ['successful' => 'boolean', 'attempted_at' => 'datetime'];
    }
}
