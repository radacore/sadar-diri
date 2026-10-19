<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AnnouncementController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function index()
    {
        $items = Announcement::query()->with('audienceClass')->orderByDesc('created_at')->get();

        return response()->json([
            'success' => true,
            'data' => $items->map(fn ($a) => [
                'id' => $a->id,
                'title' => $a->title,
                'body' => $a->body,
                'audience' => $a->audience,
                'audience_role' => $a->audience_role,
                'audience_class' => $a->audienceClass ? ['id' => $a->audienceClass->id, 'name' => $a->audienceClass->name] : null,
                'status' => $a->status,
                'published_at' => $a->published_at?->toIso8601String(),
                'expires_at' => $a->expires_at?->toIso8601String(),
            ]),
        ]);
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        $publishedAt = $data['published_at'] ?? now();
        $status = $publishedAt->isFuture() ? 'scheduled' : 'published';

        $announcement = Announcement::create($data + [
            'status' => $status,
            'published_at' => $publishedAt,
            'created_by' => $request->user()->id,
        ]);

        $this->audit->record('announcement.created', 'announcements', $announcement->id);

        return response()->json([
            'success' => true,
            'data' => ['id' => $announcement->id, 'status' => $announcement->status],
        ], 201);
    }

    public function update(Request $request, Announcement $announcement)
    {
        $data = $this->validated($request);
        $announcement->fill($data);

        if (isset($data['published_at'])) {
            $announcement->status = $data['published_at']->isFuture() ? 'scheduled' : 'published';
        }

        $announcement->save();
        $this->audit->record('announcement.updated', 'announcements', $announcement->id);

        return response()->json(['success' => true, 'data' => ['id' => $announcement->id, 'updated_at' => $announcement->updated_at?->toIso8601String()]]);
    }

    public function destroy(Announcement $announcement)
    {
        $announcement->update(['status' => 'archived']);
        $this->audit->record('announcement.archived', 'announcements', $announcement->id);

        return response()->json(['success' => true, 'data' => ['id' => $announcement->id, 'status' => 'archived']]);
    }

    private function validated(Request $request): array
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:190'],
            'body' => ['required', 'string', 'max:5000'],
            'audience' => ['required', Rule::in(['all', 'role', 'class'])],
            'audience_role' => ['nullable', 'required_if:audience,role', Rule::in(['student', 'counselor', 'superadmin'])],
            'audience_class_id' => ['nullable', 'required_if:audience,class', 'exists:classes,id'],
            'published_at' => ['nullable', 'date'],
            'expires_at' => ['nullable', 'date', 'after:published_at'],
        ]);

        if (isset($data['published_at'])) {
            $data['published_at'] = \Illuminate\Support\Carbon::parse($data['published_at']);
        }

        return $data;
    }
}
