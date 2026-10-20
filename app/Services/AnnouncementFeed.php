<?php

namespace App\Services;

use App\Models\Announcement;
use App\Models\AnnouncementRead;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Satu sumber kebenaran untuk "pengumuman mana yang berlaku bagi pengguna ini",
 * dipakai bersama oleh dashboard, lonceng notifikasi, dan penanda dibaca.
 */
class AnnouncementFeed
{
    public function visible(User $user): Builder
    {
        $classIds = $this->classIdsFor($user);

        return Announcement::query()
            ->where('status', 'published')
            ->where('published_at', '<=', now())
            ->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>=', now()))
            ->where(function ($query) use ($user, $classIds) {
                $query->where('audience', 'all')
                    ->orWhere(fn ($q) => $q->where('audience', 'role')->where('audience_role', $user->role));

                if ($classIds !== []) {
                    $query->orWhere(fn ($q) => $q->where('audience', 'class')->whereIn('audience_class_id', $classIds));
                }
            });
    }

    public function listFor(User $user, ?int $limit = null): Collection
    {
        $query = $this->visible($user)
            ->with(['reads' => fn ($q) => $q->where('user_id', $user->id)])
            ->orderByDesc('published_at');

        if ($limit) {
            $query->limit($limit);
        }

        return $query->get()->map(fn (Announcement $a) => [
            'id' => $a->id,
            'title' => $a->title,
            'body' => $a->body,
            'audience' => $a->audience,
            'published_at' => $a->published_at?->toIso8601String(),
            'expires_at' => $a->expires_at?->toIso8601String(),
            'read_at' => $a->reads->first()?->read_at?->toIso8601String(),
        ]);
    }

    public function unreadCount(User $user): int
    {
        return $this->visible($user)
            ->whereDoesntHave('reads', fn ($q) => $q->where('user_id', $user->id))
            ->count();
    }

    public function markRead(User $user, Announcement $announcement): void
    {
        AnnouncementRead::query()->firstOrCreate(
            ['announcement_id' => $announcement->id, 'user_id' => $user->id],
            ['read_at' => now()],
        );
    }

    public function markAllRead(User $user): int
    {
        $now = now();

        $rows = $this->visible($user)
            ->whereDoesntHave('reads', fn ($q) => $q->where('user_id', $user->id))
            ->pluck('id')
            ->map(fn ($id) => [
                'announcement_id' => $id,
                'user_id' => $user->id,
                'read_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ])
            ->all();

        if ($rows !== []) {
            AnnouncementRead::query()->insertOrIgnore($rows);
        }

        return count($rows);
    }

    /**
     * Siswa melihat pengumuman kelasnya; Guru BK juga melihat pengumuman kelas
     * yang diampu agar informasi untuk kelas tersebut tidak terlewat.
     */
    private function classIdsFor(User $user): array
    {
        if ($user->isStudent()) {
            $classId = $user->activeClass()?->id;

            return $classId ? [$classId] : [];
        }

        if ($user->isCounselor()) {
            return $user->counselorAssignments()->pluck('class_id')->unique()->values()->all();
        }

        return [];
    }
}
