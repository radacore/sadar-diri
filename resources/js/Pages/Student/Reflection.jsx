import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../../Components/Icons';
import { Badge, Button, Card, CardTitle, Chip, EmptyState, Field, ListRow, PageSection, Sheet, Skeleton, Textarea, useConfirm, useToast } from '../../Components/UI';
import AppShell from '../../Layouts/AppShell';
import { api } from '../../lib/api';
import { formatDate, label, weekStart } from '../../lib/format';

const MAX_LENGTH = 5000;

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
            <div className="space-y-5">
                <Card>
                    <CardTitle action={<Badge tone="info">Pekan {formatDate(currentWeek)}</Badge>}>
                        Refleksi & syukur pekan ini
                    </CardTitle>
                    {loading ? <Skeleton rows={4} /> : (
                        <form onSubmit={submitSelf} className="space-y-3">
                            <div>
                                <Field label="Hal yang saya syukuri pekan ini" required htmlFor="positive" hint="Mulai dari hal kecil yang membuat pekan ini terasa berarti.">
                                    <Textarea
                                        id="positive"
                                        rows={4}
                                        maxLength={MAX_LENGTH}
                                        value={form.positive_experience}
                                        onChange={(event) => setForm({ ...form, positive_experience: event.target.value })}
                                        required
                                    />
                                </Field>
                                <p className="mt-1 text-right text-[11px] tabular text-[#64748b]">
                                    {form.positive_experience.length}/{MAX_LENGTH} karakter
                                </p>
                            </div>
                            <div>
                                <Field label="Hal yang paling berat pekan ini" required htmlFor="negative" hint="Tulis apa adanya; tidak ada jawaban yang salah.">
                                    <Textarea
                                        id="negative"
                                        rows={4}
                                        maxLength={MAX_LENGTH}
                                        value={form.negative_experience}
                                        onChange={(event) => setForm({ ...form, negative_experience: event.target.value })}
                                        required
                                    />
                                </Field>
                                <p className="mt-1 text-right text-[11px] tabular text-[#64748b]">
                                    {form.negative_experience.length}/{MAX_LENGTH} karakter
                                </p>
                            </div>
                            <p className="text-[11px] leading-snug text-[#5b6b7f]">Satu entri per pekan. Dapat diperbarui hingga pekan berakhir.</p>
                            <Button type="submit" className="h-11 w-full" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan refleksi'}</Button>
                        </form>
                    )}

                    {detail?.feedback ? (
                        <div className="mt-4 rounded-[18px] bg-[#f8fafc] p-4">
                            <p className="mb-1 text-[12px] font-semibold">Umpan balik {detail.feedback.counselor_name}</p>
                            <p className="text-[13px] leading-relaxed text-[#475569]">{detail.feedback.content}</p>
                            <p className="mt-1 text-[11px] text-[#5b6b7f]">{formatDate(detail.feedback.created_at, true)}</p>
                        </div>
                    ) : null}
                </Card>

                <div>
                    <PageSection title="Refleksi terbimbing">
                        {sessions.length === 0 ? (
                            <EmptyState title="Belum ada sesi" description="Guru BK belum menugaskan refleksi terbimbing." />
                        ) : (
                            <div className="space-y-3">
                                {sessions.map((session) => {
                                    const urgent = new Date(session.due_at).getTime() - Date.now() < 2 * 86400000;

                                    return (
                                        <div key={session.id} className="rounded-[20px] border border-[#e2e8f0] bg-white p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="text-[13.5px] font-semibold leading-snug">{session.topic}</p>
                                                    <p className="mt-0.5 text-[11px] text-[#64748b]">
                                                        {(session.questions ?? []).length} pertanyaan
                                                    </p>
                                                </div>
                                                <span className="shrink-0">
                                                    <Badge tone={session.submitted ? 'success' : session.status === 'completed' ? 'neutral' : 'warning'}>
                                                        {session.submitted ? 'Terkirim' : session.status === 'completed' ? 'Selesai' : 'Belum terkirim'}
                                                    </Badge>
                                                </span>
                                            </div>

                                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                                <Chip tone={urgent ? 'danger' : 'neutral'}>Tenggat {formatDate(session.due_at, true)}</Chip>
                                            </div>

                                            {session.instructions ? <p className="mt-2 text-[12px] leading-relaxed text-[#475569]">{session.instructions}</p> : null}

                                            {!session.submitted && new Date(session.due_at) > new Date() ? (
                                                <Button variant="outline" className="mt-3 h-11 w-full" onClick={() => openSession(session)}>Isi refleksi</Button>
                                            ) : null}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </PageSection>
                </div>

                <div>
                    <PageSection title="Riwayat refleksi">
                        {loading ? <Skeleton rows={3} /> : reflections.length === 0 ? (
                            <p className="text-[12px] text-[#475569]">Belum ada refleksi.</p>
                        ) : (
                            <div className="space-y-2">
                                {reflections.slice(0, 6).map((item) => {
                                    const quote = item.has_feedback && detail?.id === item.id ? detail.feedback?.content : null;

                                    return (
                                        <ListRow
                                            key={item.id}
                                            leading={
                                                <span className={`flex h-10 w-10 items-center justify-center rounded-full ${ item.type === 'self' ? 'bg-[#e8eaf6] text-[#3f51b5]' : 'bg-[#e0f2fe] text-[#0369a1]' }`}>
                                                    <Icon name={item.type === 'self' ? 'book' : 'users'} size={17} />
                                                </span>
                                            }
                                            title={label('reflection', item.type)}
                                            subtitle={item.week_start ? formatDate(item.week_start) : formatDate(item.submitted_at)}
                                            meta={
                                                <>
                                                    <Badge tone={item.has_feedback ? 'success' : 'neutral'}>
                                                        {item.has_feedback ? 'Ada umpan balik' : label('reflectionStatus', item.status)}
                                                    </Badge>
                                                    {quote ? (
                                                        <span className="line-clamp-2 w-full text-[11px] leading-snug text-[#64748b]">“{quote}”</span>
                                                    ) : null}
                                                </>
                                            }
                                        />
                                    );
                                })}
                            </div>
                        )}
                    </PageSection>
                </div>
            </div>

            <Sheet
                open={Boolean(activeSession)}
                onClose={() => setActiveSession(null)}
                title={activeSession?.topic ?? 'Refleksi terbimbing'}
                footer={
                    <>
                        <Button variant="outline" className="h-11 flex-1" onClick={() => setActiveSession(null)}>Batal</Button>
                        <Button variant="success" type="submit" form="guided-form" className="h-11 flex-1" disabled={busy}>{busy ? 'Mengirim…' : 'Kirim refleksi'}</Button>
                    </>
                }
            >
                <form id="guided-form" onSubmit={submitSession} className="space-y-3">
                    {activeSession?.instructions ? <p className="text-[12px] leading-relaxed text-[#475569]">{activeSession.instructions}</p> : null}
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
            </Sheet>
        </AppShell>
    );
}
