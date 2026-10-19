import { useCallback, useEffect, useState } from 'react';
import { Badge, Chip, EmptyState, IconButton, PageSection, Skeleton, useConfirm, useToast } from '../../Components/UI';
import AppShell from '../../Layouts/AppShell';
import { api } from '../../lib/api';
import { formatDate, initials, label } from '../../lib/format';

export default function Verification() {
    const toast = useToast();
    const confirm = useConfirm();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [category, setCategory] = useState('all');

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

    const categories = Array.from(new Set(items.map((item) => item.category).filter(Boolean)));
    const visibleItems = category === 'all' ? items : items.filter((item) => item.category === category);

    return (
        <AppShell title="Verifikasi prestasi" subtitle="Periksa bukti sebelum menyetujui capaian siswa">
            {loading ? <Skeleton rows={4} /> : items.length === 0 ? (
                <div className="rounded-[22px] border border-[#e2e8f0] bg-white">
                    <EmptyState
                        title="Antrean bersih"
                        description="Tidak ada prestasi yang menunggu verifikasi saat ini. Antrean baru akan muncul di sini."
                    />
                </div>
            ) : (
                <div className="space-y-4">
                    {categories.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            <Chip active={category === 'all'} onClick={() => setCategory('all')}>Semua</Chip>
                            {categories.map((value) => (
                                <Chip key={value} active={category === value} onClick={() => setCategory(value)}>
                                    {label('category', value)}
                                </Chip>
                            ))}
                        </div>
                    ) : null}

                    {visibleItems.length === 0 ? (
                        <div className="rounded-[22px] border border-[#e2e8f0] bg-white">
                            <EmptyState
                                title="Tidak ada di kategori ini"
                                description="Pilih kategori lain untuk melihat antrean prestasi."
                            />
                        </div>
                    ) : (
                        <PageSection
                            title="Antrean"
                            action={<span className="text-[11px] font-semibold text-[#64748b]">{visibleItems.length} prestasi</span>}
                        >
                            <div className="grid grid-cols-1 gap-2.5">
                                {visibleItems.map((item) => {
                                    const studentClass = item.student.class?.name;

                                    return (
                                        <article key={item.id} className="rounded-[22px] border border-[#e2e8f0] bg-white p-4">
                                            <div className="flex items-start gap-3">
                                                <span className="sd-avatar flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[12px] font-bold">
                                                    {initials(item.student.name)}
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        <Badge tone="info">{label('category', item.category)}</Badge>
                                                        {item.level ? <Badge tone="neutral">{label('level', item.level)}</Badge> : null}
                                                    </div>
                                                    <h3 className="mt-1.5 break-words text-[14.5px] font-bold leading-snug text-[#1e293b]">{item.title}</h3>
                                                    <p className="mt-0.5 text-[12px] leading-snug text-[#64748b]">
                                                        {item.student.name}
                                                        {studentClass ? ` · ${studentClass}` : ''}
                                                        {' · '}
                                                        {formatDate(item.achieved_at)}
                                                    </p>
                                                    <p className="mt-1 text-[11.5px] leading-relaxed text-[#64748b]">
                                                        {item.description ?? 'Menunggu peninjauan Guru BK.'}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="mt-3 flex flex-wrap gap-1.5">
                                                {item.attachments.length === 0 ? (
                                                    <span className="text-[11px] font-medium text-[#b45309]">Belum ada bukti terlampir</span>
                                                ) : item.attachments.map((attachment) => (
                                                    <a
                                                        key={attachment.id}
                                                        href={attachment.url}
                                                        className="block max-w-full truncate rounded-full bg-[#f1f5f9] px-3 py-1.5 text-[11px] text-[#475569] hover:bg-[#e2e8f0]"
                                                    >
                                                        {attachment.original_name}
                                                    </a>
                                                ))}
                                            </div>

                                            <div className="mt-3 flex items-center justify-end gap-2 border-t border-[#eef2f7] pt-3">
                                                <IconButton
                                                    icon="close"
                                                    label={`Tolak ${item.title}`}
                                                    variant="danger"
                                                    size={44}
                                                    onClick={() => decide(item, 'rejected')}
                                                    disabled={busy}
                                                />
                                                <IconButton
                                                    icon="check"
                                                    label={`Verifikasi ${item.title}`}
                                                    variant="success"
                                                    size={44}
                                                    onClick={() => decide(item, 'verified')}
                                                    disabled={busy}
                                                />
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        </PageSection>
                    )}
                </div>
            )}
        </AppShell>
    );
}
