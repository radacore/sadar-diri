import { useCallback, useEffect, useState } from 'react';
import { Card, CardTitle, Skeleton, Stat, useToast } from '../../Components/UI';
import AppShell from '../../Layouts/AppShell';
import { api } from '../../lib/api';

export default function Dashboard() {
    const toast = useToast();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try {
            const response = await api.get('/api/admin/dashboard');
            setData(response.data);
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <AppShell title="Dashboard admin" subtitle="Kesehatan data dan penggunaan aplikasi">
            {loading ? <Skeleton rows={5} /> : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
                    <Card className="lg:col-span-3"><Stat label="Siswa aktif" value={data.students.active} hint={`${data.students.pending_activation} menunggu aktivasi`} /></Card>
                    <Card className="lg:col-span-3"><Stat label="Guru BK aktif" value={data.counselors.active} hint={`${data.counselors.without_class} tanpa kelas`} tone={data.counselors.without_class > 0 ? 'warning' : 'default'} /></Card>
                    <Card className="lg:col-span-3"><Stat label="Alert terbuka" value={data.alerts.open} hint={`${data.alerts.high} prioritas tinggi`} tone={data.alerts.high > 0 ? 'danger' : 'default'} /></Card>
                    <Card className="lg:col-span-3"><Stat label="Respons alert" value={`${data.alerts.avg_response_hours} j`} hint="rata-rata jam" /></Card>

                    <Card className="lg:col-span-7">
                        <CardTitle>Penggunaan 30 hari</CardTitle>
                        <table className="sd-table">
                            <thead><tr><th>Aktivitas</th><th className="text-right">Jumlah</th></tr></thead>
                            <tbody>
                                <tr><td>Entri mood</td><td className="tabular text-right">{data.feature_usage.mood_entries_30d}</td></tr>
                                <tr><td>Entri jurnal</td><td className="tabular text-right">{data.feature_usage.journals_30d}</td></tr>
                                <tr><td>Refleksi</td><td className="tabular text-right">{data.feature_usage.reflections_30d}</td></tr>
                                <tr><td>Prestasi baru</td><td className="tabular text-right">{data.feature_usage.achievements_30d}</td></tr>
                            </tbody>
                        </table>
                    </Card>

                    <Card className="lg:col-span-5">
                        <CardTitle>Status layanan</CardTitle>
                        <div className="space-y-3 text-[13px]">
                            <div className="flex items-center justify-between rounded-xl bg-[#f1f5f9] p-3">
                                <span>Penyimpanan bukti prestasi</span>
                                <span className="tabular font-semibold">{data.storage.used_gb} GB / {data.storage.quota_gb} GB</span>
                            </div>
                            <div className="flex items-center justify-between rounded-xl bg-[#f1f5f9] p-3">
                                <span>Siswa nonaktif</span>
                                <span className="tabular font-semibold">{data.students.inactive}</span>
                            </div>
                            <div className="rounded-xl bg-[#e8eaf6] p-3 text-[12px] text-[#303f9f]">
                                Superadmin tidak memiliki akses ke isi jurnal. Semua tindakan tercatat di audit log.
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </AppShell>
    );
}
