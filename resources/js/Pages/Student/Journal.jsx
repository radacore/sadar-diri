import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Button, Card, CardTitle, EmptyState, Field, Input, Skeleton, Textarea, useConfirm, useToast } from '../../Components/UI';
import AppShell from '../../Layouts/AppShell';
import { api } from '../../lib/api';
import { formatDate, label } from '../../lib/format';

const TABS = [
    { id: 'abc', label: 'Curhat ABC' },
    { id: 'grateful', label: 'Grateful journal' },
    { id: 'history', label: 'Riwayat' },
];

export default function Journal() {
    const toast = useToast();
    const confirm = useConfirm();
    const [tab, setTab] = useState('abc');
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState(null);
    const [summary, setSummary] = useState(null);
    const [filter, setFilter] = useState('');

    const [abc, setAbc] = useState({ activating_event: '', belief: '', consequence: '' });
    const [grateful, setGrateful] = useState({ gratitude_text: '', happiness_text: '' });
    const draftId = useRef(null);
    const saveTimer = useRef(null);

    const load = useCallback(async () => {
        try {
            const [list, moodSummary] = await Promise.all([
                api.get(`/api/student/journals${filter ? `?type=${filter}` : ''}`),
                api.get('/api/student/moods/summary?range=7d'),
            ]);
            setEntries(list.data ?? []);
            setSummary(moodSummary.data);
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [filter, toast]);

    useEffect(() => {
        load();
    }, [load]);

    const saveDraft = useCallback(async (payload) => {
        try {
            if (draftId.current) {
                await api.put(`/api/student/journals/${draftId.current}`, { ...payload, status: 'draft' });
            } else {
                const response = await api.post('/api/student/journals', { ...payload, status: 'draft' });
                draftId.current = response.data.id;
            }
            setLastSaved(new Date());
        } catch {
            /* draf gagal disimpan diam-diam; pengguna tetap dapat menyimpan manual */
        }
    }, []);

    const queueDraft = (payload) => {
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => saveDraft(payload), 1200);
    };

    const submit = async (type) => {
        const payload = type === 'abc'
            ? { type, ...abc }
            : { type, ...grateful };

        if (type === 'abc' && Object.values(abc).some((value) => !value.trim())) {
            toast.push('Lengkapi A, B, dan C sebelum menyimpan.', 'error');
            return;
        }
        if (type === 'grateful' && !grateful.gratitude_text.trim() && !grateful.happiness_text.trim()) {
            toast.push('Isi minimal satu bagian grateful journal.', 'error');
            return;
        }

        const decision = await confirm({
            title: 'Simpan jurnal?',
            description: 'Entri tersimpan terenkripsi dan hanya dapat dibaca oleh Guru BK Anda.',
            details: [{ label: 'Jenis', value: label('journal', type) }],
            confirmLabel: 'Simpan jurnal',
            tone: 'primary',
            icon: 'check',
        });
        if (!decision) return;

        setSaving(true);
        try {
            if (draftId.current) {
                await api.put(`/api/student/journals/${draftId.current}`, { ...payload, status: 'published' });
            } else {
                await api.post('/api/student/journals', { ...payload, status: 'published' });
            }
            draftId.current = null;
            setAbc({ activating_event: '', belief: '', consequence: '' });
            setGrateful({ gratitude_text: '', happiness_text: '' });
            setLastSaved(null);
            toast.push('Jurnal tersimpan.');
            await load();
            setTab('history');
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const openWhatsApp = async () => {
        const decision = await confirm({
            title: 'Buka WhatsApp?',
            description: 'Anda akan diarahkan ke WhatsApp untuk menghubungi Guru BK.',
            confirmLabel: 'Buka WhatsApp',
            tone: 'info',
            icon: 'send',
        });
        if (!decision) return;

        try {
            const response = await api.post('/api/student/whatsapp-link', { context: 'curhat lanjutan' });
            window.open(response.data.url, '_blank', 'noopener');
        } catch (error) {
            toast.push(error.message, 'error');
        }
    };

    return (
        <AppShell
            title="Jurnal emosi"
            subtitle="Catat kejadian, pikiran, dan akibatnya. Draf tersimpan otomatis."
            actions={<Button variant="info" onClick={openWhatsApp}>Curhat ke Guru BK</Button>}
        >
            <div className="mb-4 flex flex-wrap gap-2">
                {TABS.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => setTab(item.id)}
                        aria-pressed={tab === item.id}
                        className={`rounded-full px-4 py-2 text-[12px] font-semibold transition ${
                            tab === item.id ? 'bg-[#3f51b5] text-white' : 'bg-white text-[#1e293b] hover:bg-[#f1f5f9]'
                        }`}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            {tab === 'abc' ? (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
                    <Card className="lg:col-span-8">
                        <CardTitle>Curhat ABC</CardTitle>
                        <div className="space-y-3">
                            <Field label="A — Activating event (kejadian pemicu)" required htmlFor="a">
                                <Textarea
                                    id="a"
                                    rows={3}
                                    value={abc.activating_event}
                                    onChange={(event) => {
                                        const next = { ...abc, activating_event: event.target.value };
                                        setAbc(next);
                                        queueDraft({ type: 'abc', ...next });
                                    }}
                                    placeholder="Apa yang terjadi? Tulis fakta, bukan penilaian."
                                />
                            </Field>
                            <Field label="B — Belief (pikiran/keyakinan)" required htmlFor="b">
                                <Textarea
                                    id="b"
                                    rows={3}
                                    value={abc.belief}
                                    onChange={(event) => {
                                        const next = { ...abc, belief: event.target.value };
                                        setAbc(next);
                                        queueDraft({ type: 'abc', ...next });
                                    }}
                                    placeholder="Apa yang kamu pikirkan saat itu?"
                                />
                            </Field>
                            <Field label="C — Consequence (akibat/perasaan & tindakan)" required htmlFor="c">
                                <Textarea
                                    id="c"
                                    rows={3}
                                    value={abc.consequence}
                                    onChange={(event) => {
                                        const next = { ...abc, consequence: event.target.value };
                                        setAbc(next);
                                        queueDraft({ type: 'abc', ...next });
                                    }}
                                    placeholder="Apa yang kamu rasakan dan lakukan setelahnya?"
                                />
                            </Field>
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-[11px] text-[#5b6b7f]" aria-live="polite">
                                    {lastSaved ? `Draf tersimpan ${lastSaved.toLocaleTimeString('id-ID')}` : 'Draf tersimpan otomatis.'}
                                </p>
                                <Button variant="primary" onClick={() => submit('abc')} disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan jurnal'}</Button>
                            </div>
                        </div>
                    </Card>

                    <div className="space-y-4 lg:col-span-4">
                        <Card>
                            <CardTitle>Mood 7 hari</CardTitle>
                            {summary ? (
                                <>
                                    <div className="flex items-end gap-1.5" aria-hidden="true">
                                        {(summary.points ?? []).map((point) => (
                                            <div key={point.date} className="flex-1">
                                                <div
                                                    className="rounded-t-md"
                                                    style={{
                                                        height: `${Math.max(8, point.intensity * 18)}px`,
                                                        background: point.valence === 'positive' ? '#3f51b5' : '#b45309',
                                                    }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                    <p className="mt-2 text-[11px] text-[#475569]">
                                        {summary.positive_days} hari positif · {summary.negative_days} hari negatif
                                    </p>
                                </>
                            ) : <Skeleton rows={2} />}
                        </Card>
                        <Card>
                            <CardTitle>Ingat</CardTitle>
                            <p className="text-[12px] leading-relaxed text-[#475569]">
                                Jurnal ini bukan penilaian. Guru BK membacanya hanya untuk mendampingi, dan setiap
                                pembukaan tercatat di halaman Privasi.
                            </p>
                        </Card>
                    </div>
                </div>
            ) : null}

            {tab === 'grateful' ? (
                <Card>
                    <CardTitle>Grateful journal</CardTitle>
                    <div className="space-y-3">
                        <Field label="Saya bersyukur untuk…" htmlFor="gratitude">
                            <Textarea
                                id="gratitude"
                                rows={3}
                                value={grateful.gratitude_text}
                                onChange={(event) => {
                                    const next = { ...grateful, gratitude_text: event.target.value };
                                    setGrateful(next);
                                    queueDraft({ type: 'grateful', ...next });
                                }}
                            />
                        </Field>
                        <Field label="Hal yang membuat bahagia hari ini…" htmlFor="happiness">
                            <Textarea
                                id="happiness"
                                rows={3}
                                value={grateful.happiness_text}
                                onChange={(event) => {
                                    const next = { ...grateful, happiness_text: event.target.value };
                                    setGrateful(next);
                                    queueDraft({ type: 'grateful', ...next });
                                }}
                            />
                        </Field>
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-[11px] text-[#5b6b7f]">Minimal satu isian.</p>
                            <Button variant="primary" onClick={() => submit('grateful')} disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan jurnal'}</Button>
                        </div>
                    </div>
                </Card>
            ) : null}

            {tab === 'history' ? (
                <Card className="p-0 sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-2 p-4 sm:p-0 sm:pb-4">
                        <CardTitle>Riwayat jurnal</CardTitle>
                        <div className="flex gap-2">
                            <select className="sd-input h-9 w-auto px-3 text-[12px]" value={filter} onChange={(event) => setFilter(event.target.value)}>
                                <option value="">Semua jenis</option>
                                <option value="abc">Curhat ABC</option>
                                <option value="grateful">Grateful</option>
                            </select>
                        </div>
                    </div>
                    {loading ? <div className="p-4"><Skeleton rows={4} /></div> : entries.length === 0 ? (
                        <EmptyState title="Belum ada entri" description="Mulai dari curhat ABC hari ini." />
                    ) : (
                        <div className="overflow-hidden">
                            <table className="sd-table">
                                <thead>
                                    <tr><th>Tanggal</th><th>Jenis</th><th>Status</th><th>Cuplikan</th></tr>
                                </thead>
                                <tbody>
                                    {entries.map((entry) => (
                                        <tr key={entry.id}>
                                            <td className="tabular whitespace-nowrap">{formatDate(entry.entry_date)}</td>
                                            <td>{label('journal', entry.type)}</td>
                                            <td><Badge tone={entry.status === 'published' ? 'success' : 'warning'}>{label('journalStatus', entry.status)}</Badge></td>
                                            <td className="text-[#475569]">{entry.excerpt}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            ) : null}
        </AppShell>
    );
}
