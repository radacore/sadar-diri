<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AcademicYear;
use App\Models\ClassStudent;
use App\Models\CounselorClass;
use App\Models\SchoolClass;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ClassController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function index(Request $request)
    {
        $classes = SchoolClass::query()
            ->with(['academicYear', 'counselorAssignments.counselor'])
            ->withCount(['activeMemberships as students_count'])
            ->when($request->filled('academic_year_id'), fn ($q) => $q->where('academic_year_id', $request->integer('academic_year_id')))
            ->when($request->filled('is_active'), fn ($q) => $q->where('is_active', $request->boolean('is_active')))
            ->orderBy('name')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $classes->map(fn (SchoolClass $class) => [
                'id' => $class->id,
                'name' => $class->name,
                'level' => $class->level,
                'academic_year' => $class->academicYear?->name,
                'students_count' => $class->students_count,
                'homeroom_teacher_name' => $class->homeroom_teacher_name,
                'counselors' => $class->counselorAssignments->map(fn ($a) => [
                    'id' => $a->counselor->id,
                    'name' => $a->counselor->name,
                ])->values(),
                'is_active' => $class->is_active,
            ]),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'academic_year_id' => ['required', 'exists:academic_years,id'],
            'name' => ['required', 'string', 'max:50'],
            'level' => ['required', 'string', 'max:10'],
            'homeroom_teacher_name' => ['nullable', 'string', 'max:120'],
        ]);

        $exists = SchoolClass::query()
            ->where('academic_year_id', $data['academic_year_id'])
            ->where('name', $data['name'])
            ->exists();

        if ($exists) {
            return response()->json(['success' => false, 'error' => 'CONFLICT', 'message' => 'Nama kelas sudah ada pada tahun ajaran ini.'], 409);
        }

        $class = SchoolClass::create($data + ['is_active' => true]);
        $this->audit->record('class.created', 'classes', $class->id, null, null, ['name' => $class->name]);

        return response()->json([
            'success' => true,
            'data' => ['id' => $class->id, 'name' => $class->name, 'is_active' => $class->is_active],
        ], 201);
    }

    public function update(Request $request, SchoolClass $class)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:50'],
            'level' => ['sometimes', 'string', 'max:10'],
            'homeroom_teacher_name' => ['nullable', 'string', 'max:120'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if (isset($data['name']) && $data['name'] !== $class->name) {
            $duplicate = SchoolClass::query()
                ->where('academic_year_id', $class->academic_year_id)
                ->where('name', $data['name'])
                ->where('id', '!=', $class->id)
                ->exists();

            if ($duplicate) {
                return response()->json(['success' => false, 'error' => 'CONFLICT', 'message' => 'Nama kelas sudah ada pada tahun ajaran ini.'], 409);
            }
        }

        $before = [
            'name' => $class->name,
            'level' => $class->level,
            'homeroom_teacher_name' => $class->homeroom_teacher_name,
            'is_active' => $class->is_active,
        ];

        $class->fill($data)->save();

        $changes = collect($data)
            ->mapWithKeys(fn ($value, $key) => [$key => ['from' => $before[$key] ?? null, 'to' => $class->{$key}]])
            ->all();

        $this->audit->record('class.updated', 'classes', $class->id, null, null, ['changes' => $changes]);

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $class->id,
                'name' => $class->name,
                'level' => $class->level,
                'homeroom_teacher_name' => $class->homeroom_teacher_name,
                'is_active' => $class->is_active,
                'updated_at' => $class->updated_at?->toIso8601String(),
            ],
        ]);
    }

    public function destroy(SchoolClass $class)
    {
        $active = $class->activeMemberships()->count();

        if ($active > 0) {
            return response()->json([
                'success' => false,
                'error' => 'CONFLICT',
                'message' => 'Kelas masih memiliki '.$active.' siswa aktif. Pindahkan siswa terlebih dahulu.',
            ], 409);
        }

        $class->update(['is_active' => false]);
        $this->audit->record('class.archived', 'classes', $class->id);

        return response()->json(['success' => true, 'data' => ['id' => $class->id, 'is_active' => false]]);
    }

    public function assignStudents(Request $request, SchoolClass $class)
    {
        $data = $request->validate([
            'student_ids' => ['required', 'array', 'min:1'],
            'student_ids.*' => ['exists:users,id'],
        ]);

        $assigned = 0;
        $skipped = 0;

        foreach ($data['student_ids'] as $studentId) {
            $student = User::find($studentId);

            if (! $student || ! $student->isStudent()) {
                $skipped++;
                continue;
            }

            ClassStudent::query()
                ->where('student_id', $student->id)
                ->where('status', 'active')
                ->where('class_id', '!=', $class->id)
                ->update(['status' => 'moved', 'left_at' => now()->toDateString()]);

            ClassStudent::updateOrCreate(
                ['class_id' => $class->id, 'student_id' => $student->id, 'academic_year_id' => $class->academic_year_id],
                ['joined_at' => now()->toDateString(), 'status' => 'active', 'left_at' => null],
            );

            $assigned++;
        }

        $this->audit->record('class.students_assigned', 'classes', $class->id, null, null, ['assigned' => $assigned]);

        return response()->json([
            'success' => true,
            'data' => ['assigned' => $assigned, 'skipped' => $skipped],
            'message' => 'Siswa ditambahkan ke kelas',
        ]);
    }

    public function removeStudent(SchoolClass $class, User $student)
    {
        ClassStudent::query()
            ->where('class_id', $class->id)
            ->where('student_id', $student->id)
            ->update(['status' => 'moved', 'left_at' => now()->toDateString()]);

        $this->audit->record('class.student_removed', 'classes', $class->id, $student->id);

        return response()->json(['success' => true, 'data' => ['student_id' => $student->id, 'status' => 'moved']]);
    }

    public function assignCounselor(Request $request, SchoolClass $class)
    {
        $data = $request->validate([
            'counselor_id' => ['required', 'exists:users,id'],
        ]);

        $counselor = User::findOrFail($data['counselor_id']);
        abort_unless($counselor->isCounselor(), 422, 'Akun bukan Guru BK.');

        $assignment = CounselorClass::firstOrCreate([
            'counselor_id' => $counselor->id,
            'class_id' => $class->id,
        ], ['assigned_at' => now()]);

        if (! $assignment->wasRecentlyCreated) {
            return response()->json(['success' => false, 'error' => 'CONFLICT', 'message' => 'Guru BK sudah ditugaskan pada kelas ini.'], 409);
        }

        $this->audit->record('class.counselor_assigned', 'classes', $class->id, null, null, ['counselor_id' => $counselor->id]);

        return response()->json([
            'success' => true,
            'data' => ['class_id' => $class->id, 'counselor_id' => $counselor->id, 'assigned_at' => $assignment->assigned_at?->toIso8601String()],
        ], 201);
    }

    public function removeCounselor(SchoolClass $class, User $counselor)
    {
        $deleted = CounselorClass::query()
            ->where('class_id', $class->id)
            ->where('counselor_id', $counselor->id)
            ->delete();

        if ($deleted === 0) {
            return response()->json([
                'success' => false,
                'error' => 'NOT_FOUND',
                'message' => 'Guru BK tidak ditugaskan pada kelas ini.',
            ], 404);
        }

        $this->audit->record('class.counselor_removed', 'classes', $class->id, null, null, ['counselor_id' => $counselor->id]);

        return response()->json(['success' => true, 'data' => null, 'message' => 'Penugasan diakhiri']);
    }

    /**
     * Menugaskan satu Guru BK ke beberapa kelas sekaligus. Satu Guru BK boleh
     * memegang banyak kelas dan satu kelas boleh punya lebih dari satu Guru BK,
     * sehingga tidak ada batas jumlah yang ditegakkan di sini.
     */
    public function assignCounselorClasses(Request $request, User $counselor)
    {
        abort_unless($counselor->isCounselor(), 422, 'Akun bukan Guru BK.');

        $data = $request->validate([
            'class_ids' => ['required', 'array', 'min:1'],
            'class_ids.*' => ['integer', 'exists:classes,id'],
        ]);

        $assigned = 0;

        DB::transaction(function () use ($data, $counselor, &$assigned) {
            foreach (array_unique($data['class_ids']) as $classId) {
                $assignment = CounselorClass::firstOrCreate([
                    'counselor_id' => $counselor->id,
                    'class_id' => $classId,
                ], ['assigned_at' => now()]);

                if (! $assignment->wasRecentlyCreated) {
                    continue;
                }

                $assigned++;
                $this->audit->record('class.counselor_assigned', 'classes', $classId, null, null, ['counselor_id' => $counselor->id]);
            }
        });

        return response()->json([
            'success' => true,
            'data' => ['counselor_id' => $counselor->id, 'assigned' => $assigned],
            'message' => $assigned === 0
                ? 'Guru BK sudah ditugaskan pada semua kelas yang dipilih.'
                : "{$assigned} penugasan kelas ditambahkan.",
        ]);
    }
}
