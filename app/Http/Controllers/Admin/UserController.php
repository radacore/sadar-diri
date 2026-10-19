<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClassStudent;
use App\Models\ImportBatch;
use App\Models\SchoolClass;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\ImportService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly ImportService $imports,
    ) {}

    public function index(Request $request)
    {
        $query = User::query()->with('profile');

        if ($request->filled('role')) {
            $query->where('role', $request->query('role'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        if ($request->filled('class_id')) {
            $query->whereIn('id', ClassStudent::query()->where('class_id', $request->integer('class_id'))->pluck('student_id'));
        }

        if ($request->filled('search')) {
            $search = $request->query('search');
            $query->where(fn ($q) => $q->where('name', 'like', "%{$search}%")
                ->orWhere('email', 'like', "%{$search}%")
                ->orWhere('identity_number', 'like', "%{$search}%"));
        }

        $users = $query->orderBy('name')->paginate(25);

        return response()->json([
            'success' => true,
            'data' => collect($users->items())->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'identity_number' => $user->identity_number,
                'role' => $user->role,
                'status' => $user->status,
                'class' => $user->isStudent() && $user->activeClass() ? [
                    'id' => $user->activeClass()->id,
                    'name' => $user->activeClass()->name,
                ] : null,
                'last_login_at' => $user->last_login_at?->toIso8601String(),
                'created_at' => $user->created_at?->toIso8601String(),
            ]),
            'meta' => [
                'current_page' => $users->currentPage(),
                'per_page' => $users->perPage(),
                'total' => $users->total(),
                'last_page' => $users->lastPage(),
            ],
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['nullable', 'email', 'max:190', 'unique:users,email'],
            'identity_number' => ['required', 'string', 'max:30', 'unique:users,identity_number'],
            'role' => ['required', Rule::in(['student', 'counselor', 'superadmin'])],
            'class_id' => ['nullable', 'exists:classes,id', 'required_if:role,student'],
            'send_invitation' => ['boolean'],
        ]);

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'] ?? null,
            'identity_number' => $data['identity_number'],
            'password' => Str::random(20),
            'role' => $data['role'],
            'status' => 'pending',
            'must_change_password' => true,
        ]);

        if (($data['class_id'] ?? null) && $user->isStudent()) {
            $class = SchoolClass::findOrFail($data['class_id']);
            ClassStudent::create([
                'class_id' => $class->id,
                'student_id' => $user->id,
                'academic_year_id' => $class->academic_year_id,
                'joined_at' => now()->toDateString(),
                'status' => 'active',
            ]);
        }

        $invitationSent = false;

        if (($data['send_invitation'] ?? true) && $user->email) {
            $url = \URL::temporarySignedRoute('activate.form', now()->addHours(72), ['user' => $user->id]);
            \Illuminate\Support\Facades\Mail::raw(
                "Halo {$user->name},\n\nAkun SADAR DIRI Anda sudah dibuat. Aktifkan akun melalui tautan berikut (berlaku 72 jam):\n{$url}",
                fn ($message) => $message->to($user->email)->subject('Undangan SADAR DIRI'),
            );
            $invitationSent = true;
        }

        $this->audit->record('user.created', 'users', $user->id, $user->id, null, ['role' => $user->role]);

        return response()->json([
            'success' => true,
            'data' => ['id' => $user->id, 'status' => $user->status, 'invitation_sent' => $invitationSent],
            'message' => 'Akun dibuat dan undangan dikirim',
        ], 201);
    }

    public function show(User $user)
    {
        return response()->json([
            'success' => true,
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'identity_number' => $user->identity_number,
                'role' => $user->role,
                'status' => $user->status,
                'class' => $user->isStudent() && $user->activeClass() ? [
                    'id' => $user->activeClass()->id,
                    'name' => $user->activeClass()->name,
                ] : null,
                'consent_version' => $user->consent_version,
                'last_login_at' => $user->last_login_at?->toIso8601String(),
                'journal_entries_count' => $user->journals()->count(),
                'reflections_count' => $user->reflections()->count(),
            ],
        ]);
    }

    public function update(Request $request, User $user)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'email' => ['nullable', 'email', 'max:190', Rule::unique('users', 'email')->ignore($user->id)],
            'role' => ['sometimes', Rule::in(['student', 'counselor', 'superadmin'])],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        if (isset($data['role']) && $data['role'] !== $user->role) {
            if ($user->isSuperadmin() && $data['role'] !== 'superadmin' && User::query()->where('role', 'superadmin')->where('status', 'active')->count() <= 1) {
                return response()->json(['success' => false, 'error' => 'CONFLICT', 'message' => 'Tidak dapat menurunkan Superadmin terakhir.'], 409);
            }

            $this->audit->record('user.role_changed', 'users', $user->id, $user->id, $data['reason'] ?? null, [
                'from' => $user->role,
                'to' => $data['role'],
            ]);
        }

        $user->fill(collect($data)->except('reason')->all())->save();

        return response()->json(['success' => true, 'data' => ['id' => $user->id, 'updated_at' => $user->updated_at?->toIso8601String()]]);
    }

    public function updateStatus(Request $request, User $user)
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(['active', 'inactive', 'archived', 'alumni'])],
            'reason' => ['required', 'string', 'max:500'],
        ]);

        if ($user->isSuperadmin() && $data['status'] !== 'active' && User::query()->where('role', 'superadmin')->where('status', 'active')->count() <= 1) {
            return response()->json(['success' => false, 'error' => 'CONFLICT', 'message' => 'Tidak dapat menonaktifkan Superadmin terakhir.'], 409);
        }

        $user->forceFill([
            'status' => $data['status'],
            'deactivated_at' => $data['status'] === 'active' ? null : now(),
        ])->save();

        if ($data['status'] !== 'active') {
            \DB::table('sessions')->where('user_id', $user->id)->delete();
        }

        $this->audit->record('user.status_changed', 'users', $user->id, $user->id, $data['reason'], ['status' => $data['status']]);

        return response()->json([
            'success' => true,
            'data' => ['id' => $user->id, 'status' => $user->status, 'deactivated_at' => $user->deactivated_at?->toIso8601String()],
        ]);
    }

    public function resetPassword(Request $request, User $user)
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:500']]);

        if ($user->email) {
            $token = Password::broker()->createToken($user);
            $url = url('/reset-password?token='.$token.'&email='.urlencode($user->email));

            \Illuminate\Support\Facades\Mail::raw(
                "Halo {$user->name},\n\nAdmin sekolah meminta reset kata sandi. Gunakan tautan berikut (berlaku 30 menit):\n{$url}",
                fn ($message) => $message->to($user->email)->subject('Reset kata sandi SADAR DIRI'),
            );
        }

        $this->audit->record('user.password_reset', 'users', $user->id, $user->id, $data['reason']);

        return response()->json([
            'success' => true,
            'data' => ['reset_email_sent' => (bool) $user->email],
            'message' => $user->email ? 'Tautan reset dikirim ke email pengguna' : 'Pengguna tidak memiliki email',
        ]);
    }

    public function forceLogout(Request $request, User $user)
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:500']]);

        $count = \DB::table('sessions')->where('user_id', $user->id)->delete();

        $this->audit->record('user.sessions_revoked', 'users', $user->id, $user->id, $data['reason']);

        return response()->json(['success' => true, 'data' => ['sessions_revoked' => $count]]);
    }

    public function anonymize(Request $request, User $user)
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:500']]);

        if ($user->anonymized_at) {
            return response()->json(['success' => false, 'error' => 'CONFLICT', 'message' => 'Data sudah dianonimkan.'], 409);
        }

        $user->forceFill([
            'name' => 'Pengguna Anonim #'.$user->id,
            'email' => null,
            'identity_number' => 'ANON-'.$user->id,
            'status' => 'archived',
            'anonymized_at' => now(),
        ])->save();

        $user->journals()->delete();
        $user->reflections()->delete();

        $this->audit->record('user.anonymized', 'users', $user->id, $user->id, $data['reason']);

        return response()->json([
            'success' => true,
            'data' => ['id' => $user->id, 'anonymized_at' => $user->anonymized_at?->toIso8601String()],
            'message' => 'Data dianonimkan; audit log dipertahankan',
        ]);
    }

    public function import(Request $request)
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:2048'],
        ]);

        $file = $request->file('file');
        $path = $file->storeAs('private/imports', Str::uuid().'.csv', 'local');

        $batch = ImportBatch::create([
            'filename' => $file->getClientOriginalName(),
            'disk_path' => $path,
            'status' => 'queued',
            'created_by' => $request->user()->id,
        ]);

        $batch = $this->imports->handle($batch, $request->user());

        return response()->json([
            'success' => true,
            'data' => [
                'batch_id' => $batch->id,
                'status' => $batch->status,
                'total_rows' => $batch->total_rows,
            ],
            'message' => 'Impor selesai diproses',
        ], 202);
    }

    public function importBatch(ImportBatch $batch)
    {
        $rows = $batch->rows()->orderBy('row_number')->get();

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $batch->id,
                'filename' => $batch->filename,
                'total_rows' => $batch->total_rows,
                'success_rows' => $batch->success_rows,
                'failed_rows' => $batch->failed_rows,
                'status' => $batch->status,
                'finished_at' => $batch->finished_at?->toIso8601String(),
                'errors' => $rows->where('status', 'failed')->map(fn ($row) => [
                    'row_number' => $row->row_number,
                    'message' => $row->error_message,
                    'payload' => $row->payload,
                ])->values(),
            ],
        ]);
    }
}
