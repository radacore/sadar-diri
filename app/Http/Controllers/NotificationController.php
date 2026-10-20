<?php

namespace App\Http\Controllers;

use App\Services\AnnouncementFeed;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function __construct(private readonly AnnouncementFeed $announcements) {}

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
        $items = $this->announcements->listFor($user, $request->integer('limit') ?: null);

        return response()->json([
            'success' => true,
            'data' => $items,
            'meta' => [
                'total' => $items->count(),
                'unread' => $this->announcements->unreadCount($user),
            ],
        ]);
    }

    public function markAnnouncementRead(Request $request, int $announcement)
    {
        $user = $request->user();
        $item = $this->announcements->visible($user)->whereKey($announcement)->firstOrFail();

        $this->announcements->markRead($user, $item);

        return response()->json([
            'success' => true,
            'data' => ['id' => $item->id, 'read_at' => now()->toIso8601String()],
            'meta' => ['unread' => $this->announcements->unreadCount($user)],
        ]);
    }

    public function markAllAnnouncementsRead(Request $request)
    {
        $user = $request->user();
        $count = $this->announcements->markAllRead($user);

        return response()->json([
            'success' => true,
            'data' => ['marked' => $count],
            'meta' => ['unread' => 0],
        ]);
    }
}
