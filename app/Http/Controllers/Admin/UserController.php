<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClassStudent;
use App\Models\CounselorClass;
use App\Models\ImportBatch;
use App\Models\SchoolClass;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\ImportService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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
        // Akun superadmin hanya dibuat lewat seeder, jadi tidak pernah muncul di daftar pengguna.
        $query = User::query()
            ->with(['profile', 'counselorAssignments.schoolClass'])
            ->where('role', '!=', User::ROLE_SUPERADMIN);

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

        $perPage = (int) $request->query('per_page', 20);
        $perPage = $perPage >= 5 && $perPage <= 100 ? $perPage : 20;

        $users = $query->orderBy('name')->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => collect($users->items())->map(function (User $user) {
                $class = $user->isStudent() ? $user->activeClass() : null;

                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'identity_number' => $user->identity_number,
                    'role' => $user->role,
                    'status' => $user->status,
                    'class' => $class ? ['id' => $class->id, 'name' => $class->name] : null,
                    'classes' => $user->isCounselor()
                        ? $user->counselorAssignments
                            ->filter(fn (CounselorClass $assignment) => $assignment->schoolClass !== null)
                            ->map(fn (CounselorClass $assignment) => [
                                'id' => $assignment->class_id,
                                'name' => $assignment->schoolClass->name,
                            ])
                            ->sortBy('name')
                            ->values()
                        : [],
                    'last_login_at' => $user->last_login_at?->toIso8601String(),
                    'created_at' => $user->created_at?->toIso8601String(),
                ];
            }),
            'meta' => [
                'current_page' => $users->currentPage(),
                'per_page' => $users->perPage(),
                'total' => $users->total(),
                'last_page' => $users->lastPage(),
                'from' => $users->firstItem(),
                'to' => $users->lastItem(),
            ],
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['nullable', 'email', 'max:190', 'unique:users,email'],
            'identity_number' => ['required', 'string', 'max:30', 'unique:users,identity_number'],
            'role' => ['required', Rule::in(['student', 'counselor'])],
            'password' => ['nullable', 'string', 'min:10', 'regex:/[a-z]/', 'regex:/[A-Z]/', 'regex:/[0-9]/'],
            'class_id' => ['nullable', 'exists:classes,id', 'required_if:role,student'],
            'class_ids' => ['nullable', 'array'],
            'class_ids.*' => ['integer', 'exists:classes,id'],
        ], [
            'password.min' => 'Kata sandi minimal 10 karakter.',
            'password.regex' => 'Kata sandi harus memuat huruf besar, huruf kecil, dan angka.',
        ]);

        $user = DB::transaction(function () use ($data) {
            $user = User::create([
                'name' => $data['name'],
                'email' => $data['email'] ?? null,
                'identity_number' => $data['identity_number'],
                // Tanpa kata sandi eksplisit, akun memakai NIS/NIP sebagai kata sandi awal.
                'password' => $data['password'] ?? $data['identity_number'],
                'role' => $data['role'],
                'status' => 'active',
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

            if ($user->isCounselor()) {
                foreach (array_unique($data['class_ids'] ?? []) as $classId) {
                    CounselorClass::firstOrCreate(
                        ['counselor_id' => $user->id, 'class_id' => $classId],
                        ['assigned_at' => now()],
                    );

                    $this->audit->record('class.counselor_assigned', 'classes', $classId, null, null, ['counselor_id' => $user->id]);
                }
            }

            return $user;
        });

        $this->audit->record('user.created', 'users', $user->id, $user->id, null, ['role' => $user->role]);

        $usesIdentity = ! isset($data['password']);

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $user->id,
                'status' => $user->status,
                'initial_password' => $usesIdentity ? $user->identity_number : null,
            ],
            'message' => $usesIdentity
                ? 'Akun dibuat dan langsung aktif. Kata sandi awal: '.$user->identity_number.' (wajib diganti saat masuk pertama).'
                : 'Akun dibuat dan langsung aktif.',
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
            'role' => ['sometimes', Rule::in(['student', 'counselor'])],
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

        $resetSent = false;

        if ($user->email) {
            $token = Password::broker()->createToken($user);
            $url = url('/reset-password?token='.$token.'&email='.urlencode($user->email));

            try {
                \Illuminate\Support\Facades\Mail::to($user->email)
                    ->send(new \App\Mail\PasswordResetMail($user, $url, config('auth.passwords.users.expire', 30), true));
                $resetSent = true;
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::error('Gagal mengirim tautan reset.', [
                    'user_id' => $user->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        $this->audit->record('user.password_reset', 'users', $user->id, $user->id, $data['reason']);

        return response()->json([
            'success' => true,
            'data' => ['reset_email_sent' => $resetSent],
            'message' => ! $user->email
                ? 'Pengguna tidak memiliki email'
                : ($resetSent ? 'Tautan reset dikirim ke email pengguna' : 'Tautan gagal dikirim. Periksa konfigurasi email.'),
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
