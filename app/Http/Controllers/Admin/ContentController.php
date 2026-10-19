<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ContentItem;
use App\Models\ContentItemVersion;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ContentController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function index(Request $request)
    {
        $items = ContentItem::query()
            ->when($request->filled('type'), fn ($q) => $q->where('type', $request->query('type')))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->query('status')))
            ->orderBy('type')
            ->orderBy('title')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $items->map(fn ($item) => [
                'id' => $item->id,
                'type' => $item->type,
                'title' => $item->title,
                'slug' => $item->slug,
                'body' => $item->body,
                'metadata' => $item->metadata,
                'version' => $item->version,
                'status' => $item->status,
                'published_at' => $item->published_at?->toIso8601String(),
            ]),
        ]);
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);

        $exists = ContentItem::query()
            ->where('type', $data['type'])
            ->where('slug', $data['slug'])
            ->exists();

        if ($exists) {
            return response()->json(['success' => false, 'error' => 'CONFLICT', 'message' => 'Slug sudah digunakan untuk tipe konten ini.'], 409);
        }

        $item = ContentItem::create($data + [
            'version' => 1,
            'status' => 'draft',
            'created_by' => $request->user()->id,
        ]);

        $this->audit->record('content.created', 'content_items', $item->id, null, null, ['type' => $item->type]);

        return response()->json([
            'success' => true,
            'data' => ['id' => $item->id, 'version' => $item->version, 'status' => $item->status],
        ], 201);
    }

    public function update(Request $request, ContentItem $content)
    {
        $data = $this->validated($request);

        ContentItemVersion::create([
            'content_item_id' => $content->id,
            'version' => $content->version,
            'snapshot' => $content->only(['title', 'slug', 'body', 'metadata', 'status']),
            'created_by' => $request->user()->id,
            'created_at' => now(),
        ]);

        $content->fill($data + ['version' => $content->version + 1])->save();
        $this->audit->record('content.updated', 'content_items', $content->id);

        return response()->json([
            'success' => true,
            'data' => ['id' => $content->id, 'version' => $content->version, 'status' => $content->status],
        ]);
    }

    public function publish(ContentItem $content)
    {
        $content->update(['status' => 'published', 'published_at' => now()]);
        $this->audit->record('content.published', 'content_items', $content->id);

        return response()->json([
            'success' => true,
            'data' => ['id' => $content->id, 'status' => $content->status, 'published_at' => $content->published_at?->toIso8601String()],
        ]);
    }

    public function rollback(Request $request, ContentItem $content)
    {
        $data = $request->validate(['version' => ['required', 'integer']]);

        $snapshot = ContentItemVersion::query()
            ->where('content_item_id', $content->id)
            ->where('version', $data['version'])
            ->first();

        if (! $snapshot) {
            return response()->json(['success' => false, 'error' => 'NOT_FOUND', 'message' => 'Versi tidak ditemukan.'], 404);
        }

        ContentItemVersion::create([
            'content_item_id' => $content->id,
            'version' => $content->version + 1,
            'snapshot' => $content->only(['title', 'slug', 'body', 'metadata', 'status']),
            'created_by' => $request->user()->id,
            'created_at' => now(),
        ]);

        $content->fill($snapshot->snapshot);
        $content->version = $content->version + 2;
        $content->save();

        $this->audit->record('content.rolled_back', 'content_items', $content->id, null, null, ['restored_from' => $data['version']]);

        return response()->json([
            'success' => true,
            'data' => ['id' => $content->id, 'version' => $content->version, 'restored_from' => $data['version']],
        ]);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'type' => ['required', Rule::in(['abc_prompt', 'reflection_question', 'emotion_category', 'tip_article'])],
            'title' => ['required', 'string', 'max:190'],
            'slug' => ['required', 'string', 'max:190'],
            'body' => ['required', 'string'],
            'metadata' => ['nullable', 'array'],
        ]);
    }
}
