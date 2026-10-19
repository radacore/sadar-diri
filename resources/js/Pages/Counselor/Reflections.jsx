import { useCallback, useEffect, useState } from 'react';
import {
    Badge,
    Button,
    Chip,
    EmptyState,
    Field,
    IconButton,
    Input,
    ListRow,
    PageSection,
    Progress,
    Select,
    Sheet,
    Skeleton,
    Textarea,
    useConfirm,
    useToast,
} from '../../Components/UI';
import AppShell from '../../Layouts/AppShell';
import { api } from '../../lib/api';
import { formatDate, initials, percent } from '../../lib/format';

const statusTone = {
    scheduled: 'info',
    ongoing: 'warning',
    completed: 'success',
    cancelled: 'neutral',
};

const statusLabel = {
    scheduled: 'Terjadwal',
    ongoing: 'Berjalan',
    completed: 'Selesai',
    cancelled: 'Dibatalkan',
};

function isOverdue(session) {
    return Boolean(
        session?.due_at
        && new Date(session.due_at) < new Date()
        && !['completed', 'cancelled'].includes(session.status),
    );
}

export default function Reflections() {
    const toast = useToast();
    const confirm = useConfirm();
    const [sessions, setSessions] = useState([]);
    const [classes, setClasses] = useState([]);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [detail, setDetail] = useState(null);
    const [feedback, setFeedback] = useState({ reflectionId: null, content: '' });
    const [busy, setBusy] = useState(false);
    const [form, setForm] = useState({
        target: 'class',
        class_id: '',
        student_id: '',
        topic: '',
        instructions: '',
        questions: 'Apa pemicu utama perasaanmu pekan ini?\nApa yang bisa kamu kendalikan?',
        due_at: '',
    });

    const load = useCallback(async () => {
        try {
            const [sessionList, dashboard, studentList] = await Promise.all([
                api.get('/api/counselor/reflection-sessions'),
                api.get('/api/counselor/dashboard'),
                api.get('/api/counselor/students?per_page=100'),
            ]);
            setSessions(sessionList.data ?? []);
            setClasses(dashboard.data.classes ?? []);
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

        const targetName = form.target === 'class'
            ? classes.find((item) => String(item.id) === String(form.class_id))?.name
            : students.find((item) => String(item.id) === String(form.student_id))?.name;

        const decision = await confirm({
            title: 'Buat sesi refleksi?',
            description: 'Siswa pada target ini akan menerima notifikasi untuk mengisi refleksi.',
            details: [
                { label: 'Topik', value: form.topic },
                { label: 'Target', value: targetName ?? '—' },
                { label: 'Tenggat', value: formatDate(form.due_at, true) },
            ],
            confirmLabel: 'Buat sesi',
            tone: 'primary',
            icon: 'target',
        });
        if (!decision) return;

        setBusy(true);

        try {
            await api.post('/api/counselor/reflection-sessions', {
                class_id: form.target === 'class' ? Number(form.class_id) : null,
                student_id: form.target === 'student' ? Number(form.student_id) : null,
                topic: form.topic,
                instructions: form.instructions || null,
                questions: form.questions.split('\n').map((item) => item.trim()).filter(Boolean),
                due_at: form.due_at,
            });
            toast.push('Sesi refleksi dibuat dan siswa diberi notifikasi.');
            setModalOpen(false);
            setForm({ ...form, topic: '', instructions: '', due_at: '' });
            await load();
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setBusy(false);
        }
    };

    const openDetail = async (session) => {
        try {
            const response = await api.get(`/api/counselor/reflection-sessions/${session.id}`);
            setDetail(response.data);
        } catch (error) {
            toast.push(error.message, 'error');
        }
    };

    const closeDetail = () => {
        setDetail(null);
        setFeedback({ reflectionId: null, content: '' });
    };

    const sendFeedback = async () => {
        if (!feedback.reflectionId || !feedback.content.trim()) {
            toast.push('Pilih refleksi dan tulis umpan balik.', 'error');
            return;
        }

        const decision = await confirm({
            title: 'Kirim umpan balik?',
            description: 'Siswa akan menerima notifikasi bahwa umpan balik tersedia.',
            confirmLabel: 'Kirim umpan balik',
            tone: 'primary',
            icon: 'send',
        });
        if (!decision) return;

        try {
            await api.post(`/api/counselor/reflections/${feedback.reflectionId}/feedback`, { content: feedback.content });
            toast.push('Umpan balik terkirim.');
            setFeedback({ reflectionId: null, content: '' });
        } catch (error) {
            toast.push(error.message, 'error');
        }
    };

    const detailSubmitted = detail ? detail.students.filter((student) => student.status === 'submitted').length : 0;
    const detailTotal = detail?.students.length ?? 0;

    return (
        <AppShell
            title="Refleksi terbimbing"
            subtitle="Buat sesi, pantau pengisian, dan beri umpan balik"
            actions={<Button className="min-h-[44px]" onClick={() => setModalOpen(true)}>Buat sesi</Button>}
        >
            {loading ? <Skeleton rows={4} /> : sessions.length === 0 ? (
                <div className="rounded-[22px] border border-[#e2e8f0] bg-white">
                    <EmptyState
                        title="Belum ada sesi"
                        description="Buat sesi refleksi terbimbing untuk satu kelas atau satu siswa."
                        action={<Button className="min-h-[44px]" onClick={() => setModalOpen(true)}>Buat sesi</Button>}
                    />
                </div>
            ) : (
                <PageSection
                    title="Sesi refleksi"
                    action={<span className="text-[11px] font-semibold text-[#64748b]">{sessions.length} sesi</span>}
                >
                    <div className="grid grid-cols-1 gap-2.5">
                        {sessions.map((session) => {
                            const overdue = isOverdue(session);
                            const progress = percent(session.submitted_count, session.target_count);

                            return (
                                <article key={session.id} className="rounded-[22px] border border-[#e2e8f0] bg-white p-4">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <Badge tone={statusTone[session.status] ?? 'info'}>
                                            {statusLabel[session.status] ?? session.status}
                                        </Badge>
                                        <Chip tone={overdue ? 'danger' : 'neutral'}>
                                            {overdue
                                                ? `Lewat tenggat · ${formatDate(session.due_at, true)}`
                                                : `Tenggat ${formatDate(session.due_at, true)}`}
                                        </Chip>
                                    </div>
                                    <h3 className="mt-2 break-words text-[15px] font-bold leading-snug text-[#1e293b]">{session.topic}</h3>
                                    <p className="mt-0.5 truncate text-[12px] text-[#64748b]">
                                        {session.target.type === 'class' ? `Kelas ${session.target.name}` : session.target.name}
                                    </p>
                                    <div className="mt-3">
                                        <Progress
                                            value={progress}
                                            label={`${session.submitted_count} dari ${session.target_count} siswa terisi`}
                                        />
                                    </div>
                                    <Button variant="outline" className="mt-3 min-h-[44px] w-full" onClick={() => openDetail(session)}>
                                        Lihat detail
                                    </Button>
                                </article>
                            );
                        })}
                    </div>
                </PageSection>
            )}

            <Sheet
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                title="Buat sesi refleksi terbimbing"
                footer={
                    <>
                        <Button variant="outline" className="flex-1 min-h-[44px]" onClick={() => setModalOpen(false)}>Batal</Button>
                        <Button type="submit" form="session-form" className="flex-1 min-h-[44px]" disabled={busy}>
                            {busy ? 'Menyimpan…' : 'Buat sesi'}
                        </Button>
                    </>
                }
            >
                <form id="session-form" onSubmit={submit} className="space-y-3">
                    <Field label="Target" required htmlFor="target">
                        <Select id="target" value={form.target} onChange={(event) => setForm({ ...form, target: event.target.value })}>
                            <option value="class">Satu kelas</option>
                            <option value="student">Satu siswa</option>
                        </Select>
                    </Field>
                    {form.target === 'class' ? (
                        <Field label="Kelas" required htmlFor="class">
                            <Select id="class" value={form.class_id} onChange={(event) => setForm({ ...form, class_id: event.target.value })} required>
                                <option value="">Pilih kelas</option>
                                {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                            </Select>
                        </Field>
                    ) : (
                        <Field label="Siswa" required htmlFor="student">
                            <Select id="student" value={form.student_id} onChange={(event) => setForm({ ...form, student_id: event.target.value })} required>
                                <option value="">Pilih siswa</option>
                                {students.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.class?.name}</option>)}
                            </Select>
                        </Field>
                    )}
                    <Field label="Topik" required htmlFor="topic">
                        <Input id="topic" value={form.topic} onChange={(event) => setForm({ ...form, topic: event.target.value })} required />
                    </Field>
                    <Field label="Instruksi" htmlFor="instructions">
                        <Textarea id="instructions" rows={2} value={form.instructions} onChange={(event) => setForm({ ...form, instructions: event.target.value })} />
                    </Field>
                    <Field label="Pertanyaan (satu per baris)" required htmlFor="questions">
                        <Textarea id="questions" rows={4} value={form.questions} onChange={(event) => setForm({ ...form, questions: event.target.value })} required />
                    </Field>
                    <Field label="Tenggat" required htmlFor="due_at">
                        <Input id="due_at" type="datetime-local" value={form.due_at} onChange={(event) => setForm({ ...form, due_at: event.target.value })} required />
                    </Field>
                </form>
            </Sheet>

            <Sheet
                open={Boolean(detail)}
                onClose={closeDetail}
                title={detail?.topic ?? 'Detail sesi'}
                footer={<Button variant="outline" className="min-h-[44px] w-full" onClick={closeDetail}>Tutup</Button>}
            >
                {detail ? (
                    <div className="space-y-4">
                        <div className="rounded-2xl bg-[#f5f7ff] p-3.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                                <Badge tone={statusTone[detail.status] ?? 'info'}>
                                    {statusLabel[detail.status] ?? detail.status}
                                </Badge>
                                <Chip tone={isOverdue(detail) ? 'danger' : 'neutral'}>
                                    {isOverdue(detail)
                                        ? `Lewat tenggat · ${formatDate(detail.due_at, true)}`
                                        : `Tenggat ${formatDate(detail.due_at, true)}`}
                                </Chip>
                            </div>
                            {detail.instructions ? (
                                <p className="mt-2 text-[12px] leading-relaxed text-[#475569]">{detail.instructions}</p>
                            ) : null}
                            <div className="mt-3">
                                <Progress
                                    value={percent(detailSubmitted, detailTotal)}
                                    label={`${detailSubmitted} dari ${detailTotal} siswa terisi`}
                                />
                            </div>
                        </div>

                        <PageSection
                            title="Siswa"
                            action={<span className="text-[11px] font-semibold text-[#64748b]">{detailSubmitted}/{detailTotal} terisi</span>}
                        >
                            {detailTotal === 0 ? (
                                <p className="rounded-2xl border border-dashed border-[#e2e8f0] p-4 text-center text-[12px] text-[#64748b]">
                                    Belum ada siswa pada target ini.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {detail.students.map((student) => {
                                        const status = student.status === 'submitted'
                                            ? 'Terkirim'
                                            : student.status === 'not_attended' ? 'Tidak mengisi' : 'Menunggu';
                                        const tone = student.status === 'submitted'
                                            ? 'success'
                                            : student.status === 'not_attended' ? 'danger' : 'warning';
                                        const editing = Boolean(student.reflection_id) && feedback.reflectionId === student.reflection_id;

                                        return (
                                            <div key={student.id} className="space-y-2">
                                                <ListRow
                                                    leading={
                                                        <span className="sd-avatar flex h-10 w-10 items-center justify-center rounded-full text-[12px] font-bold">
                                                            {initials(student.name)}
                                                        </span>
                                                    }
                                                    title={student.name}
                                                    subtitle={
                                                        student.status === 'submitted'
                                                            ? `Terkirim ${formatDate(student.submitted_at, true)}`
                                                            : status
                                                    }
                                                    meta={<Badge tone={tone}>{status}</Badge>}
                                                    trailing={student.reflection_id ? (
                                                        <IconButton
                                                            icon="send"
                                                            label={`Beri umpan balik untuk ${student.name}`}
                                                            variant={editing ? 'primary' : 'outline'}
                                                            size={44}
                                                            onClick={() => setFeedback({ reflectionId: student.reflection_id, content: '' })}
                                                        />
                                                    ) : null}
                                                />
                                                {editing ? (
                                                    <div className="rounded-2xl border border-[#dbe2f2] bg-[#f8faff] p-3">
                                                        <Field label="Umpan balik" required htmlFor={`feedback-${student.id}`}>
                                                            <Textarea
                                                                id={`feedback-${student.id}`}
                                                                rows={3}
                                                                value={feedback.content}
                                                                onChange={(event) => setFeedback({ ...feedback, content: event.target.value })}
                                                            />
                                                        </Field>
                                                        <div className="mt-2 flex gap-2">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="flex-1 min-h-[44px]"
                                                                onClick={() => setFeedback({ reflectionId: null, content: '' })}
                                                            >
                                                                Batal
                                                            </Button>
                                                            <Button size="sm" className="flex-1 min-h-[44px]" onClick={sendFeedback}>
                                                                Kirim umpan balik
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ) : null}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </PageSection>
                    </div>
                ) : null}
            </Sheet>
        </AppShell>
    );
}
