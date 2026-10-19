import { useCallback, useEffect, useState } from 'react';
import {
    Badge,
    Button,
    Chip,
    EmptyState,
    Field,
    Input,
    ListRow,
    PageSection,
    Select,
    Sheet,
    Skeleton,
    Textarea,
    useConfirm,
    useToast,
} from '../../Components/UI';
import { Icon } from '../../Components/Icons';
import AppShell from '../../Layouts/AppShell';
import { api } from '../../lib/api';
import { formatDate, initials } from '../../lib/format';

export default function Notes() {
    const toast = useToast();
    const confirm = useConfirm();
    const [notes, setNotes] = useState([]);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [query, setQuery] = useState('');
    const [studentFilter, setStudentFilter] = useState('');
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

    const term = query.trim().toLowerCase();
    const visibleNotes = notes.filter((note) => {
        const matchesTerm = !term || `${note.title} ${note.student.name}`.toLowerCase().includes(term);
        const matchesStudent = !studentFilter || String(note.student.id) === studentFilter;

        return matchesTerm && matchesStudent;
    });

    return (
        <AppShell
            title="Catatan konseling"
            subtitle="Catatan privat Guru BK, terpisah dari jurnal siswa"
            actions={<Button className="min-h-[44px]" onClick={() => setOpen(true)}>Tulis catatan</Button>}
        >
            <div className="space-y-4">
                <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[#94a3b8]" aria-hidden="true">
                        <Icon name="search" size={16} />
                    </span>
                    <Input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Cari judul atau nama siswa"
                        className="pl-9"
                        aria-label="Cari catatan"
                    />
                </div>

                {students.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        <Chip active={!studentFilter} onClick={() => setStudentFilter('')}>Semua siswa</Chip>
                        {students.map((student) => (
                            <Chip
                                key={student.id}
                                active={String(student.id) === studentFilter}
                                onClick={() => setStudentFilter(String(student.id))}
                            >
                                {student.name}
                            </Chip>
                        ))}
                    </div>
                ) : null}

                {loading ? <Skeleton rows={5} /> : notes.length === 0 ? (
                    <div className="rounded-[22px] border border-[#e2e8f0] bg-white">
                        <EmptyState
                            title="Belum ada catatan"
                            description="Catatan konseling hanya dapat dibaca Guru BK."
                            action={<Button className="min-h-[44px]" onClick={() => setOpen(true)}>Tulis catatan</Button>}
                        />
                    </div>
                ) : visibleNotes.length === 0 ? (
                    <div className="rounded-[22px] border border-[#e2e8f0] bg-white">
                        <EmptyState
                            title="Tidak ada catatan cocok"
                            description="Ubah kata kunci atau pilih siswa lain."
                            action={
                                <Button
                                    variant="outline"
                                    className="min-h-[44px]"
                                    onClick={() => {
                                        setQuery('');
                                        setStudentFilter('');
                                    }}
                                >
                                    Reset filter
                                </Button>
                            }
                        />
                    </div>
                ) : (
                    <PageSection
                        title="Catatan"
                        action={<span className="text-[11px] font-semibold text-[#64748b]">{visibleNotes.length} catatan</span>}
                    >
                        <div className="grid grid-cols-1 gap-2">
                            {visibleNotes.map((note) => (
                                <ListRow
                                    key={note.id}
                                    leading={
                                        <span className="sd-avatar flex h-10 w-10 items-center justify-center rounded-full text-[12px] font-bold">
                                            {initials(note.student.name)}
                                        </span>
                                    }
                                    title={note.title}
                                    subtitle={`${note.student.name} · ${formatDate(note.occurred_at)}`}
                                    meta={
                                        <>
                                            <Badge tone={note.status === 'open' ? 'warning' : 'success'}>
                                                {note.status === 'open' ? 'Berlangsung' : 'Selesai'}
                                            </Badge>
                                            <Badge tone={note.visible_to_student ? 'info' : 'neutral'}>
                                                {note.visible_to_student ? 'Ringkasan terlihat siswa' : 'Privat'}
                                            </Badge>
                                            {note.is_sensitive ? <Badge tone="danger">Sensitif</Badge> : null}
                                        </>
                                    }
                                />
                            ))}
                        </div>
                    </PageSection>
                )}
            </div>

            <Sheet
                open={open}
                onClose={() => setOpen(false)}
                title="Catatan konseling baru"
                footer={
                    <>
                        <Button variant="outline" className="flex-1 min-h-[44px]" onClick={() => setOpen(false)}>Batal</Button>
                        <Button type="submit" form="counseling-form" className="flex-1 min-h-[44px]" disabled={busy}>
                            {busy ? 'Menyimpan…' : 'Simpan catatan'}
                        </Button>
                    </>
                }
            >
                <form id="counseling-form" onSubmit={submit} className="space-y-3">
                    <Field label="Siswa" required htmlFor="student">
                        <Select
                            id="student"
                            value={form.student_id}
                            onChange={(event) => setForm({ ...form, student_id: event.target.value })}
                            required
                        >
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
                    <label className="flex min-h-[44px] items-center gap-2.5 text-[12px]">
                        <input
                            type="checkbox"
                            checked={form.visible_to_student}
                            onChange={(event) => setForm({ ...form, visible_to_student: event.target.checked })}
                            className="h-5 w-5 accent-[#3f51b5]"
                        />
                        Ringkasan dapat dilihat siswa
                    </label>
                    <label className="flex min-h-[44px] items-center gap-2.5 text-[12px]">
                        <input
                            type="checkbox"
                            checked={form.is_sensitive}
                            onChange={(event) => setForm({ ...form, is_sensitive: event.target.checked })}
                            className="h-5 w-5 accent-[#3f51b5]"
                        />
                        Tandai sensitif (konfirmasi tambahan saat dibuka)
                    </label>
                </form>
            </Sheet>
        </AppShell>
    );
}
