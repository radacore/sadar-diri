import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, CardTitle, Field, Input, Modal, Select, Skeleton, Textarea, useConfirm, useToast } from '../../Components/UI';
import AppShell from '../../Layouts/AppShell';
import { api } from '../../lib/api';
import { formatDate, label } from '../../lib/format';

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

    return (
        <AppShell
            title="Refleksi terbimbing"
            subtitle="Buat sesi, pantau pengisian, dan beri umpan balik"
            actions={<Button onClick={() => setModalOpen(true)}>Buat sesi</Button>}
        >
            {loading ? <Skeleton rows={4} /> : sessions.length === 0 ? (
                <Card>
                    <p className="py-8 text-center text-[13px] text-[#475569]">Belum ada sesi refleksi terbimbing.</p>
                </Card>
            ) : (
                <div className="space-y-3">
                    {sessions.map((session) => (
                        <Card key={session.id} className="p-4 sm:p-5">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <div className="mb-1 flex flex-wrap items-center gap-2">
                                        <Badge tone={session.status === 'completed' ? 'success' : 'warning'}>{session.status}</Badge>
                                        <span className="text-[11px] text-[#475569]">Tenggat {formatDate(session.due_at, true)}</span>
                                    </div>
                                    <p className="text-[14px] font-bold">{session.topic}</p>
                                    <p className="text-[12px] text-[#475569]">
                                        {session.target.type === 'class' ? `Kelas ${session.target.name}` : session.target.name} · {session.submitted_count}/{session.target_count} terisi
                                    </p>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => openDetail(session)}>Lihat detail</Button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            <Modal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                title="Buat sesi refleksi terbimbing"
                wide
                footer={
                    <>
                        <Button variant="outline" onClick={() => setModalOpen(false)}>Batal</Button>
                        <Button type="submit" form="session-form" disabled={busy}>{busy ? 'Menyimpan…' : 'Buat sesi'}</Button>
                    </>
                }
            >
                <form id="session-form" onSubmit={submit} className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
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
                    </div>
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
            </Modal>

            <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title={detail?.topic ?? 'Detail sesi'} wide>
                {detail ? (
                    <div className="space-y-3">
                        <p className="text-[12px] text-[#475569]">{detail.instructions}</p>
                        <ul className="space-y-2">
                            {detail.students.map((student) => (
                                <li key={student.id} className="rounded-xl border border-[#e2e8f0] p-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div>
                                            <p className="text-[13px] font-semibold">{student.name}</p>
                                            <p className="text-[11px] text-[#475569]">
                                                {student.status === 'submitted' ? `Terkirim ${formatDate(student.submitted_at, true)}` : student.status === 'not_attended' ? 'Tidak mengisi' : 'Menunggu'}
                                            </p>
                                        </div>
                                        {student.reflection_id ? (
                                            <Button
                                                variant="outline"
                                                onClick={() => setFeedback({ reflectionId: student.reflection_id, content: '' })}
                                            >
                                                Beri umpan balik
                                            </Button>
                                        ) : null}
                                    </div>
                                </li>
                            ))}
                        </ul>

                        {feedback.reflectionId ? (
                            <div className="rounded-xl bg-[#f1f5f9] p-3">
                                <Field label="Umpan balik" required htmlFor="feedback">
                                    <Textarea id="feedback" rows={3} value={feedback.content} onChange={(event) => setFeedback({ ...feedback, content: event.target.value })} />
                                </Field>
                                <div className="mt-2 flex justify-end">
                                    <Button onClick={sendFeedback}>Kirim umpan balik</Button>
                                </div>
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </Modal>
        </AppShell>
    );
}
