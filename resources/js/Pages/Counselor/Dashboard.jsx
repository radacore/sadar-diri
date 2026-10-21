import { useCallback, useEffect, useState } from 'react';
import {
    Badge,
    Button,
    Card,
    Chip,
    HeroCard,
    ListRow,
    PageSection,
    Skeleton,
    StatTile,
    useToast,
} from '../../Components/UI';
import { Icon } from '../../Components/Icons';
import AppShell from '../../Layouts/AppShell';
import { api } from '../../lib/api';
import { formatDate, label, relative } from '../../lib/format';

const severityTone = { high: 'danger', medium: 'warning', low: 'info' };
const severityBubble = {
    high: 'bg-[#fee2e2] text-[#b91c1c]',
    medium: 'bg-[#fef3c7] text-[#b45309]',
    low: 'bg-[#e0f2fe] text-[#0369a1]',
};

export default function Dashboard() {
    const toast = useToast();
    const [data, setData] = useState(null);
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try {
            const [dashboard, alertList] = await Promise.all([
                api.get('/api/counselor/dashboard'),
                api.get('/api/counselor/alerts?status=new&per_page=5'),
            ]);
            setData(dashboard.data);
            setAlerts(alertList.data ?? []);
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        load();
    }, [load]);

    const maxTrend = Math.max(1, ...(data?.activity_trend?.map((point) => point.active_students) ?? [1]));
    const classes = data?.classes ?? [];
    const totalStudents = classes.reduce((sum, item) => sum + (item.students_count ?? 0), 0);
    const openAlerts = data ? data.open_alerts.high + data.open_alerts.medium + data.open_alerts.low : 0;

    return (
        <AppShell title="Dashboard BK" subtitle="Ringkasan kelas binaan Anda">
            {loading ? (
                <div className="space-y-4">
                    <Skeleton rows={3} />
                    <Skeleton rows={4} />
                    <Skeleton rows={4} />
                </div>
            ) : (
                <div className="space-y-5">
                    <HeroCard
                        eyebrow="Selamat datang kembali"
                        title="Pantau kelas binaan"
                        description={`${classes.length} kelas · ${totalStudents} siswa dampingan`}
                    >
                        {classes.length > 0 ? (
                            <div className="-mx-1 mt-4 flex items-center gap-2 overflow-x-auto px-1 pb-1 [&>button]:min-h-[44px]">
                                {classes.map((item) => (
                                    <Chip
                                        key={item.id}
                                        onClick={() => (window.location.href = `/bk/siswa?class_id=${item.id}`)}
                                    >
                                        {item.name} · {item.students_count}
                                    </Chip>
                                ))}
                            </div>
                        ) : null}
                    </HeroCard>

                    <div className="grid grid-cols-2 gap-3">
                        <StatTile
                            label="Aktif 7 hari"
                            value={data.active_students}
                            hint={`${data.inactive_students} belum aktif`}
                            icon="users"
                        />
                        <StatTile
                            label="Alert terbuka"
                            value={openAlerts}
                            hint={`${data.open_alerts.high} prioritas tinggi`}
                            tone="danger"
                            icon="alert"
                        />
                        <StatTile
                            label="Belum refleksi"
                            value={data.weekly_reflection?.missing ?? 0}
                            hint={`${data.pending_reflections} sesi terbimbing tertunda`}
                            tone={(data.weekly_reflection?.missing ?? 0) > 0 ? 'warning' : undefined}
                            icon="clock"
                        />
                        <StatTile
                            label="Prestasi menunggu"
                            value={data.pending_verifications}
                            hint="Perlu verifikasi"
                            tone="warning"
                            icon="sparkle"
                        />
                    </div>

                    <div className="grid gap-5">
                        <PageSection
                            title="Perlu perhatian"
                            action={
                                <Button size="sm" variant="ghost" onClick={() => (window.location.href = '/bk/alert')}>
                                    Lihat semua
                                </Button>
                            }
                        >
                            {alerts.length === 0 ? (
                                <div className="rounded-[18px] border border-[#e2e8f0] bg-white px-4 py-6 text-center text-[12px] text-[#475569]">
                                    Tidak ada alert baru. Kelas Anda tenang.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {alerts.slice(0, 3).map((alert) => (
                                        <ListRow
                                            key={alert.id}
                                            href="/bk/alert"
                                            leading={
                                                <span className={`flex h-10 w-10 items-center justify-center rounded-full ${severityBubble[alert.severity] ?? severityBubble.low}`}>
                                                    <Icon name="alert" size={18} />
                                                </span>
                                            }
                                            title={alert.student.name}
                                            subtitle={`${alert.student.class ?? '—'} · ${alert.trigger_label}`}
                                            meta={
                                                <>
                                                    <Badge tone={severityTone[alert.severity] ?? 'info'}>
                                                        {label('severity', alert.severity)}
                                                    </Badge>
                                                    <span className="text-[11px] text-[#94a3b8]">{relative(alert.detected_at)}</span>
                                                </>
                                            }
                                            trailing={
                                                <span className="flex items-center gap-0.5 text-[11px] font-semibold text-[#3f51b5]">
                                                    Buka
                                                    <Icon name="chevron" size={14} />
                                                </span>
                                            }
                                        />
                                    ))}
                                </div>
                            )}
                        </PageSection>

                        <Card>
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h2 className="text-[15px] font-bold leading-tight">Aktivitas 14 hari</h2>
                                    <p className="mt-0.5 text-[11.5px] text-[#64748b]">Siswa aktif menulis jurnal per hari</p>
                                </div>
                                <Badge tone="info">Puncak {maxTrend}</Badge>
                            </div>
                            <div className="mt-4 flex h-32 items-end gap-1" aria-hidden="true">
                                {data.activity_trend.map((point) => (
                                    <div
                                        key={point.date}
                                        className="flex h-full flex-1 items-end"
                                        title={`${formatDate(point.date)}: ${point.active_students} siswa`}
                                    >
                                        <div
                                            className="w-full rounded-t-[3px] bg-[#3f51b5]"
                                            style={{ height: `${Math.max(4, (point.active_students / maxTrend) * 100)}%` }}
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="mt-2 flex justify-between text-[11px] text-[#64748b]">
                                <span>{formatDate(data.activity_trend[0]?.date)}</span>
                                <span>{formatDate(data.activity_trend[data.activity_trend.length - 1]?.date)}</span>
                            </div>
                        </Card>
                    </div>

                    <PageSection title="Kelas binaan">
                        {classes.length === 0 ? (
                            <div className="rounded-[18px] border border-[#e2e8f0] bg-white px-4 py-6 text-center text-[12px] text-[#475569]">
                                Belum ada kelas binaan.
                            </div>
                        ) : (
                            <div className="grid gap-2">
                                {classes.map((item) => (
                                    <ListRow
                                        key={item.id}
                                        href={`/bk/siswa?class_id=${item.id}`}
                                        leading={
                                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e8eaf6] text-[#3f51b5]">
                                                <Icon name="users" size={18} />
                                            </span>
                                        }
                                        title={item.name}
                                        subtitle={`${item.students_count} siswa`}
                                        trailing={<Icon name="chevron" size={16} className="text-[#94a3b8]" />}
                                    />
                                ))}
                            </div>
                        )}
                    </PageSection>
                </div>
            )}
        </AppShell>
    );
}
