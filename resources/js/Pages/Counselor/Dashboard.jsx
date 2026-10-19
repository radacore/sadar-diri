import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, CardTitle, Skeleton, Stat, useToast } from '../../Components/UI';
import AppShell from '../../Layouts/AppShell';
import { api } from '../../lib/api';

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

    return (
        <AppShell
            title="Dashboard BK"
            subtitle={data?.classes?.map((item) => item.name).join(', ') || 'Kelas binaan Anda'}
            actions={<Button variant="outline" onClick={() => (window.location.href = '/bk/alert')}>Buka alert</Button>}
        >
            {loading ? <Skeleton rows={5} /> : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
                    <Card className="lg:col-span-3"><Stat label="Siswa aktif 7 hari" value={data.active_students} hint={`${data.inactive_students} belum aktif`} /></Card>
                    <Card className="lg:col-span-3"><Stat label="Alert terbuka" value={data.open_alerts.high + data.open_alerts.medium + data.open_alerts.low} hint={`${data.open_alerts.high} prioritas tinggi`} tone="danger" /></Card>
                    <Card className="lg:col-span-3"><Stat label="Refleksi tertunda" value={data.pending_reflections} hint="Menunggu pengisian siswa" /></Card>
                    <Card className="lg:col-span-3"><Stat label="Prestasi menunggu" value={data.pending_verifications} hint="Perlu verifikasi" tone="warning" /></Card>

                    <Card className="lg:col-span-7">
                        <CardTitle>Aktivitas 14 hari</CardTitle>
                        <div className="flex h-[160px] items-end gap-1.5" aria-hidden="true">
                            {data.activity_trend.map((point) => (
                                <div key={point.date} className="flex-1" title={`${point.date}: ${point.active_students} siswa`}>
                                    <div
                                        className="rounded-t-md bg-[#3f51b5]"
                                        style={{ height: `${Math.max(4, (point.active_students / maxTrend) * 150)}px` }}
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="mt-2 flex justify-between text-[10px] text-[#475569]">
                            <span>{data.activity_trend[0]?.date}</span>
                            <span>{data.activity_trend[data.activity_trend.length - 1]?.date}</span>
                        </div>
                    </Card>

                    <Card className="lg:col-span-5">
                        <CardTitle action={<Button variant="ghost" onClick={() => (window.location.href = '/bk/alert')}>Lihat semua</Button>}>
                            Alert terbaru
                        </CardTitle>
                        {alerts.length === 0 ? (
                            <p className="py-6 text-center text-[12px] text-[#475569]">Tidak ada alert baru. Kelas Anda tenang.</p>
                        ) : (
                            <ul className="space-y-2">
                                {alerts.map((alert) => (
                                    <li key={alert.id} className="rounded-[14px] border-l-4 bg-[#f8fafc] p-3" style={{ borderColor: alert.severity === 'high' ? '#ef4444' : alert.severity === 'medium' ? '#f59e0b' : '#3b82f6' }}>
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <p className="text-[13px] font-semibold">{alert.student.name}</p>
                                                <p className="text-[11px] text-[#475569]">{alert.trigger_label}</p>
                                            </div>
                                            <Badge tone={alert.severity === 'high' ? 'danger' : alert.severity === 'medium' ? 'warning' : 'info'}>
                                                {alert.severity === 'high' ? 'Tinggi' : alert.severity === 'medium' ? 'Sedang' : 'Rendah'}
                                            </Badge>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>

                    <Card className="lg:col-span-12">
                        <CardTitle>Kelas binaan</CardTitle>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            {data.classes.map((item) => (
                                <div key={item.id} className="rounded-[18px] bg-[#f1f5f9] p-4">
                                    <p className="text-[14px] font-bold">{item.name}</p>
                                    <p className="text-[12px] text-[#475569]">{item.students_count} siswa</p>
                                    <Button variant="outline" className="mt-2" onClick={() => (window.location.href = `/bk/siswa?class_id=${item.id}`)}>Lihat siswa</Button>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            )}
        </AppShell>
    );
}
