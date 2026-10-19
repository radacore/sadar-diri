import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, EmptyState, IconButton, Skeleton, useConfirm, useToast } from '../../Components/UI';
import AppShell from '../../Layouts/AppShell';
import { api } from '../../lib/api';
import { formatDate, label } from '../../lib/format';

export default function Verification() {
    const toast = useToast();
    const confirm = useConfirm();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            const response = await api.get('/api/counselor/achievements/pending');
            setItems(response.data ?? []);
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        load();
    }, [load]);

    const decide = async (item, status) => {
        const verifying = status === 'verified';
        const decision = await confirm({
            title: verifying ? 'Verifikasi prestasi?' : 'Tolak prestasi?',
            description: verifying
                ? 'Prestasi akan dicatat sebagai capaian terverifikasi pada profil siswa.'
                : 'Prestasi ditolak dan alasan penolakan akan terlihat oleh siswa.',
            details: [
                { label: 'Prestasi', value: item.title },
                { label: 'Siswa', value: item.student.name },
            ],
            confirmLabel: verifying ? 'Verifikasi' : 'Tolak prestasi',
            tone: verifying ? 'success' : 'danger',
            icon: verifying ? 'check' : 'close',
            requireReason: verifying ? false : 'Alasan penolakan',
        });
        if (!decision) return;

        setBusy(true);
        try {
            await api.post(`/api/counselor/achievements/${item.id}/verify`, {
                status,
                rejection_reason: verifying ? null : decision.reason,
            });
            toast.push(verifying ? 'Prestasi diverifikasi.' : 'Prestasi ditolak.');
            await load();
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <AppShell title="Verifikasi prestasi" subtitle="Periksa bukti sebelum menyetujui capaian siswa">
            {loading ? <Skeleton rows={4} /> : items.length === 0 ? (
                <Card><EmptyState title="Tidak ada antrean" description="Semua prestasi siswa binaan sudah ditinjau." /></Card>
            ) : (
                <div className="space-y-3">
                    {items.map((item) => (
                        <Card key={item.id} className="p-4 sm:p-5">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <div className="mb-1 flex flex-wrap items-center gap-2">
                                        <Badge tone="info">{label('category', item.category)}</Badge>
                                        {item.level ? <Badge tone="neutral">{label('level', item.level)}</Badge> : null}
                                    </div>
                                    <p className="text-[14px] font-bold">{item.title}</p>
                                    <p className="text-[12px] text-[#475569]">{item.student.name} · {formatDate(item.achieved_at)}</p>
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {item.attachments.length === 0 ? (
                                            <span className="text-[11px] text-[#b45309]">Belum ada bukti terlampir</span>
                                        ) : item.attachments.map((attachment) => (
                                            <a key={attachment.id} href={attachment.url} className="rounded-full bg-[#f1f5f9] px-3 py-1 text-[11px] hover:bg-[#e2e8f0]">
                                                {attachment.original_name}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <IconButton icon="close" label={`Tolak ${item.title}`} variant="danger" onClick={() => decide(item, 'rejected')} disabled={busy} />
                                    <IconButton icon="check" label={`Verifikasi ${item.title}`} variant="success" onClick={() => decide(item, 'verified')} disabled={busy} />
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </AppShell>
    );
}
