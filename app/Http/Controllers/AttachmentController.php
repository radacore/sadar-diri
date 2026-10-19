<?php

namespace App\Http\Controllers;

use App\Models\Attachment;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class AttachmentController extends Controller
{
    public function show(Request $request, Attachment $attachment)
    {
        abort_unless($request->hasValidSignature(), 403, 'Tautan tidak valid atau kedaluwarsa.');

        $user = $request->user();
        $achievement = $attachment->achievement;

        $allowed = $user && (
            $achievement->student_id === $user->id
            || $user->isSuperadmin() === false && $user->isCounselor() && app(\App\Services\AccessScope::class)->counselorCanAccess($user, $achievement->student)
        );

        abort_unless($allowed, 403);

        abort_unless(Storage::disk($attachment->disk)->exists($attachment->path), 404);

        return Storage::disk($attachment->disk)->download($attachment->path, $attachment->original_name, [
            'Content-Type' => $attachment->mime_type,
        ]);
    }
}
