import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, CardTitle, EmptyState, Field, IconButton, Input, Modal, Select, Skeleton, Textarea, useConfirm, useToast } from '../../Components/UI';
import AppShell from '../../Layouts/AppShell';
import { api } from '../../lib/api';
import { formatDate, label } from '../../lib/format';

export default function Content() {
    const toast = useToast();
    const confirm = useConfirm();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [busy, setBusy] = useState(false);
    const [form, setForm] = useState({ type: 'abc_prompt', title: '', slug: '', body: '' });

    const load = useCallback(async () => {
        try {
            const response = await api.get('/api/admin/content');
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

    const openCreate = () => {
        setEditing(null);
        setForm({ type: 'abc_prompt', title: '', slug: '', body: '' });
        setOpen(true);
    };

    const openEdit = (item) => {
        setEditing(item);
        setForm({ type: item.type, title: item.title, slug: item.slug ?? '', body: item.body });
        setOpen(true);
    };

    const submit = async (event) => {
        event.preventDefault();

        const decision = await confirm({
            title: editing ? 'Simpan perubahan konten?' : 'Simpan konten baru?',
            description: editing ? 'Perubahan akan disimpan sebagai versi baru.' : 'Konten akan disimpan sebagai draf.',
            details: [{ label: 'Judul', value: form.title }],
            confirmLabel: 'Simpan',
            tone: 'primary',
            icon: 'file',
        });
        if (!decision) return;

        setBusy(true);

        try {
            if (editing) {
                await api.put(`/api/admin/content/${editing.id}`, form);
                toast.push('Konten diperbarui sebagai versi baru.');
            } else {
                await api.post('/api/admin/content', form);
                toast.push('Konten dibuat sebagai draf.');
            }
            setOpen(false);
            await load();
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setBusy(false);
        }
    };

    const publish = async (item) => {
        const decision = await confirm({
            title: 'Terbitkan konten?',
            description: `"${item.title}" akan tampil untuk pengguna.`,
            confirmLabel: 'Terbitkan',
            tone: 'success',
            icon: 'check',
        });
        if (!decision) return;

        try {
            await api.post(`/api/admin/content/${item.id}/publish`);
            toast.push('Konten diterbitkan.');
            await load();
        } catch (error) {
            toast.push(error.message, 'error');
        }
    };

    const rollback = async (item) => {
        const decision = await confirm({
            title: `Rollback "${item.title}"?`,
            description: `Versi saat ini (v${item.version}) akan digantikan oleh versi yang dipilih.`,
            details: [{ label: 'Judul', value: item.title }],
            confirmLabel: 'Rollback',
            tone: 'warning',
            icon: 'alert',
            requireReason: 'Versi tujuan',
            reasonPlaceholder: `Contoh: ${item.version - 1}`,
            reasonHint: 'Isi nomor versi yang ingin dipulihkan.',
            minReasonLength: 1,
        });
        if (!decision) return;

        try {
            await api.post(`/api/admin/content/${item.id}/rollback`, { version: Number(decision.reason) });
            toast.push('Konten dikembalikan ke versi sebelumnya.');
            await load();
        } catch (error) {
            toast.push(error.message, 'error');
        }
    };

    return (
        <AppShell title="Manajemen konten" subtitle="Prompt, pertanyaan refleksi, kategori emosi, dan artikel tips" actions={<Button variant="primary" onClick={openCreate}>Tambah konten</Button>}>
            <Card className="p-0 sm:p-6">
                {loading ? <div className="p-4"><Skeleton rows={5} /></div> : items.length === 0 ? (
                    <EmptyState title="Belum ada konten" description="Tambahkan prompt atau pertanyaan refleksi." action={<Button variant="primary" onClick={openCreate}>Tambah konten</Button>} />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="sd-table">
                            <thead><tr><th>Judul</th><th>Tipe</th><th>Versi</th><th>Status</th><th>Terbit</th><th>Aksi</th></tr></thead>
                            <tbody>
                                {items.map((item) => (
                                    <tr key={item.id}>
                                        <td className="font-semibold">{item.title}</td>
                                        <td>{label('content', item.type)}</td>
                                        <td className="tabular">v{item.version}</td>
                                        <td><Badge tone={item.status === 'published' ? 'success' : 'warning'}>{item.status}</Badge></td>
                                        <td className="text-[11px] text-[#475569]">{item.published_at ? formatDate(item.published_at) : '—'}</td>
                                        <td>
                                            <div className="flex items-center justify-end gap-1.5">
                                                <IconButton icon="edit" label={`Ubah ${item.title}`} variant="primary" onClick={() => openEdit(item)} />
                                                {item.status !== 'published' ? (
                                                    <IconButton icon="check" label={`Terbitkan ${item.title}`} variant="success" onClick={() => publish(item)} />
                                                ) : null}
                                                {item.version > 1 ? (
                                                    <IconButton icon="clock" label={`Rollback ${item.title}`} variant="warning" onClick={() => rollback(item)} />
                                                ) : null}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            <Modal
                open={open}
                onClose={() => setOpen(false)}
                title={editing ? 'Ubah konten' : 'Tambah konten'}
                wide
                footer={
                    <>
                        <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
                        <Button variant="primary" type="submit" form="content-form" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</Button>
                    </>
                }
            >
                <form id="content-form" onSubmit={submit} className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Tipe" required htmlFor="type">
                            <Select id="type" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
                                <option value="abc_prompt">Prompt curhat ABC</option>
                                <option value="reflection_question">Pertanyaan refleksi</option>
                                <option value="emotion_category">Kategori emosi</option>
                                <option value="tip_article">Artikel tips</option>
                            </Select>
                        </Field>
                        <Field label="Slug" required htmlFor="slug">
                            <Input id="slug" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} required />
                        </Field>
                    </div>
                    <Field label="Judul" required htmlFor="title">
                        <Input id="title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
                    </Field>
                    <Field label="Isi" required htmlFor="body">
                        <Textarea id="body" rows={6} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} required />
                    </Field>
                </form>
            </Modal>
        </AppShell>
    );
}
