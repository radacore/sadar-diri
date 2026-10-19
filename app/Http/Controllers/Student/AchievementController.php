<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\Achievement;
use App\Models\Attachment;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AchievementController extends Controller
{
    public function index(Request $request)
    {
        $query = Achievement::query()
            ->where('student_id', $request->user()->id)
            ->withCount('attachments');

        if ($request->filled('category')) {
            $query->where('category', $request->query('category'));
        }

        if ($request->filled('level')) {
            $query->where('level', $request->query('level'));
        }

        $items = $query->orderByDesc('achieved_at')->paginate(20);

        return response()->json([
            'success' => true,
            'data' => collect($items->items())->map(fn ($a) => $this->payload($a)),
            'meta' => [
                'current_page' => $items->currentPage(),
                'per_page' => $items->perPage(),
                'total' => $items->total(),
                'last_page' => $items->lastPage(),
            ],
        ]);
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);

        $achievement = Achievement::create($data + [
            'student_id' => $request->user()->id,
            'verification_status' => 'pending',
        ]);

        return response()->json([
            'success' => true,
            'data' => ['id' => $achievement->id, 'verification_status' => 'pending'],
            'message' => 'Prestasi ditambahkan dan menunggu verifikasi',
        ], 201);
    }

    public function update(Request $request, Achievement $achievement)
    {
        $this->authorizeOwnership($request, $achievement);

        $data = $this->validated($request);
        $achievement->fill($data + ['verification_status' => 'pending', 'verified_by' => null, 'verified_at' => null, 'rejection_reason' => null])->save();

        return response()->json([
            'success' => true,
            'data' => ['id' => $achievement->id, 'verification_status' => $achievement->verification_status],
            'message' => 'Prestasi diperbarui',
        ]);
    }

    public function destroy(Request $request, Achievement $achievement)
    {
        $this->authorizeOwnership($request, $achievement);

        if ($achievement->verification_status === 'verified') {
            return response()->json([
                'success' => false,
                'error' => 'FORBIDDEN',
                'message' => 'Prestasi terverifikasi tidak dapat dihapus. Ajukan perubahan ke Guru BK.',
            ], 403);
        }

        foreach ($achievement->attachments as $attachment) {
            Storage::disk($attachment->disk)->delete($attachment->path);
        }

        $achievement->delete();

        return response()->json(['success' => true, 'data' => null, 'message' => 'Prestasi dihapus']);
    }

    public function upload(Request $request, Achievement $achievement)
    {
        $this->authorizeOwnership($request, $achievement);

        $request->validate([
            'file' => ['required', 'file', 'max:5120', 'mimes:jpg,jpeg,png,pdf'],
        ]);

        if ($achievement->attachments()->count() >= 5) {
            return response()->json([
                'success' => false,
                'error' => 'LIMIT_REACHED',
                'message' => 'Maksimal 5 berkas bukti per prestasi.',
            ], 422);
        }

        $file = $request->file('file');
        $path = $file->storeAs(
            'private/achievements/'.$request->user()->id,
            Str::uuid().'.'.$file->getClientOriginalExtension(),
            'local',
        );

        $attachment = Attachment::create([
            'achievement_id' => $achievement->id,
            'uploaded_by' => $request->user()->id,
            'disk' => 'local',
            'path' => $path,
            'original_name' => $file->getClientOriginalName(),
            'mime_type' => $file->getMimeType(),
            'size_bytes' => $file->getSize(),
            'checksum' => hash_file('sha256', $file->getRealPath()),
        ]);

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $attachment->id,
                'original_name' => $attachment->original_name,
                'mime_type' => $attachment->mime_type,
                'size_bytes' => $attachment->size_bytes,
                'url' => $attachment->signedUrl(),
            ],
        ], 201);
    }

    public function destroyAttachment(Request $request, Attachment $attachment)
    {
        abort_unless($attachment->uploaded_by === $request->user()->id, 403);

        Storage::disk($attachment->disk)->delete($attachment->path);
        $attachment->delete();

        return response()->json(['success' => true, 'data' => null, 'message' => 'Lampiran dihapus']);
    }

    public function export(Request $request)
    {
        $includePending = $request->boolean('include_pending');

        $items = Achievement::query()
            ->where('student_id', $request->user()->id)
            ->when(! $includePending, fn ($q) => $q->where('verification_status', 'verified'))
            ->orderByDesc('achieved_at')
            ->get();

        $html = view('pdf.portfolio', [
            'student' => $request->user(),
            'class' => $request->user()->activeClass(),
            'items' => $items,
        ])->render();

        return Pdf::loadHTML($html)->setPaper('a4')->download('portofolio-'.Str::slug($request->user()->name).'.pdf');
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'category' => ['required', Rule::in(['academic', 'non_academic', 'competition', 'soft_skill'])],
            'title' => ['required', 'string', 'max:190'],
            'organizer' => ['nullable', 'string', 'max:190'],
            'level' => ['nullable', Rule::in(['school', 'district', 'city', 'province', 'national', 'international'])],
            'achieved_at' => ['required', 'date', 'before_or_equal:today'],
            'rank' => ['nullable', 'string', 'max:50'],
            'description' => ['nullable', 'string', 'max:2000'],
        ]);
    }

    private function authorizeOwnership(Request $request, Achievement $achievement): void
    {
        abort_unless($achievement->student_id === $request->user()->id, 403);
    }

    private function payload(Achievement $achievement): array
    {
        return [
            'id' => $achievement->id,
            'category' => $achievement->category,
            'title' => $achievement->title,
            'organizer' => $achievement->organizer,
            'level' => $achievement->level,
            'achieved_at' => $achievement->achieved_at->toDateString(),
            'rank' => $achievement->rank,
            'description' => $achievement->description,
            'verification_status' => $achievement->verification_status,
            'rejection_reason' => $achievement->rejection_reason,
            'attachments_count' => $achievement->attachments_count ?? $achievement->attachments()->count(),
            'attachments' => $achievement->attachments->map(fn ($a) => [
                'id' => $a->id,
                'original_name' => $a->original_name,
                'mime_type' => $a->mime_type,
                'size_bytes' => $a->size_bytes,
                'url' => $a->signedUrl(),
            ])->all(),
        ];
    }
}
