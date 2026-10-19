<?php

namespace App\Http\Controllers;

use App\Models\Announcement;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $query = $request->user()->notifications();

        if ($request->boolean('unread')) {
            $query->whereNull('read_at');
        }

        $items = $query->paginate(20);

        return response()->json([
            'success' => true,
            'data' => collect($items->items())->map(fn ($n) => [
                'id' => $n->id,
                'type' => $n->data['type'] ?? 'info',
                'title' => $n->data['title'] ?? '',
                'body' => $n->data['body'] ?? '',
                'url' => $n->data['url'] ?? null,
                'read_at' => $n->read_at?->toIso8601String(),
                'created_at' => $n->created_at?->toIso8601String(),
            ]),
            'meta' => [
                'current_page' => $items->currentPage(),
                'per_page' => $items->perPage(),
                'total' => $items->total(),
                'last_page' => $items->lastPage(),
                'unread' => $request->user()->unreadNotifications()->count(),
            ],
        ]);
    }

    public function markRead(Request $request, string $id)
    {
        $notification = $request->user()->notifications()->where('id', $id)->firstOrFail();
        $notification->markAsRead();

        return response()->json(['success' => true, 'data' => ['read_at' => $notification->read_at?->toIso8601String()]]);
    }

    public function markAllRead(Request $request)
    {
        $request->user()->unreadNotifications->markAsRead();

        return response()->json(['success' => true, 'data' => null, 'message' => 'Semua notifikasi dibaca']);
    }

    public function announcements(Request $request)
    {
        $user = $request->user();
        $classId = $user->isStudent() ? $user->activeClass()?->id : null;

        $items = Announcement::query()
            ->where('status', 'published')
            ->where('published_at', '<=', now())
            ->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>=', now()))
            ->where(function ($query) use ($user, $classId) {
                $query->where('audience', 'all')
                    ->orWhere(fn ($q) => $q->where('audience', 'role')->where('audience_role', $user->role));

                if ($classId) {
                    $query->orWhere(fn ($q) => $q->where('audience', 'class')->where('audience_class_id', $classId));
                }
            })
            ->orderByDesc('published_at')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $items->map(fn ($a) => [
                'id' => $a->id,
                'title' => $a->title,
                'body' => $a->body,
                'published_at' => $a->published_at?->toIso8601String(),
                'expires_at' => $a->expires_at?->toIso8601String(),
            ]),
        ]);
    }
}
