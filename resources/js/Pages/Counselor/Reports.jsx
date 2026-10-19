import { useCallback, useEffect, useState } from 'react';
import {
    Button,
    Field,
    HeroCard,
    Input,
    PageSection,
    Segmented,
    Select,
    Skeleton,
    StatTile,
    useConfirm,
    useToast,
} from '../../Components/UI';
import AppShell from '../../Layouts/AppShell';
import { api, download } from '../../lib/api';
import { formatDate } from '../../lib/format';

const ranges = [
    { value: 7, label: '7 hari' },
    { value: 30, label: '30 hari' },
    { value: 90, label: '90 hari' },
];

export default function Reports() {
    const toast = useToast();
    const confirm = useConfirm();
    const [classes, setClasses] = useState([]);
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [rangeDays, setRangeDays] = useState(30);
    const [rangeRequest, setRangeRequest] = useState(0);
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

    useEffect(() => {
        if (filters.class_id) run();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rangeRequest]);

    const applyRange = (days) => {
        const to = new Date();
        const from = new Date(Date.now() - (days - 1) * 86400000);

        setRangeDays(days);
        setRangeRequest((value) => value + 1);
        setFilters((current) => ({
            ...current,
            from: from.toISOString().slice(0, 10),
            to: to.toISOString().slice(0, 10),
        }));
    };

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

    const positiveDays = report?.mood.positive_days ?? 0;
    const negativeDays = report?.mood.negative_days ?? 0;
    const moodTotal = positiveDays + negativeDays;
    const moodMax = Math.max(positiveDays, negativeDays, 1);
    const maxClassSize = Math.max(...classes.map((item) => item.students_count ?? 0), 1);

    const moodItems = [
        { label: 'Positif', value: positiveDays, bar: 'bg-[#10b981]' },
        { label: 'Negatif', value: negativeDays, bar: 'bg-[#ef4444]' },
    ];

    const detailRows = report ? [
        { label: 'Prestasi terverifikasi', value: report.achievements_verified },
        { label: 'Alert total', value: report.alerts.total },
        { label: 'Alert selesai', value: report.alerts.resolved },
        { label: 'Alert terbuka', value: report.alerts.open },
    ] : [];

    return (
        <AppShell title="Laporan kelas" subtitle="Agregat aktivitas tanpa isi jurnal">
            <div className="space-y-5">
                <div className="rounded-[22px] border border-[#e2e8f0] bg-white p-4">
                    <div className="space-y-3">
                        <Field label="Kelas" htmlFor="class">
                            <Select
                                id="class"
                                value={filters.class_id}
                                onChange={(event) => setFilters({ ...filters, class_id: event.target.value })}
                            >
                                <option value="">Pilih kelas</option>
                                {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                            </Select>
                        </Field>

                        <div>
                            <p className="sd-label">Rentang</p>
                            <Segmented options={ranges} value={rangeDays} onChange={applyRange} className="mt-1.5" />
                        </div>

                        <div className="grid grid-cols-1 gap-2">
                            <Field label="Dari" htmlFor="from">
                                <Input
                                    id="from"
                                    type="date"
                                    value={filters.from}
                                    onChange={(event) => setFilters({ ...filters, from: event.target.value })}
                                />
                            </Field>
                            <Field label="Sampai" htmlFor="to">
                                <Input
                                    id="to"
                                    type="date"
                                    value={filters.to}
                                    onChange={(event) => setFilters({ ...filters, to: event.target.value })}
                                />
                            </Field>
                        </div>

                        <Button className="min-h-[44px] w-full" onClick={run}>Terapkan</Button>
                    </div>
                </div>

                {loading ? <Skeleton rows={4} /> : !report ? (
                    <div className="rounded-[22px] border border-[#e2e8f0] bg-white px-4 py-8 text-center text-[13px] text-[#64748b]">
                        Pilih kelas untuk melihat laporan.
                    </div>
                ) : (
                    <>
                        <HeroCard
                            eyebrow="Laporan kelas"
                            title={report.class.name}
                            description={`Periode ${formatDate(report.period.from)} – ${formatDate(report.period.to)}`}
                        />

                        <div className="grid grid-cols-2 gap-2.5">
                            <StatTile
                                label="Siswa aktif"
                                value={report.activity.active_students}
                                hint={`${report.activity.inactive_students} belum aktif`}
                                tone="primary"
                                icon="users"
                            />
                            <StatTile
                                label="Mood positif"
                                value={report.mood.positive_days}
                                hint={`${report.mood.negative_days} entri negatif`}
                                tone="success"
                                icon="sparkle"
                            />
                            <StatTile
                                label="Refleksi terkirim"
                                value={report.reflections_submitted}
                                hint="Periode terpilih"
                                icon="clock"
                            />
                            <StatTile
                                label="Respons alert"
                                value={report.follow_ups.average_response_hours ?? '—'}
                                hint="Rata-rata jam"
                                tone="warning"
                                icon="alert"
                            />
                        </div>

                        <PageSection title="Distribusi mood">
                            <div className="rounded-[22px] border border-[#e2e8f0] bg-white p-4">
                                <div className="flex items-end gap-4">
                                    {moodItems.map((item) => {
                                        const height = item.value === 0 ? 0 : Math.max(8, Math.round((item.value / moodMax) * 100));

                                        return (
                                            <div key={item.label} className="flex-1">
                                                <p className="tabular mb-1 text-center text-[13px] font-bold text-[#1e293b]">{item.value}</p>
                                                <div className="flex h-24 items-end rounded-xl bg-[#f8fafc] p-1">
                                                    <div className={`w-full rounded-lg ${item.bar}`} style={{ height: `${height}%` }} />
                                                </div>
                                                <p className="mt-1.5 text-center text-[11px] font-medium text-[#64748b]">{item.label}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                                <p className="mt-3 text-[11px] text-[#64748b]">{moodTotal} entri mood pada periode ini.</p>
                            </div>
                        </PageSection>

                        <PageSection title="Kelas binaan">
                            <div className="grid grid-cols-1 gap-2">
                                {classes.map((item) => {
                                    const active = String(item.id) === String(filters.class_id);
                                    const width = Math.round(((item.students_count ?? 0) / maxClassSize) * 100);

                                    return (
                                        <div
                                            key={item.id}
                                            className={`rounded-[18px] border p-3.5 ${ active ? 'border-[#3f51b5]/40 bg-[#f5f7ff]' : 'border-[#e2e8f0] bg-white' }`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="min-w-0 truncate text-[13px] font-semibold text-[#1e293b]">{item.name}</p>
                                                <span className="shrink-0 text-[11px] text-[#64748b]">{item.students_count} siswa</span>
                                            </div>
                                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e8edf5]">
                                                <div className="h-full rounded-full bg-[#3f51b5]" style={{ width: `${width}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <p className="text-[11px] leading-relaxed text-[#64748b]">
                                Panjang bar relatif terhadap kelas dengan siswa terbanyak.
                            </p>
                        </PageSection>

                        <PageSection title="Rincian">
                            <div className="divide-y divide-[#eef2f7] overflow-hidden rounded-[22px] border border-[#e2e8f0] bg-white">
                                {detailRows.map((row) => (
                                    <div key={row.label} className="flex items-center justify-between gap-3 px-4 py-3">
                                        <span className="text-[12.5px] text-[#475569]">{row.label}</span>
                                        <span className="tabular text-[13px] font-bold text-[#1e293b]">{row.value}</span>
                                    </div>
                                ))}
                            </div>
                            <p className="text-[11px] leading-relaxed text-[#64748b]">
                                Laporan tidak memuat isi jurnal, curhat, atau catatan konseling.
                            </p>
                        </PageSection>
                    </>
                )}

                <div className="grid grid-cols-1 gap-2">
                    <Button variant="info" className="min-h-[44px] w-full" onClick={() => exportReport('csv')}>Ekspor CSV</Button>
                    <Button variant="info" className="min-h-[44px] w-full" onClick={() => exportReport('pdf')}>Ekspor PDF</Button>
                </div>
            </div>
        </AppShell>
    );
}
