import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, CardTitle, EmptyState, Field, Modal, Skeleton, Textarea, useConfirm, useToast } from '../../Components/UI';
import AppShell from '../../Layouts/AppShell';
import { api } from '../../lib/api';
import { formatDate, label, weekStart } from '../../lib/format';

export default function Reflection() {
    const toast = useToast();
    const confirm = useConfirm();
    const [reflections, setReflections] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ positive_experience: '', negative_experience: '' });
    const [currentWeek, setCurrentWeek] = useState(weekStart());
    const [activeSession, setActiveSession] = useState(null);
    const [answers, setAnswers] = useState([]);
    const [detail, setDetail] = useState(null);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            const [list, sessionList] = await Promise.all([
                api.get('/api/student/reflections'),
                api.get('/api/student/reflection-sessions'),
            ]);
            setReflections(list.data ?? []);
            setSessions(sessionList.data ?? []);

            const existing = (list.data ?? []).find((item) => item.type === 'self' && item.week_start === currentWeek);
            if (existing) {
                const detailResponse = await api.get(`/api/student/reflections/${existing.id}`);
                setForm({
                    positive_experience: detailResponse.data.positive_experience ?? '',
                    negative_experience: detailResponse.data.negative_experience ?? '',
                });
                setDetail(detailResponse.data);
            }
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [currentWeek, toast]);

    useEffect(() => {
        load();
    }, [load]);

    const submitSelf = async (event) => {
        event.preventDefault();
        const decision = await confirm({
            title: 'Simpan refleksi?',
            description: 'Refleksi mandiri pekan ini akan disimpan.',
            confirmLabel: 'Simpan refleksi',
            tone: 'primary',
            icon: 'file',
        });
        if (!decision) return;
        setBusy(true);

        try {
            const existing = reflections.find((item) => item.type === 'self' && item.week_start === currentWeek);

            if (existing) {
                await api.put(`/api/student/reflections/${existing.id}`, { ...form, status: 'submitted' });
            } else {
                await api.post('/api/student/reflections', { ...form, week_start: currentWeek, status: 'submitted' });
            }

            toast.push('Refleksi tersimpan.');
            await load();
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setBusy(false);
        }
    };

    const openSession = (session) => {
        setActiveSession(session);
        setAnswers((session.questions ?? []).map((question) => ({ question, answer: '' })));
    };

    const submitSession = async (event) => {
        event.preventDefault();
        const decision = await confirm({
            title: 'Kirim refleksi?',
            description: 'Refleksi terbimbing tidak dapat diubah setelah dikirim.',
            confirmLabel: 'Kirim refleksi',
            tone: 'primary',
            icon: 'send',
        });
        if (!decision) return;
        setBusy(true);

        try {
            await api.post(`/api/student/reflection-sessions/${activeSession.id}/submit`, { answers });
            toast.push('Refleksi terkirim.');
            setActiveSession(null);
            await load();
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <AppShell title="Ruang refleksi" subtitle="Refleksi mandiri dan pendampingan Guru BK">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
                <Card className="lg:col-span-7">
                    <CardTitle action={<Badge tone="info">Pekan {formatDate(currentWeek)}</Badge>}>
                        Refleksi mandiri
                    </CardTitle>
                    {loading ? <Skeleton rows={4} /> : (
                        <form onSubmit={submitSelf} className="space-y-3">
                            <Field label="Hal paling positif dan berkesan pekan ini" required htmlFor="positive">
                                <Textarea id="positive" rows={3} value={form.positive_experience} onChange={(event) => setForm({ ...form, positive_experience: event.target.value })} required />
                            </Field>
                            <Field label="Hal paling negatif dan menguras emosi pekan ini" required htmlFor="negative">
                                <Textarea id="negative" rows={3} value={form.negative_experience} onChange={(event) => setForm({ ...form, negative_experience: event.target.value })} required />
                            </Field>
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-[11px] text-[#5b6b7f]">Satu entri per pekan. Dapat diperbarui hingga pekan berakhir.</p>
                                <Button type="submit" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan refleksi'}</Button>
                            </div>
                        </form>
                    )}

                    {detail?.feedback ? (
                        <div className="mt-4 rounded-[18px] bg-[#f8fafc] p-4">
                            <p className="mb-1 text-[12px] font-semibold">Umpan balik {detail.feedback.counselor_name}</p>
                            <p className="text-[13px] text-[#475569]">{detail.feedback.content}</p>
                            <p className="mt-1 text-[11px] text-[#5b6b7f]">{formatDate(detail.feedback.created_at, true)}</p>
                        </div>
                    ) : null}
                </Card>

                <div className="space-y-4 lg:col-span-5">
                    <Card>
                        <CardTitle>Refleksi terbimbing</CardTitle>
                        {sessions.length === 0 ? (
                            <EmptyState title="Belum ada sesi" description="Guru BK belum menugaskan refleksi terbimbing." />
                        ) : (
                            <ul className="space-y-2">
                                {sessions.map((session) => (
                                    <li key={session.id} className="rounded-[16px] border border-[#e2e8f0] p-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <p className="text-[13px] font-semibold">{session.topic}</p>
                                                <p className="text-[11px] text-[#475569]">Tenggat {formatDate(session.due_at, true)}</p>
                                            </div>
                                            <Badge tone={session.submitted ? 'success' : session.status === 'completed' ? 'neutral' : 'warning'}>
                                                {session.submitted ? 'Terkirim' : session.status === 'completed' ? 'Selesai' : 'Menunggu'}
                                            </Badge>
                                        </div>
                                        {session.instructions ? <p className="mt-1 text-[12px] text-[#475569]">{session.instructions}</p> : null}
                                        {!session.submitted && new Date(session.due_at) > new Date() ? (
                                            <Button variant="outline" className="mt-2" onClick={() => openSession(session)}>Isi refleksi</Button>
                                        ) : null}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>

                    <Card>
                        <CardTitle>Riwayat refleksi</CardTitle>
                        {loading ? <Skeleton rows={3} /> : reflections.length === 0 ? (
                            <p className="text-[12px] text-[#475569]">Belum ada refleksi.</p>
                        ) : (
                            <ul className="space-y-2">
                                {reflections.slice(0, 6).map((item) => (
                                    <li key={item.id} className="flex items-center justify-between gap-2 border-b border-[#e2e8f0] pb-2 last:border-0">
                                        <div>
                                            <p className="text-[12px] font-semibold">{label('reflection', item.type)}</p>
                                            <p className="text-[11px] text-[#475569]">{item.week_start ? formatDate(item.week_start) : formatDate(item.submitted_at)}</p>
                                        </div>
                                        <Badge tone={item.has_feedback ? 'success' : 'neutral'}>
                                            {item.has_feedback ? 'Ada umpan balik' : label('reflectionStatus', item.status)}
                                        </Badge>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>
                </div>
            </div>

            <Modal
                open={Boolean(activeSession)}
                onClose={() => setActiveSession(null)}
                title={activeSession?.topic ?? 'Refleksi terbimbing'}
                wide
                footer={
                    <>
                        <Button variant="outline" onClick={() => setActiveSession(null)}>Batal</Button>
                        <Button variant="success" type="submit" form="guided-form" disabled={busy}>{busy ? 'Mengirim…' : 'Kirim refleksi'}</Button>
                    </>
                }
            >
                <form id="guided-form" onSubmit={submitSession} className="space-y-3">
                    {activeSession?.instructions ? <p className="text-[12px] text-[#475569]">{activeSession.instructions}</p> : null}
                    {answers.map((item, index) => (
                        <Field key={index} label={item.question} required>
                            <Textarea
                                rows={3}
                                value={item.answer}
                                onChange={(event) => {
                                    const next = [...answers];
                                    next[index] = { ...next[index], answer: event.target.value };
                                    setAnswers(next);
                                }}
                                required
                            />
                        </Field>
                    ))}
                </form>
            </Modal>
        </AppShell>
    );
}
