import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../../Components/Icons';
import {
    Badge,
    Button,
    Chip,
    EmptyState,
    Field,
    IconButton,
    Input,
    Select,
    Sheet,
    Skeleton,
    StatTile,
    Textarea,
    useConfirm,
    useToast,
} from '../../Components/UI';
import AppShell from '../../Layouts/AppShell';
import { api, download } from '../../lib/api';
import { formatDate, label } from '../../lib/format';

const emptyForm = {
    category: 'competition',
    title: '',
    organizer: '',
    level: 'school',
    achieved_at: '',
    rank: '',
    description: '',
};

const CATEGORIES = [
    { value: '', label: 'Semua' },
    { value: 'academic', label: 'Akademik' },
    { value: 'non_academic', label: 'Non-akademik' },
    { value: 'competition', label: 'Lomba' },
    { value: 'soft_skill', label: 'Soft skill' },
];

const DOT_TONE = {
    verified: 'bg-[#10b981]',
    rejected: 'bg-[#ef4444]',
    pending: 'bg-[#f59e0b]',
};

export default function Portfolio() {
    const toast = useToast();
    const confirm = useConfirm();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [editing, setEditing] = useState(null);
    const [busy, setBusy] = useState(false);
    const [category, setCategory] = useState('');

    const load = useCallback(async () => {
        try {
            const response = await api.get(`/api/student/achievements${category ? `?category=${category}` : ''}`);
            setItems(response.data ?? []);
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [category, toast]);

    useEffect(() => {
        load();
    }, [load]);

    const openCreate = () => {
        setEditing(null);
        setForm({ ...emptyForm, achieved_at: new Date().toISOString().slice(0, 10) });
        setSheetOpen(true);
    };

    const openEdit = (item) => {
        setEditing(item);
        setForm({
            category: item.category,
            title: item.title,
            organizer: item.organizer ?? '',
            level: item.level ?? 'school',
            achieved_at: item.achieved_at,
            rank: item.rank ?? '',
            description: item.description ?? '',
        });
        setSheetOpen(true);
    };

    const submit = async (event) => {
        event.preventDefault();

        const decision = await confirm({
            title: editing ? 'Simpan perubahan prestasi?' : 'Tambah prestasi?',
            description: editing
                ? 'Perubahan akan menunggu verifikasi ulang dari Guru BK.'
                : 'Prestasi baru akan menunggu verifikasi dari Guru BK.',
            details: [{ label: 'Prestasi', value: form.title }],
            confirmLabel: 'Simpan',
            tone: 'primary',
            icon: 'check',
        });
        if (!decision) return;

        setBusy(true);

        try {
            if (editing) {
                await api.put(`/api/student/achievements/${editing.id}`, form);
                toast.push('Prestasi diperbarui; menunggu verifikasi ulang.');
            } else {
                await api.post('/api/student/achievements', form);
                toast.push('Prestasi ditambahkan dan menunggu verifikasi.');
            }
            setSheetOpen(false);
            await load();
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setBusy(false);
        }
    };

    const upload = async (item, file) => {
        const decision = await confirm({
            title: 'Unggah bukti prestasi?',
            description: 'Berkas akan diunggah sebagai bukti pendukung prestasi.',
            details: [
                { label: 'Prestasi', value: item.title },
                { label: 'Berkas', value: file.name },
            ],
            confirmLabel: 'Unggah bukti',
            tone: 'primary',
            icon: 'file',
        });
        if (!decision) return;

        const data = new FormData();
        data.append('file', file);

        try {
            await api.upload(`/api/student/achievements/${item.id}/attachments`, data);
            toast.push('Bukti diunggah.');
            await load();
        } catch (error) {
            toast.push(error.message, 'error');
        }
    };

    const remove = async (item) => {
        const decision = await confirm({
            title: 'Hapus prestasi?',
            description: 'Prestasi beserta buktinya akan dihapus permanen.',
            details: [{ label: 'Prestasi', value: item.title }],
            confirmLabel: 'Hapus',
            tone: 'danger',
            icon: 'trash',
        });
        if (!decision) return;

        try {
            await api.delete(`/api/student/achievements/${item.id}`);
            toast.push('Prestasi dihapus.');
            await load();
        } catch (error) {
            toast.push(error.message, 'error');
        }
    };

    const exportPdf = async () => {
        const decision = await confirm({
            title: 'Ekspor portofolio?',
            description: 'Portofolio prestasi terverifikasi akan diunduh sebagai PDF.',
            confirmLabel: 'Ekspor PDF',
            tone: 'info',
            icon: 'file',
        });
        if (!decision) return;

        try {
            await download('/api/student/achievements/export?include_pending=0', 'portofolio.pdf');
        } catch (error) {
            toast.push(error.message, 'error');
        }
    };

    const pending = items.filter((item) => item.verification_status === 'pending').length;

    return (
        <AppShell
            title="Portofolio prestasi"
            subtitle="Capaian akademik, non-akademik, lomba, dan soft skill"
            actions={
                <>
                    <Button className="min-h-11" variant="info" onClick={exportPdf}>Ekspor PDF</Button>
                    <Button className="min-h-11" variant="primary" onClick={openCreate}>Tambah prestasi</Button>
                </>
            }
        >
            <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                    <StatTile label="Total prestasi" value={items.length} hint={category ? 'sesuai filter' : 'semua kategori'} tone="primary" icon="sparkle" />
                    <StatTile label="Menunggu verifikasi" value={pending} hint="diproses Guru BK" tone={pending > 0 ? 'warning' : 'default'} icon="clock" />
                </div>

                <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                        <h2 className="text-[13px] font-bold uppercase tracking-[0.1em] text-[#64748b]">Kategori</h2>
                        <Icon name="chart" size={16} className="text-[#94a3b8]" />
                    </div>
                    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                        {CATEGORIES.map((item) => (
                            <Chip key={item.value || 'all'} active={category === item.value} onClick={() => setCategory(item.value)}>
                                {item.label}
                            </Chip>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <Skeleton rows={4} />
                ) : items.length === 0 ? (
                    <EmptyState
                        title="Belum ada prestasi"
                        description="Mulai dari capaian kecil yang kamu banggakan."
                        action={<Button className="min-h-11" variant="primary" onClick={openCreate}>Tambah prestasi</Button>}
                    />
                ) : (
                    <div className="relative pl-7">
                        <span className="absolute bottom-4 left-[7px] top-3 w-px bg-[#e2e8f0]" aria-hidden="true" />
                        <div className="space-y-4">
                            {items.map((item) => (
                                <div key={item.id} className="relative">
                                    <span
                                        className={`absolute -left-7 top-5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white shadow-sm ${DOT_TONE[item.verification_status] ?? DOT_TONE.pending}`}
                                        aria-hidden="true"
                                    >
                                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                                    </span>

                                    <article className="rounded-[20px] border border-[#e2e8f0] bg-white p-4">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                                                    <Badge tone="info">{label('category', item.category)}</Badge>
                                                    {item.level ? <Badge tone="neutral">{label('level', item.level)}</Badge> : null}
                                                    <Badge tone={item.verification_status === 'verified' ? 'success' : item.verification_status === 'rejected' ? 'danger' : 'warning'}>
                                                        {label('verification', item.verification_status)}
                                                    </Badge>
                                                </div>
                                                <h3 className="text-[14px] font-bold leading-snug">{item.title}</h3>
                                                <p className="mt-0.5 text-[11.5px] text-[#64748b]">
                                                    {item.organizer || '—'} · {formatDate(item.achieved_at)}
                                                    {item.rank ? ` · ${item.rank}` : ''}
                                                </p>
                                                {item.description ? (
                                                    <p className="mt-2 text-[12px] leading-relaxed text-[#475569]">{item.description}</p>
                                                ) : null}
                                                {item.rejection_reason ? (
                                                    <p className="mt-2 rounded-[12px] bg-[#fef2f2] px-3 py-2 text-[11px] text-[#b42318]">
                                                        Alasan: {item.rejection_reason}
                                                    </p>
                                                ) : null}
                                            </div>
                                            <div className="flex shrink-0 gap-1">
                                                <IconButton icon="edit" label={`Ubah ${item.title}`} variant="primary" size={44} onClick={() => openEdit(item)} />
                                                <IconButton icon="trash" label={`Hapus ${item.title}`} variant="danger" size={44} onClick={() => remove(item)} />
                                            </div>
                                        </div>

                                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#f1f5f9] pt-3">
                                            {item.attachments?.map((attachment) => (
                                                <a
                                                    key={attachment.id}
                                                    href={attachment.url}
                                                    className="inline-flex min-h-11 items-center rounded-full bg-[#f1f5f9] px-3 text-[11px] font-medium text-[#1e293b] hover:bg-[#e2e8f0]"
                                                >
                                                    {attachment.original_name}
                                                </a>
                                            ))}
                                            <label className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-dashed border-[#cbd5e1] px-3 text-[11px] font-semibold text-[#475569] hover:border-[#3f51b5] hover:text-[#3f51b5]">
                                                <Icon name="plus" size={14} className="mr-1" />
                                                Unggah bukti
                                                <input
                                                    type="file"
                                                    accept=".jpg,.jpeg,.png,.pdf"
                                                    className="sr-only"
                                                    onChange={(event) => {
                                                        const file = event.target.files?.[0];
                                                        if (file) upload(item, file);
                                                        event.target.value = '';
                                                    }}
                                                />
                                            </label>
                                        </div>
                                        <p className="mt-1.5 text-[11px] text-[#94a3b8]">JPG/PNG/PDF · maks 5 MB · maks 5 berkas</p>
                                    </article>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <Sheet
                open={sheetOpen}
                onClose={() => setSheetOpen(false)}
                title={editing ? 'Ubah prestasi' : 'Tambah prestasi'}
                footer={
                    <>
                        <Button variant="outline" className="min-h-11 flex-1" onClick={() => setSheetOpen(false)}>Batal</Button>
                        <Button type="submit" variant="primary" form="achievement-form" className="min-h-11 flex-1" disabled={busy}>
                            {busy ? 'Menyimpan…' : 'Simpan'}
                        </Button>
                    </>
                }
            >
                <form id="achievement-form" onSubmit={submit} className="space-y-3">
                    <Field label="Kategori" required htmlFor="category">
                        <Select id="category" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
                            <option value="academic">Akademik</option>
                            <option value="non_academic">Non-akademik</option>
                            <option value="competition">Lomba</option>
                            <option value="soft_skill">Soft skill</option>
                        </Select>
                    </Field>
                    <Field label="Judul prestasi" required htmlFor="title">
                        <Input id="title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
                    </Field>
                    <div className="grid grid-cols-1 gap-3">
                        <Field label="Tingkat" htmlFor="level">
                            <Select id="level" value={form.level} onChange={(event) => setForm({ ...form, level: event.target.value })}>
                                {Object.entries({ school: 'Sekolah', district: 'Kecamatan', city: 'Kota', province: 'Provinsi', national: 'Nasional', international: 'Internasional' }).map(([value, text]) => (
                                    <option key={value} value={value}>{text}</option>
                                ))}
                            </Select>
                        </Field>
                        <Field label="Tanggal" required htmlFor="achieved_at">
                            <Input id="achieved_at" type="date" value={form.achieved_at} onChange={(event) => setForm({ ...form, achieved_at: event.target.value })} required />
                        </Field>
                        <Field label="Penyelenggara" htmlFor="organizer">
                            <Input id="organizer" value={form.organizer} onChange={(event) => setForm({ ...form, organizer: event.target.value })} />
                        </Field>
                        <Field label="Peringkat" htmlFor="rank">
                            <Input id="rank" value={form.rank} onChange={(event) => setForm({ ...form, rank: event.target.value })} placeholder="Juara 1" />
                        </Field>
                    </div>
                    <Field label="Deskripsi" htmlFor="description">
                        <Textarea id="description" rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
                    </Field>
                </form>
            </Sheet>
        </AppShell>
    );
}
