import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, CardTitle, EmptyState, Field, Modal, Skeleton, Textarea, useConfirm, useToast } from '../../Components/UI';
import AppShell from '../../Layouts/AppShell';
import { api } from '../../lib/api';
import { formatDate, label } from '../../lib/format';

const severityTone = { high: 'danger', medium: 'warning', low: 'info' };

export default function Alerts() {
    const toast = useToast();
    const confirm = useConfirm();
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('new');
    const [severity, setSeverity] = useState('');
    const [detail, setDetail] = useState(null);
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            const query = new URLSearchParams();
            if (status) query.set('status', status);
            if (severity) query.set('severity', severity);
            const response = await api.get(`/api/counselor/alerts?${query.toString()}`);
            setAlerts(response.data ?? []);
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [status, severity, toast]);

    useEffect(() => {
        load();
    }, [load]);

    const openDetail = async (alert) => {
        try {
            const response = await api.get(`/api/counselor/alerts/${alert.id}`);
            setDetail(response.data);
            setNote(response.data.resolution_note ?? '');
        } catch (error) {
            toast.push(error.message, 'error');
        }
    };

    const update = async (nextStatus) => {
        const closing = nextStatus === 'resolved';
        const decision = await confirm({
            title: closing ? 'Selesaikan alert?' : 'Tandai alert ditangani?',
            description: closing
                ? 'Alert akan ditutup dan catatan penyelesaian disimpan pada riwayat siswa.'
                : 'Siswa tetap berada di daftar alert sampai alert diselesaikan.',
            confirmLabel: closing ? 'Selesaikan' : 'Tandai ditangani',
            tone: closing ? 'success' : 'info',
            icon: closing ? 'check' : 'alert',
            requireReason: closing ? 'Catatan penyelesaian' : false,
        });
        if (!decision) return;

        setBusy(true);
        try {
            await api.patch(`/api/counselor/alerts/${detail.id}`, { status: nextStatus, resolution_note: closing ? decision.reason : note || null });
            toast.push('Status alert diperbarui.');
            setDetail(null);
            await load();
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <AppShell title="Kotak masuk alert" subtitle="Siswa yang perlu perhatian berdasarkan data jurnal dan aktivitas">
            <div className="mb-4 flex flex-wrap gap-2">
                {[
                    { value: 'new', text: 'Baru' },
                    { value: 'in_progress', text: 'Ditangani' },
                    { value: 'resolved', text: 'Selesai' },
                    { value: '', text: 'Semua status' },
                ].map((item) => (
                    <button
                        key={item.value}
                        type="button"
                        onClick={() => setStatus(item.value)}
                        aria-pressed={status === item.value}
                        className={`rounded-full px-4 py-2 text-[12px] font-semibold transition ${
                            status === item.value ? 'bg-[#3f51b5] text-white' : 'bg-white text-[#1e293b] hover:bg-[#f1f5f9]'
                        }`}
                    >
                        {item.text}
                    </button>
                ))}
                <select className="sd-input h-9 w-auto px-3 text-[12px]" value={severity} onChange={(event) => setSeverity(event.target.value)} aria-label="Filter prioritas">
                    <option value="">Semua prioritas</option>
                    <option value="high">Tinggi</option>
                    <option value="medium">Sedang</option>
                    <option value="low">Rendah</option>
                </select>
            </div>

            {loading ? <Skeleton rows={5} /> : alerts.length === 0 ? (
                <Card><EmptyState title="Tidak ada alert" description="Semua siswa pada kelas binaan Anda terpantau baik." /></Card>
            ) : (
                <div className="space-y-3">
                    {alerts.map((alert) => (
                        <Card key={alert.id} className="border-l-4 p-4 sm:p-5" as="article">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <div className="mb-1 flex flex-wrap items-center gap-2">
                                        <Badge tone={severityTone[alert.severity]}>{label('severity', alert.severity)}</Badge>
                                        <Badge tone={alert.status === 'resolved' ? 'success' : 'neutral'}>{label('alertStatus', alert.status)}</Badge>
                                        <span className="text-[11px] text-[#475569]">{formatDate(alert.detected_at, true)}</span>
                                    </div>
                                    <p className="text-[14px] font-bold">{alert.student.name}</p>
                                    <p className="text-[12px] text-[#475569]">
                                        {alert.student.class ?? '—'} · {alert.trigger_label}
                                    </p>
                                </div>
                                <Button variant="outline" onClick={() => openDetail(alert)}>Tindak lanjuti</Button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            <Modal
                open={Boolean(detail)}
                onClose={() => setDetail(null)}
                title="Tindak lanjut alert"
                footer={
                    <>
                        <Button variant="outline" onClick={() => setDetail(null)}>Tutup</Button>
                        {detail?.status !== 'in_progress' && detail?.status !== 'resolved' ? (
                            <Button variant="info" onClick={() => update('in_progress')} disabled={busy}>Tandai ditangani</Button>
                        ) : null}
                        {detail?.status !== 'resolved' ? (
                            <Button variant="success" onClick={() => update('resolved')} disabled={busy}>Selesaikan</Button>
                        ) : null}
                    </>
                }
            >
                {detail ? (
                    <div className="space-y-3">
                        <div className="rounded-xl bg-[#f1f5f9] p-3 text-[12px]">
                            <p className="font-semibold">{detail.student.name} · {detail.student.class ?? '—'}</p>
                            <p className="text-[#475569]">{detail.trigger_label}</p>
                            <p className="text-[#475569]">Terdeteksi {formatDate(detail.detected_at, true)}</p>
                            {detail.context?.negative_days ? (
                                <p className="mt-1 text-[#475569]">
                                    {detail.context.negative_days} hari mood negatif · intensitas terakhir {detail.context.last_intensity}
                                </p>
                            ) : null}
                        </div>
                        <Field label="Catatan tindak lanjut" required htmlFor="note" hint="Wajib diisi sebelum alert ditutup.">
                            <Textarea id="note" rows={4} value={note} onChange={(event) => setNote(event.target.value)} />
                        </Field>
                        <p className="text-[11px] text-[#5b6b7f]">
                            Alert adalah penanda untuk pendampingan, bukan diagnosis. Membuka jurnal siswa akan tercatat di audit log.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" onClick={() => (window.location.href = `/bk/siswa/${detail.student.id}`)}>Buka profil siswa</Button>
                            <Button variant="ghost" onClick={() => (window.location.href = `/bk/catatan?student_id=${detail.student.id}`)}>Tulis catatan</Button>
                        </div>
                    </div>
                ) : null}
            </Modal>
        </AppShell>
    );
}
