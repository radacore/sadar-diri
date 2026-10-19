import { useCallback, useEffect, useState } from 'react';
import {
    Badge,
    Button,
    Chip,
    EmptyState,
    Field,
    Sheet,
    Skeleton,
    Textarea,
    useConfirm,
    useToast,
} from '../../Components/UI';
import { Icon } from '../../Components/Icons';
import AppShell from '../../Layouts/AppShell';
import { api } from '../../lib/api';
import { formatDate, label, relative } from '../../lib/format';

const severityTone = { high: 'danger', medium: 'warning', low: 'info' };
const severityStripe = { high: '#ef4444', medium: '#f59e0b', low: '#3b82f6' };
const statusTone = { new: 'danger', in_progress: 'warning', resolved: 'success' };

const statusFilters = [
    { value: '', text: 'Semua' },
    { value: 'new', text: 'Baru' },
    { value: 'in_progress', text: 'Ditangani' },
    { value: 'resolved', text: 'Selesai' },
];

const severityFilters = [
    { value: '', text: 'Semua prioritas' },
    { value: 'high', text: 'Tinggi' },
    { value: 'medium', text: 'Sedang' },
    { value: 'low', text: 'Rendah' },
];

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
            <div className="space-y-2">
                <div className="flex items-center gap-2 overflow-x-auto pb-1 [&>button]:min-h-[44px]" role="group" aria-label="Filter status alert">
                    {statusFilters.map((item) => (
                        <Chip
                            key={item.value || 'all'}
                            active={status === item.value}
                            onClick={() => setStatus(item.value)}
                        >
                            {item.text}
                        </Chip>
                    ))}
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 [&>button]:min-h-[44px]" role="group" aria-label="Filter prioritas alert">
                    {severityFilters.map((item) => (
                        <Chip
                            key={item.value || 'all'}
                            active={severity === item.value}
                            tone={item.value === 'high' ? 'danger' : 'neutral'}
                            onClick={() => setSeverity(item.value)}
                        >
                            {item.text}
                        </Chip>
                    ))}
                </div>
            </div>

            <div className="mt-4">
                {loading ? (
                    <Skeleton rows={5} />
                ) : alerts.length === 0 ? (
                    <div className="rounded-[22px] border border-dashed border-[#cbd5e1] bg-white/70">
                        <EmptyState
                            title="Tidak ada alert"
                            description="Semua siswa pada kelas binaan Anda terpantau baik."
                        />
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {alerts.map((alert) => (
                            <article
                                key={alert.id}
                                className="rounded-[20px] border border-[#e2e8f0] border-l-4 bg-white p-4 shadow-[0_2px_10px_-6px_rgba(15,23,42,0.12)]"
                                style={{ borderLeftColor: severityStripe[alert.severity] ?? severityStripe.low }}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                                            <Badge tone={severityTone[alert.severity] ?? 'info'}>
                                                {label('severity', alert.severity)}
                                            </Badge>
                                            <Badge tone={statusTone[alert.status] ?? 'neutral'}>
                                                {label('alertStatus', alert.status)}
                                            </Badge>
                                        </div>
                                        <p className="truncate text-[15px] font-bold leading-tight">{alert.student.name}</p>
                                        <p className="truncate text-[12px] text-[#475569]">{alert.student.class ?? '—'}</p>
                                    </div>
                                    <span className="shrink-0 text-[11px] text-[#94a3b8]">{relative(alert.detected_at)}</span>
                                </div>

                                <p className="mt-2 flex items-start gap-1.5 text-[12px] leading-snug text-[#475569]">
                                    <Icon name="alert" size={14} className="mt-0.5 shrink-0 text-[#94a3b8]" />
                                    <span className="break-words">{alert.trigger_label}</span>
                                </p>

                                <Button variant="soft" className="mt-3 w-full" onClick={() => openDetail(alert)}>
                                    Tindak lanjuti
                                </Button>
                            </article>
                        ))}
                    </div>
                )}
            </div>

            <Sheet
                open={Boolean(detail)}
                onClose={() => setDetail(null)}
                title="Tindak lanjut alert"
                footer={
                    <div className="flex w-full flex-col gap-2">
                        {detail?.status !== 'in_progress' && detail?.status !== 'resolved' ? (
                            <Button variant="info" className="w-full" onClick={() => update('in_progress')} disabled={busy}>
                                Tandai ditangani
                            </Button>
                        ) : null}
                        {detail?.status !== 'resolved' ? (
                            <Button variant="success" className="w-full" onClick={() => update('resolved')} disabled={busy}>
                                Selesaikan
                            </Button>
                        ) : null}
                        <Button variant="outline" className="w-full" onClick={() => setDetail(null)}>
                            Tutup
                        </Button>
                    </div>
                }
            >
                {detail ? (
                    <div className="space-y-4">
                        <div className="rounded-2xl bg-[#f8fafc] p-3.5">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="truncate text-[13.5px] font-bold">{detail.student.name}</p>
                                    <p className="text-[11.5px] text-[#475569]">{detail.student.class ?? '—'}</p>
                                </div>
                                <Badge tone={severityTone[detail.severity] ?? 'info'}>
                                    {label('severity', detail.severity)}
                                </Badge>
                            </div>
                            <div className="mt-2 space-y-1 text-[12px] text-[#475569]">
                                <p>{detail.trigger_label}</p>
                                <p>Terdeteksi {formatDate(detail.detected_at, true)} · {relative(detail.detected_at)}</p>
                                {detail.context?.negative_days ? (
                                    <p>
                                        {detail.context.negative_days} hari mood negatif · intensitas terakhir {detail.context.last_intensity}
                                    </p>
                                ) : null}
                            </div>
                        </div>

                        <Field label="Catatan tindak lanjut" required htmlFor="note" hint="Wajib diisi sebelum alert ditutup.">
                            <Textarea id="note" rows={4} value={note} onChange={(event) => setNote(event.target.value)} />
                        </Field>

                        <p className="text-[11px] leading-relaxed text-[#5b6b7f]">
                            Alert adalah penanda untuk pendampingan, bukan diagnosis. Membuka jurnal siswa akan tercatat di audit log.
                        </p>

                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                variant="outline"
                                onClick={() => (window.location.href = `/bk/siswa/${detail.student.id}`)}
                            >
                                Profil siswa
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={() => (window.location.href = `/bk/catatan?student_id=${detail.student.id}`)}
                            >
                                Tulis catatan
                            </Button>
                        </div>
                    </div>
                ) : null}
            </Sheet>
        </AppShell>
    );
}
