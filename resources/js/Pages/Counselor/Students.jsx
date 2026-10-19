import { useCallback, useEffect, useState } from 'react';
import { Badge, Card, CardTitle, EmptyState, Input, Skeleton, useToast } from '../../Components/UI';
import AppShell from '../../Layouts/AppShell';
import { api } from '../../lib/api';
import { relative } from '../../lib/format';

export default function Students() {
    const toast = useToast();
    const [students, setStudents] = useState([]);
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ search: '', class_id: '', activity: '' });

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

    return (
        <AppShell title="Siswa binaan" subtitle="Daftar siswa pada kelas yang Anda dampingi">
            <Card className="p-0 sm:p-6">
                <div className="flex flex-wrap items-center gap-2 p-4 sm:p-0 sm:pb-4">
                    <CardTitle>Siswa</CardTitle>
                    <div className="flex flex-1 flex-wrap justify-end gap-2">
                        <Input
                            className="h-9 w-full max-w-[240px] text-[12px]"
                            placeholder="Cari nama atau NIS"
                            value={filters.search}
                            onChange={(event) => setFilters({ ...filters, search: event.target.value })}
                        />
                        <select className="sd-input h-9 w-auto px-3 text-[12px]" value={filters.class_id} onChange={(event) => setFilters({ ...filters, class_id: event.target.value })} aria-label="Filter kelas">
                            <option value="">Semua kelas</option>
                            {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                        <select className="sd-input h-9 w-auto px-3 text-[12px]" value={filters.activity} onChange={(event) => setFilters({ ...filters, activity: event.target.value })} aria-label="Filter aktivitas">
                            <option value="">Semua aktivitas</option>
                            <option value="active">Aktif 7 hari</option>
                            <option value="inactive">Belum aktif</option>
                        </select>
                    </div>
                </div>

                {loading ? <div className="p-4"><Skeleton rows={5} /></div> : students.length === 0 ? (
                    <EmptyState title="Tidak ada siswa" description="Belum ada siswa yang cocok dengan filter." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="sd-table">
                            <thead>
                                <tr>
                                    <th>Nama</th>
                                    <th>Kelas</th>
                                    <th>Aktivitas</th>
                                    <th>Mood 7 hari</th>
                                    <th>Profil</th>
                                    <th>Alert</th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.map((student) => (
                                    <tr key={student.id} className="cursor-pointer" onClick={() => (window.location.href = `/bk/siswa/${student.id}`)}>
                                        <td className="font-semibold">{student.name}</td>
                                        <td>{student.class?.name ?? '—'}</td>
                                        <td>{relative(student.last_activity_at)}</td>
                                        <td>
                                            {student.dominant_mood_7d ? (
                                                <Badge tone={student.dominant_mood_7d === 'positive' ? 'success' : 'warning'}>
                                                    {student.dominant_mood_7d === 'positive' ? 'Positif' : 'Negatif'}
                                                </Badge>
                                            ) : <span className="text-[#475569]">—</span>}
                                        </td>
                                        <td className="tabular">{student.profile_completeness}%</td>
                                        <td>
                                            <Badge tone={student.alert_status === 'open' ? 'danger' : 'neutral'}>
                                                {student.alert_status === 'open' ? 'Perlu perhatian' : 'Terpantau'}
                                            </Badge>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </AppShell>
    );
}
