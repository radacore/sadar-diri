<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AcademicYear;
use App\Models\ClassStudent;
use App\Models\SchoolClass;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AcademicYearController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function index()
    {
        return response()->json([
            'success' => true,
            'data' => AcademicYear::query()->orderByDesc('starts_on')->get()->map(fn ($y) => [
                'id' => $y->id,
                'name' => $y->name,
                'starts_on' => $y->starts_on->toDateString(),
                'ends_on' => $y->ends_on->toDateString(),
                'is_active' => $y->is_active,
            ]),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:20', 'unique:academic_years,name'],
            'starts_on' => ['required', 'date'],
            'ends_on' => ['required', 'date', 'after:starts_on'],
        ]);

        $year = AcademicYear::create($data + ['is_active' => false]);
        $this->audit->record('academic_year.created', 'academic_years', $year->id);

        return response()->json([
            'success' => true,
            'data' => ['id' => $year->id, 'name' => $year->name, 'is_active' => $year->is_active],
        ], 201);
    }

    public function activate(AcademicYear $academicYear)
    {
        DB::transaction(function () use ($academicYear) {
            AcademicYear::query()->where('id', '!=', $academicYear->id)->update(['is_active' => false]);
            $academicYear->update(['is_active' => true]);
        });

        $this->audit->record('academic_year.activated', 'academic_years', $academicYear->id);

        return response()->json(['success' => true, 'data' => ['id' => $academicYear->id, 'is_active' => true]]);
    }

    public function promote(Request $request, AcademicYear $academicYear)
    {
        $data = $request->validate([
            'preview' => ['boolean'],
            'mapping' => ['required', 'array', 'min:1'],
            'mapping.*.from_class_id' => ['required', 'exists:classes,id'],
            'mapping.*.to_class_id' => ['nullable', 'exists:classes,id'],
            'mapping.*.graduate' => ['boolean'],
        ]);

        $conflicts = [];
        $previewMoved = 0;
        $previewGraduated = 0;

        foreach ($data['mapping'] as $map) {
            $from = SchoolClass::findOrFail($map['from_class_id']);
            $count = ClassStudent::query()
                ->where('class_id', $from->id)
                ->where('status', 'active')
                ->count();

            if (($map['graduate'] ?? false) === false) {
                if (empty($map['to_class_id'])) {
                    $conflicts[] = ['from_class_id' => $from->id, 'reason' => 'Kelas tujuan belum dipilih'];

                    continue;
                }

                $to = SchoolClass::findOrFail($map['to_class_id']);

                if ($to->academic_year_id === $from->academic_year_id) {
                    $conflicts[] = ['from_class_id' => $from->id, 'reason' => 'Kelas tujuan berada pada tahun ajaran yang sama'];

                    continue;
                }

                $previewMoved += $count;
            } else {
                $previewGraduated += $count;
            }
        }

        if ($conflicts !== []) {
            return response()->json([
                'success' => false,
                'error' => 'CONFLICT',
                'message' => 'Mapping tidak lengkap atau tidak valid.',
                'data' => ['conflicts' => $conflicts],
            ], 409);
        }

        if ($data['preview'] ?? false) {
            return response()->json([
                'success' => true,
                'data' => [
                    'preview' => true,
                    'students_moved' => $previewMoved,
                    'students_graduated' => $previewGraduated,
                    'conflicts' => [],
                ],
            ]);
        }

        $moved = 0;
        $graduated = 0;

        DB::transaction(function () use ($data, $academicYear, &$moved, &$graduated) {
            foreach ($data['mapping'] as $map) {
                $from = SchoolClass::findOrFail($map['from_class_id']);

                $memberships = ClassStudent::query()
                    ->where('class_id', $from->id)
                    ->where('status', 'active')
                    ->get();

                foreach ($memberships as $membership) {
                    if ($map['graduate'] ?? false) {
                        $membership->update(['status' => 'graduated', 'left_at' => now()->toDateString()]);
                        User::query()->where('id', $membership->student_id)->update(['status' => 'alumni']);
                        $graduated++;
                    } else {
                        $membership->update(['status' => 'moved', 'left_at' => now()->toDateString()]);

                        ClassStudent::updateOrCreate(
                            [
                                'class_id' => $map['to_class_id'],
                                'student_id' => $membership->student_id,
                                'academic_year_id' => $academicYear->id,
                            ],
                            ['joined_at' => now()->toDateString(), 'status' => 'active', 'left_at' => null],
                        );

                        $moved++;
                    }
                }
            }
        });

        $this->audit->record('academic_year.promoted', 'academic_years', $academicYear->id, null, null, [
            'moved' => $moved,
            'graduated' => $graduated,
        ]);

        return response()->json([
            'success' => true,
            'data' => ['preview' => false, 'students_moved' => $moved, 'students_graduated' => $graduated, 'conflicts' => []],
        ]);
    }
}
