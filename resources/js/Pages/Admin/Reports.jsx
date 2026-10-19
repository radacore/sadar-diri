import { useCallback, useEffect, useState } from 'react';
import { Button, Card, CardTitle, Field, Input, Skeleton, useConfirm, useToast } from '../../Components/UI';
import AppShell from '../../Layouts/AppShell';
import { api, download } from '../../lib/api';

export default function Reports() {
    const confirm = useConfirm();
    const toast = useToast();
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        from: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
        to: new Date().toISOString().slice(0, 10),
    });

    const load = useCallback(async () => {
        try {
            const query = new URLSearchParams(filters).toString();
            const response = await api.get(`/api/admin/reports/aggregate?${query}`);
            setReport(response.data);
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [filters, toast]);

    useEffect(() => {
        load();
    }, [load]);

    const exportCsv = async () => {
        const decision = await confirm({
            title: 'Ekspor laporan agregat?',
            description: 'Laporan agregat sesuai filter tanggal akan diunduh sebagai CSV dan tindakan ini dicatat di audit log.',
            confirmLabel: 'Ekspor CSV',
            tone: 'info',
            icon: 'file',
        });
        if (!decision) return;

        try {
            const query = new URLSearchParams(filters).toString();
            await download(`/api/admin/reports/aggregate/export?${query}`, 'laporan-agregat.csv');
        } catch (error) {
            toast.push(error.message, 'error');
        }
    };

    return (
        <AppShell
            title="Laporan agregat"
            subtitle="Statistik lintas kelas dengan ambang privasi 10 siswa"
            actions={<Button variant="info" onClick={exportCsv}>Ekspor CSV</Button>}
        >
            <Card className="mb-4">
                <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Dari" htmlFor="from">
                        <Input id="from" type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} />
                    </Field>
                    <Field label="Sampai" htmlFor="to">
                        <Input id="to" type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} />
                    </Field>
                    <div className="flex items-end">
                        <Button variant="primary" onClick={load} className="w-full">Terapkan</Button>
                    </div>
                </div>
            </Card>

            {loading ? <Skeleton rows={5} /> : (
                <div className="space-y-4">
                    <Card className="p-0 sm:p-6">
                        <div className="p-4 sm:p-0 sm:pb-4"><CardTitle>Per kelas</CardTitle></div>
                        <div className="overflow-x-auto">
                            <table className="sd-table">
                                <thead>
                                    <tr><th>Kelas</th><th className="text-right">Siswa</th><th className="text-right">Aktif</th><th className="text-right">Mood +</th><th className="text-right">Mood −</th><th className="text-right">Profil</th><th className="text-right">Refleksi</th><th className="text-right">Alert</th></tr>
                                </thead>
                                <tbody>
                                    {report.groups.map((group) => (
                                        <tr key={group.class_id}>
                                            <td className="font-semibold">{group.class_name}</td>
                                            <td className="tabular text-right">{group.students_count}</td>
                                            <td className="tabular text-right">{group.active_students}</td>
                                            <td className="tabular text-right">{group.mood_distribution.positive}%</td>
                                            <td className="tabular text-right">{group.mood_distribution.negative}%</td>
                                            <td className="tabular text-right">{group.feature_completion.profile}%</td>
                                            <td className="tabular text-right">{group.feature_completion.reflection}%</td>
                                            <td className="tabular text-right">{group.alerts_open}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    {report.suppressed_groups.length ? (
                        <Card>
                            <CardTitle>Kelompok disaring</CardTitle>
                            <p className="text-[12px] text-[#475569]">
                                {report.suppressed_groups.map((group) => group.class_name).join(', ')} tidak ditampilkan karena jumlah siswa kurang dari 10.
                            </p>
                        </Card>
                    ) : null}
                </div>
            )}
        </AppShell>
    );
}
