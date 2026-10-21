import { useCallback, useEffect, useState } from 'react';
import {
    Badge,
    Button,
    Chip,
    EmptyState,
    Input,
    ListRow,
    Segmented,
    Skeleton,
    useToast,
} from '../../Components/UI';
import { Icon } from '../../Components/Icons';
import AppShell from '../../Layouts/AppShell';
import { api } from '../../lib/api';
import { initials, relative } from '../../lib/format';

const activityOptions = [
    { value: '', label: 'Semua' },
    { value: 'active', label: 'Aktif 7 hari' },
    { value: 'inactive', label: 'Belum aktif' },
];

export default function Students() {
    const toast = useToast();
    const [students, setStudents] = useState([]);
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ search: '', class_id: '', activity: '', reflection: '' });

    const load = useCallback(async () => {
        try {
            const query = new URLSearchParams();
            Object.entries(filters).forEach(([key, value]) => {
                if (value) query.set(key, value);
            });

            const [list, dashboard] = await Promise.all([
                api.get(`/api/counselor/students?${query.toString()}`),
                api.get('/api/counselor/dashboard'),
            ]);
            setStudents(list.data ?? []);
            setClasses(dashboard.data.classes ?? []);
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [filters, toast]);

    useEffect(() => {
        const timer = setTimeout(load, 250);
        return () => clearTimeout(timer);
    }, [load]);

    const resetFilters = () => setFilters({ search: '', class_id: '', activity: '', reflection: '' });
    const hasFilter = Boolean(filters.search || filters.class_id || filters.activity || filters.reflection);

    return (
        <AppShell title="Siswa binaan" subtitle="Daftar siswa pada kelas yang Anda dampingi">
            <div className="sticky top-0 z-20 -mx-4 bg-[#eceff4]/95 px-4 pb-2 pt-1 backdrop-blur">
                <div className="relative">
                    <Icon
                        name="search"
                        size={17}
                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8]"
                    />
                    <Input
                        className="h-11 pl-10 text-[13px]"
                        placeholder="Cari nama atau NIS"
                        value={filters.search}
                        onChange={(event) => setFilters({ ...filters, search: event.target.value })}
                        aria-label="Cari siswa"
                    />
                </div>
            </div>

            <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1 [&>button]:min-h-[44px]" role="group" aria-label="Filter kelas">
                <Chip active={!filters.class_id} onClick={() => setFilters({ ...filters, class_id: '' })}>
                    Semua kelas
                </Chip>
                {classes.map((item) => (
                    <Chip
                        key={item.id}
                        active={String(filters.class_id) === String(item.id)}
                        onClick={() => setFilters({ ...filters, class_id: String(item.id) })}
                    >
                        {item.name}
                    </Chip>
                ))}
            </div>

            <Segmented
                className="mt-2 [&>button]:min-h-[44px]"
                options={activityOptions}
                value={filters.activity}
                onChange={(value) => setFilters({ ...filters, activity: value })}
            />

            <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1 [&>button]:min-h-[44px]" role="group" aria-label="Filter refleksi">
                <Chip
                    active={filters.reflection === 'missing'}
                    onClick={() => setFilters({ ...filters, reflection: filters.reflection === 'missing' ? '' : 'missing' })}
                >
                    Belum refleksi pekan ini
                </Chip>
            </div>

            {!loading ? (
                <p className="mt-3 text-[11.5px] text-[#64748b]">{students.length} siswa ditemukan</p>
            ) : null}

            <div className="mt-2">
                {loading ? (
                    <Skeleton rows={6} />
                ) : students.length === 0 ? (
                    <div className="rounded-[22px] border border-dashed border-[#cbd5e1] bg-white/70">
                        <EmptyState
                            title="Tidak ada siswa"
                            description="Belum ada siswa yang cocok dengan filter."
                            action={
                                hasFilter ? (
                                    <Button variant="outline" onClick={resetFilters}>Reset filter</Button>
                                ) : null
                            }
                        />
                    </div>
                ) : (
                    <div className="space-y-2">
                        {students.map((student) => (
                            <ListRow
                                key={student.id}
                                href={`/bk/siswa/${student.id}`}
                                leading={
                                    <span className="sd-avatar flex h-10 w-10 items-center justify-center rounded-full text-[12px] font-bold">
                                        {initials(student.name)}
                                    </span>
                                }
                                title={student.name}
                                subtitle={`${student.class?.name ?? '—'} · ${relative(student.last_activity_at)}`}
                                meta={
                                    <>
                                        {student.dominant_mood_7d ? (
                                            <Badge tone={student.dominant_mood_7d === 'positive' ? 'success' : 'warning'}>
                                                {student.dominant_mood_7d === 'positive' ? 'Positif' : 'Negatif'}
                                            </Badge>
                                        ) : null}
                                        <Badge tone={student.alert_status === 'open' ? 'danger' : 'neutral'}>
                                            {student.alert_status === 'open' ? 'Perlu perhatian' : 'Terpantau'}
                                        </Badge>
                                        {student.weekly_reflection_done === false ? (
                                            <Badge tone="warning">Belum refleksi</Badge>
                                        ) : null}
                                        <span className="text-[11px] text-[#94a3b8]">Profil {student.profile_completeness}%</span>
                                    </>
                                }
                                trailing={<Icon name="chevron" size={16} className="text-[#94a3b8]" />}
                            />
                        ))}
                    </div>
                )}
            </div>
        </AppShell>
    );
}
