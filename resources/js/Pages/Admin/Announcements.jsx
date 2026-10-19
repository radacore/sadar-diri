import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, CardTitle, EmptyState, Field, Input, Modal, Select, Skeleton, Textarea, useConfirm, useToast } from '../../Components/UI';
import AppShell from '../../Layouts/AppShell';
import { api } from '../../lib/api';
import { formatDate, label } from '../../lib/format';

export default function Announcements() {
    const toast = useToast();
    const confirm = useConfirm();
    const [items, setItems] = useState([]);
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [form, setForm] = useState({ title: '', body: '', audience: 'all', audience_role: '', audience_class_id: '', published_at: '', expires_at: '' });

    const load = useCallback(async () => {
        try {
            const [list, classList] = await Promise.all([
                api.get('/api/admin/announcements'),
                api.get('/api/admin/classes/options'),
            ]);
            setItems(list.data ?? []);
            setClasses(classList.data ?? []);
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        load();
    }, [load]);

    const submit = async (event) => {
        event.preventDefault();

        const decision = await confirm({
            title: 'Simpan pengumuman?',
            description: 'Pengumuman akan diterbitkan sesuai jadwal yang dipilih.',
            details: [
                { label: 'Judul', value: form.title },
                { label: 'Audiens', value: label('audience', form.audience) },
            ],
            confirmLabel: 'Simpan',
            tone: 'primary',
            icon: 'bell',
        });
        if (!decision) return;

        setBusy(true);

        try {
            await api.post('/api/admin/announcements', {
                ...form,
                audience_role: form.audience === 'role' ? form.audience_role : null,
                audience_class_id: form.audience === 'class' ? Number(form.audience_class_id) : null,
                published_at: form.published_at || null,
                expires_at: form.expires_at || null,
            });
            toast.push('Pengumuman disimpan.');
            setOpen(false);
            setForm({ title: '', body: '', audience: 'all', audience_role: '', audience_class_id: '', published_at: '', expires_at: '' });
            await load();
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setBusy(false);
        }
    };

    const archive = async (item) => {
        const decision = await confirm({
            title: 'Arsipkan pengumuman?',
            description: `"${item.title}" tidak akan lagi tampil untuk pengguna.`,
            confirmLabel: 'Arsipkan',
            tone: 'danger',
            icon: 'trash',
        });
        if (!decision) return;

        try {
            await api.delete(`/api/admin/announcements/${item.id}`);
            toast.push('Pengumuman diarsipkan.');
            await load();
        } catch (error) {
            toast.push(error.message, 'error');
        }
    };

    return (
        <AppShell title="Pengumuman" subtitle="Target semua pengguna, peran, atau kelas" actions={<Button variant="primary" onClick={() => setOpen(true)}>Buat pengumuman</Button>}>
            {loading ? <Skeleton rows={4} /> : items.length === 0 ? (
                <Card><EmptyState title="Belum ada pengumuman" description="Buat pengumuman untuk siswa atau Guru BK." action={<Button variant="primary" onClick={() => setOpen(true)}>Buat pengumuman</Button>} /></Card>
            ) : (
                <div className="space-y-3">
                    {items.map((item) => (
                        <Card key={item.id} className="p-4 sm:p-5">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <div className="mb-1 flex flex-wrap items-center gap-2">
                                        <Badge tone={item.status === 'published' ? 'success' : item.status === 'scheduled' ? 'warning' : 'neutral'}>{item.status}</Badge>
                                        <span className="text-[11px] text-[#475569]">
                                            {label('audience', item.audience)}
                                            {item.audience_class ? ` · ${item.audience_class.name}` : ''}
                                            {item.audience_role ? ` · ${label('role', item.audience_role)}` : ''}
                                        </span>
                                    </div>
                                    <p className="text-[14px] font-bold">{item.title}</p>
                                    <p className="text-[12px] text-[#475569]">{item.body}</p>
                                    <p className="mt-1 text-[11px] text-[#5b6b7f]">Terbit {formatDate(item.published_at, true)}</p>
                                </div>
                                {item.status !== 'archived' ? <Button variant="ghostDanger" size="sm" onClick={() => archive(item)}>Arsipkan</Button> : null}
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            <Modal
                open={open}
                onClose={() => setOpen(false)}
                title="Buat pengumuman"
                wide
                footer={
                    <>
                        <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
                        <Button variant="primary" type="submit" form="announcement-form" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</Button>
                    </>
                }
            >
                <form id="announcement-form" onSubmit={submit} className="space-y-3">
                    <Field label="Judul" required htmlFor="title">
                        <Input id="title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
                    </Field>
                    <Field label="Isi" required htmlFor="body">
                        <Textarea id="body" rows={4} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} required />
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Audiens" required htmlFor="audience">
                            <Select id="audience" value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value })}>
                                <option value="all">Semua</option>
                                <option value="role">Peran tertentu</option>
                                <option value="class">Kelas tertentu</option>
                            </Select>
                        </Field>
                        {form.audience === 'role' ? (
                            <Field label="Peran" required htmlFor="role">
                                <Select id="role" value={form.audience_role} onChange={(event) => setForm({ ...form, audience_role: event.target.value })} required>
                                    <option value="">Pilih peran</option>
                                    <option value="student">Siswa</option>
                                    <option value="counselor">Guru BK</option>
                                    <option value="superadmin">Superadmin</option>
                                </Select>
                            </Field>
                        ) : null}
                        {form.audience === 'class' ? (
                            <Field label="Kelas" required htmlFor="class">
                                <Select id="class" value={form.audience_class_id} onChange={(event) => setForm({ ...form, audience_class_id: event.target.value })} required>
                                    <option value="">Pilih kelas</option>
                                    {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                                </Select>
                            </Field>
                        ) : null}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Terbit" htmlFor="published" hint="Kosongkan untuk terbit sekarang.">
                            <Input id="published" type="datetime-local" value={form.published_at} onChange={(event) => setForm({ ...form, published_at: event.target.value })} />
                        </Field>
                        <Field label="Berakhir" htmlFor="expires">
                            <Input id="expires" type="datetime-local" value={form.expires_at} onChange={(event) => setForm({ ...form, expires_at: event.target.value })} />
                        </Field>
                    </div>
                </form>
            </Modal>
        </AppShell>
    );
}
