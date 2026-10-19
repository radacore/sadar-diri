import { useCallback, useEffect, useState } from 'react';
import { Button, Card, CardTitle, Field, Input, Select, Skeleton, Stat, useConfirm, useToast } from '../../Components/UI';
import AppShell from '../../Layouts/AppShell';
import { api, download } from '../../lib/api';
import { formatDate } from '../../lib/format';

export default function Reports() {
    const toast = useToast();
    const confirm = useConfirm();
    const [classes, setClasses] = useState([]);
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        class_id: '',
        from: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
        to: new Date().toISOString().slice(0, 10),
    });

    const loadClasses = useCallback(async () => {
        try {
            const response = await api.get('/api/counselor/dashboard');
            setClasses(response.data.classes ?? []);
            if (response.data.classes?.[0]) {
                setFilters((current) => ({ ...current, class_id: String(response.data.classes[0].id) }));
            }
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        loadClasses();
    }, [loadClasses]);

    const run = async () => {
        if (!filters.class_id) return;

        try {
            const query = new URLSearchParams(filters).toString();
            const response = await api.get(`/api/counselor/reports/class?${query}`);
            setReport(response.data);
        } catch (error) {
            toast.push(error.message, 'error');
        }
    };

    useEffect(() => {
        if (filters.class_id) run();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters.class_id]);

    const exportReport = async (format) => {
        const className = classes.find((item) => String(item.id) === String(filters.class_id))?.name ?? '—';

        const decision = await confirm({
            title: `Ekspor laporan ${format.toUpperCase()}?`,
            description: 'Berkas laporan akan diunduh ke perangkat Anda.',
            details: [
                { label: 'Kelas', value: className },
                { label: 'Periode', value: `${formatDate(filters.from)} – ${formatDate(filters.to)}` },
            ],
            confirmLabel: format === 'csv' ? 'Ekspor CSV' : 'Ekspor PDF',
            tone: 'info',
            icon: 'file',
        });
        if (!decision) return;

        try {
            const query = new URLSearchParams({ ...filters, format }).toString();
            await download(`/api/counselor/reports/class/export?${query}`, `laporan-kelas.${format}`);
        } catch (error) {
            toast.push(error.message, 'error');
        }
    };

    return (
        <AppShell
            title="Laporan kelas"
            subtitle="Agregat aktivitas tanpa isi jurnal"
            actions={
                <>
                    <Button variant="info" onClick={() => exportReport('csv')}>Ekspor CSV</Button>
                    <Button variant="info" onClick={() => exportReport('pdf')}>Ekspor PDF</Button>
                </>
            }
        >
            <Card className="mb-4">
                <div className="grid gap-3 sm:grid-cols-4">
                    <Field label="Kelas" htmlFor="class">
                        <Select id="class" value={filters.class_id} onChange={(event) => setFilters({ ...filters, class_id: event.target.value })}>
                            <option value="">Pilih kelas</option>
                            {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </Select>
                    </Field>
                    <Field label="Dari" htmlFor="from">
                        <Input id="from" type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} />
                    </Field>
                    <Field label="Sampai" htmlFor="to">
                        <Input id="to" type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} />
                    </Field>
                    <div className="flex items-end">
                        <Button onClick={run} className="w-full">Terapkan</Button>
                    </div>
                </div>
            </Card>

            {loading ? <Skeleton rows={4} /> : !report ? (
                <Card><p className="py-8 text-center text-[13px] text-[#475569]">Pilih kelas untuk melihat laporan.</p></Card>
            ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
                    <Card className="lg:col-span-3"><Stat label="Siswa aktif" value={report.activity.active_students} hint={`${report.activity.inactive_students} belum aktif`} /></Card>
                    <Card className="lg:col-span-3"><Stat label="Mood positif" value={report.mood.positive_days} hint={`${report.mood.negative_days} hari negatif`} /></Card>
                    <Card className="lg:col-span-3"><Stat label="Refleksi terkirim" value={report.reflections_submitted} hint="Periode terpilih" /></Card>
                    <Card className="lg:col-span-3"><Stat label="Respons alert" value={report.follow_ups.average_response_hours ?? '—'} hint="rata-rata jam" /></Card>

                    <Card className="lg:col-span-12">
                        <CardTitle>Ringkasan {report.class.name}</CardTitle>
                        <table className="sd-table">
                            <thead><tr><th>Metrik</th><th className="text-right">Nilai</th></tr></thead>
                            <tbody>
                                <tr><td>Periode</td><td className="tabular text-right">{report.period.from} – {report.period.to}</td></tr>
                                <tr><td>Prestasi terverifikasi</td><td className="tabular text-right">{report.achievements_verified}</td></tr>
                                <tr><td>Alert total</td><td className="tabular text-right">{report.alerts.total}</td></tr>
                                <tr><td>Alert selesai</td><td className="tabular text-right">{report.alerts.resolved}</td></tr>
                                <tr><td>Alert terbuka</td><td className="tabular text-right">{report.alerts.open}</td></tr>
                            </tbody>
                        </table>
                        <p className="mt-3 text-[11px] text-[#5b6b7f]">
                            Laporan tidak memuat isi jurnal, curhat, atau catatan konseling.
                        </p>
                    </Card>
                </div>
            )}
        </AppShell>
    );
}
