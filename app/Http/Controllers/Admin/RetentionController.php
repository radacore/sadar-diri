<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\RetentionService;
use Illuminate\Http\Request;

class RetentionController extends Controller
{
    public function __construct(private readonly RetentionService $retention) {}

    public function preview()
    {
        return response()->json(['success' => true, 'data' => $this->retention->preview()]);
    }

    public function run(Request $request)
    {
        $data = $request->validate([
            'confirm' => ['required', 'accepted'],
            'reason' => ['required', 'string', 'max:500'],
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->retention->run($request->user(), $data['reason']),
            'message' => 'Proses retensi selesai',
        ], 202);
    }
}
