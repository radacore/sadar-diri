import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, CardTitle, EmptyState, Field, IconButton, Input, Modal, Select, Skeleton, Textarea, useConfirm, useToast } from '../../Components/UI';
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

export default function Portfolio() {
    const toast = useToast();
    const confirm = useConfirm();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
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
        setModalOpen(true);
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
        setModalOpen(true);
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
            setModalOpen(false);
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

    return (
        <AppShell
            title="Portofolio prestasi"
            subtitle="Catat capaian akademik, non-akademik, lomba, dan soft skill"
            actions={
                <>
                    <Button variant="info" onClick={exportPdf}>Ekspor PDF</Button>
                    <Button variant="primary" onClick={openCreate}>Tambah prestasi</Button>
                </>
            }
        >
            <Card className="p-0 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2 p-4 sm:p-0 sm:pb-4">
                    <CardTitle>Timeline capaian</CardTitle>
                    <select className="sd-input h-9 w-auto px-3 text-[12px]" value={category} onChange={(event) => setCategory(event.target.value)}>
                        <option value="">Semua kategori</option>
                        <option value="academic">Akademik</option>
                        <option value="non_academic">Non-akademik</option>
                        <option value="competition">Lomba</option>
                        <option value="soft_skill">Soft skill</option>
                    </select>
                </div>

                {loading ? <div className="p-4"><Skeleton rows={4} /></div> : items.length === 0 ? (
                    <EmptyState
                        title="Belum ada prestasi"
                        description="Mulai dari capaian kecil yang kamu banggakan."
                        action={<Button variant="primary" onClick={openCreate}>Tambah prestasi</Button>}
                    />
                ) : (
                    <ul className="space-y-3 p-4 sm:p-0">
                        {items.map((item) => (
                            <li key={item.id} className="rounded-[18px] border border-[#e2e8f0] p-4">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div>
                                        <div className="mb-1 flex flex-wrap items-center gap-2">
                                            <Badge tone="info">{label('category', item.category)}</Badge>
                                            {item.level ? <Badge tone="neutral">{label('level', item.level)}</Badge> : null}
                                            <Badge tone={item.verification_status === 'verified' ? 'success' : item.verification_status === 'rejected' ? 'danger' : 'warning'}>
                                                {label('verification', item.verification_status)}
                                            </Badge>
                                        </div>
                                        <p className="text-[14px] font-bold">{item.title}</p>
                                        <p className="text-[12px] text-[#475569]">
                                            {item.organizer || '—'} · {formatDate(item.achieved_at)} {item.rank ? `· ${item.rank}` : ''}
                                        </p>
                                        {item.description ? <p className="mt-1 text-[12px] text-[#475569]">{item.description}</p> : null}
                                        {item.rejection_reason ? <p className="mt-1 text-[11px] text-[#b42318]">Alasan: {item.rejection_reason}</p> : null}
                                    </div>
                                    <div className="flex gap-1">
                                        <IconButton icon="edit" label={`Ubah ${item.title}`} variant="primary" onClick={() => openEdit(item)} />
                                        <IconButton icon="trash" label={`Hapus ${item.title}`} variant="danger" onClick={() => remove(item)} />
                                    </div>
                                </div>

                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                    {item.attachments?.map((attachment) => (
                                        <a
                                            key={attachment.id}
                                            href={attachment.url}
                                            className="rounded-full bg-[#f1f5f9] px-3 py-1.5 text-[11px] font-medium text-[#1e293b] hover:bg-[#e2e8f0]"
                                        >
                                            {attachment.original_name}
                                        </a>
                                    ))}
                                    <label className="cursor-pointer rounded-full border border-dashed border-[#cbd5e1] px-3 py-1.5 text-[11px] font-semibold text-[#475569] hover:border-[#3f51b5] hover:text-[#3f51b5]">
                                        + Unggah bukti
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
                                    <span className="text-[11px] text-[#5b6b7f]">JPG/PNG/PDF · maks 5 MB · maks 5 berkas</span>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            <Modal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                title={editing ? 'Ubah prestasi' : 'Tambah prestasi'}
                footer={
                    <>
                        <Button variant="outline" onClick={() => setModalOpen(false)}>Batal</Button>
                        <Button type="submit" variant="primary" form="achievement-form" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</Button>
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
                    <div className="grid grid-cols-2 gap-3">
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
            </Modal>
        </AppShell>
    );
}
