import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Skeleton, Textarea, useConfirm, useToast } from '../../Components/UI';
import AppShell from '../../Layouts/AppShell';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/format';

export default function Notes() {
    const toast = useToast();
    const confirm = useConfirm();
    const [notes, setNotes] = useState([]);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [form, setForm] = useState({
        student_id: '',
        title: '',
        summary: '',
        content: '',
        visible_to_student: false,
        is_sensitive: false,
    });

    const load = useCallback(async () => {
        try {
            const [noteList, studentList] = await Promise.all([
                api.get('/api/counselor/counseling-notes'),
                api.get('/api/counselor/students?per_page=100'),
            ]);
            setNotes(noteList.data ?? []);
            setStudents(studentList.data ?? []);
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
            title: 'Simpan catatan konseling?',
            description: 'Catatan ini akan tersimpan sebagai catatan privat Guru BK.',
            details: [
                { label: 'Siswa', value: students.find((item) => String(item.id) === String(form.student_id))?.name ?? '—' },
                { label: 'Judul', value: form.title || '—' },
            ],
            confirmLabel: 'Simpan catatan',
            tone: 'primary',
            icon: 'file',
        });
        if (!decision) return;

        setBusy(true);

        try {
            await api.post('/api/counselor/counseling-notes', {
                ...form,
                student_id: Number(form.student_id),
                occurred_at: new Date().toISOString(),
                status: 'open',
            });
            toast.push('Catatan konseling tersimpan.');
            setOpen(false);
            setForm({ student_id: '', title: '', summary: '', content: '', visible_to_student: false, is_sensitive: false });
            await load();
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <AppShell
            title="Catatan konseling"
            subtitle="Catatan privat Guru BK, terpisah dari jurnal siswa"
            actions={<Button onClick={() => setOpen(true)}>Tulis catatan</Button>}
        >
            <Card className="p-0 sm:p-6">
                {loading ? <div className="p-4"><Skeleton rows={4} /></div> : notes.length === 0 ? (
                    <EmptyState title="Belum ada catatan" description="Catatan konseling hanya dapat dibaca Guru BK." action={<Button onClick={() => setOpen(true)}>Tulis catatan</Button>} />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="sd-table">
                            <thead>
                                <tr><th>Siswa</th><th>Judul</th><th>Tanggal</th><th>Status</th><th>Visibilitas</th></tr>
                            </thead>
                            <tbody>
                                {notes.map((note) => (
                                    <tr key={note.id}>
                                        <td className="font-semibold">{note.student.name}</td>
                                        <td>{note.title}</td>
                                        <td className="tabular whitespace-nowrap">{formatDate(note.occurred_at)}</td>
                                        <td><Badge tone={note.status === 'open' ? 'warning' : 'success'}>{note.status === 'open' ? 'Berlangsung' : 'Selesai'}</Badge></td>
                                        <td>{note.visible_to_student ? <Badge tone="info">Ringkasan terlihat siswa</Badge> : <span className="text-[11px] text-[#475569]">Privat</span>}</td>
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
                title="Catatan konseling baru"
                wide
                footer={
                    <>
                        <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
                        <Button type="submit" form="counseling-form" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan catatan'}</Button>
                    </>
                }
            >
                <form id="counseling-form" onSubmit={submit} className="space-y-3">
                    <Field label="Siswa" required htmlFor="student">
                        <Select id="student" value={form.student_id} onChange={(event) => setForm({ ...form, student_id: event.target.value })} required>
                            <option value="">Pilih siswa</option>
                            {students.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.class?.name}</option>)}
                        </Select>
                    </Field>
                    <Field label="Judul" required htmlFor="title">
                        <Input id="title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
                    </Field>
                    <Field label="Ringkasan untuk siswa" htmlFor="summary">
                        <Textarea id="summary" rows={2} value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} />
                    </Field>
                    <Field label="Isi catatan" required htmlFor="content" hint="Terenkripsi. Hanya Guru BK yang dapat membaca.">
                        <Textarea id="content" rows={5} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} required />
                    </Field>
                    <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 text-[12px]">
                            <input type="checkbox" checked={form.visible_to_student} onChange={(event) => setForm({ ...form, visible_to_student: event.target.checked })} className="h-[18px] w-[18px] accent-[#3f51b5]" />
                            Ringkasan dapat dilihat siswa
                        </label>
                        <label className="flex items-center gap-2 text-[12px]">
                            <input type="checkbox" checked={form.is_sensitive} onChange={(event) => setForm({ ...form, is_sensitive: event.target.checked })} className="h-[18px] w-[18px] accent-[#3f51b5]" />
                            Tandai sensitif (konfirmasi tambahan saat dibuka)
                        </label>
                    </div>
                </form>
            </Modal>
        </AppShell>
    );
}
