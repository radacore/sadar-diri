import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../../Components/Icons';
import {
    Badge,
    Button,
    Chip,
    EmptyState,
    Field,
    ListRow,
    MoodPicker,
    Segmented,
    Skeleton,
    Textarea,
    useConfirm,
    useToast,
} from '../../Components/UI';
import AppShell from '../../Layouts/AppShell';
import { api } from '../../lib/api';
import { formatDate, label } from '../../lib/format';

const TABS = [
    { id: 'mood', label: 'Mood hari ini' },
    { id: 'abc', label: 'Curhat ABC' },
    { id: 'history', label: 'Riwayat' },
];

const FILTERS = [
    { value: '', label: 'Semua' },
    { value: 'abc', label: 'Curhat ABC' },
];

const ABC_STEPS = [
    { key: 'activating_event', letter: 'A', label: 'Kejadian pemicu', placeholder: 'Apa yang terjadi? Tulis fakta, bukan penilaian.' },
    { key: 'belief', letter: 'B', label: 'Pikiran & keyakinan', placeholder: 'Apa yang kamu pikirkan saat itu?' },
    { key: 'consequence', letter: 'C', label: 'Akibat & perasaan', placeholder: 'Apa yang kamu rasakan dan lakukan setelahnya?' },
];
const POSITIVE_TAGS = ['senang', 'tenang', 'bersemangat'];
const NEGATIVE_TAGS = ['sedih', 'marah', 'cemas', 'takut', 'kecewa'];

const tagsForMood = (mood) => (!mood ? [] : mood >= 3 ? POSITIVE_TAGS : NEGATIVE_TAGS);

export default function Journal() {
    const toast = useToast();
    const confirm = useConfirm();
    const [tab, setTab] = useState(() => {
        const initial = new URLSearchParams(window.location.search).get('tab');
        return initial === 'abc' || initial === 'history' ? initial : 'mood';
    });
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState(null);
    const [filter, setFilter] = useState('');

    const [abc, setAbc] = useState({ activating_event: '', belief: '', consequence: '' });
    const [mood, setMood] = useState(null);
    const [tags, setTags] = useState([]);
    const [note, setNote] = useState('');
    const [tagsTouched, setTagsTouched] = useState(false);
    const [moodSavedAt, setMoodSavedAt] = useState(null);
    const [followUp, setFollowUp] = useState(false);
    const [openEntry, setOpenEntry] = useState(null);
    const [detail, setDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const draftId = useRef(null);
    const saveTimer = useRef(null);

    const load = useCallback(async () => {
        try {
            const list = await api.get(`/api/student/journals${filter ? `?type=${filter}` : ''}`);
            setEntries(list.data ?? []);
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [filter, toast]);

    const loadTodayMood = useCallback(async () => {
        try {
            const response = await api.get('/api/student/dashboard');
            const saved = response.data?.today_mood;
            if (saved) {
                const level = saved.valence === 'positive' ? saved.intensity : (saved.intensity >= 5 ? 1 : 2);
                const allowed = tagsForMood(level);
                setMood(level);
                setTags((saved.emotion_tags ?? []).filter((tag) => allowed.includes(tag)));
                setNote(saved.note ?? '');
            }
        } catch {
            /* biarkan formulir mood kosong; pengguna tetap dapat mengisi manual */
        }
    }, []);

    useEffect(() => {
        if (tab === 'mood') {
            loadTodayMood();
        }
    }, [tab, loadTodayMood]);

    useEffect(() => {
        load();
    }, [load]);
    const handleMoodChange = (value) => {
        setMood(value);
        setTags((current) => {
            const allowed = tagsForMood(value);
            const kept = current.filter((tag) => allowed.includes(tag));
            if (kept.length < current.length && tagsTouched) {
                toast.push('Tag yang tidak sesuai mood dihapus otomatis.');
            }
            return kept;
        });
    };

    const toggleTag = (tag) => {
        setTagsTouched(true);
        setTags((current) => {
            if (current.includes(tag)) return current.filter((item) => item !== tag);
            if (current.length >= 5) {
                toast.push('Maksimal 5 tag emosi.', 'error');
                return current;
            }
            return [...current, tag];
        });
    };

    const saveMood = async () => {
        if (!mood) {
            toast.push('Pilih tingkat mood terlebih dahulu.', 'error');
            return;
        }
        if (tags.length === 0) {
            toast.push('Pilih minimal satu tag emosi.', 'error');
            return;
        }

        const decision = await confirm({
            title: 'Simpan mood hari ini?',
            description: 'Hanya satu entri mood per hari. Entri hari ini akan diperbarui jika sudah ada.',
            tone: 'primary',
            icon: 'check',
        });
        if (!decision) return;

        setSaving(true);

        try {
            const payload = mood >= 3
                ? { valence: 'positive', intensity: mood }
                : { valence: 'negative', intensity: mood === 1 ? 5 : 4 };

            await api.post('/api/student/moods', {
                ...payload,
                emotion_tags: tags,
                note: note.trim() === '' ? null : note.trim(),
            });
            setMoodSavedAt(new Date());
            toast.push('Mood tersimpan.');
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setSaving(false);
        }
    };
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
        const payload = { type, ...abc, follow_up_requested: followUp };

        if (Object.values(abc).some((value) => !value.trim())) {
            toast.push('Lengkapi A, B, dan C sebelum menyimpan.', 'error');
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

            setFollowUp(false);
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
        let target = null;

        try {
            const response = await api.post('/api/student/whatsapp-link', { context: 'curhat lanjutan' });
            target = response.data;
        } catch (error) {
            toast.push(error.message, 'error');
            return;
        }

        const decision = await confirm({
            title: 'Buka WhatsApp?',
            description: 'Anda akan diarahkan ke WhatsApp untuk menghubungi Guru BK kelas Anda.',
            details: [
                { label: 'Tujuan', value: target.counselor_name },
                ...(target.service_hours ? [{ label: 'Jam layanan', value: target.service_hours }] : []),
            ],
            confirmLabel: 'Buka WhatsApp',
            tone: 'info',
            icon: 'send',
        });
        if (!decision) return;

        window.open(target.url, '_blank', 'noopener');
    };

    const toggleEntry = async (entry) => {
        if (openEntry === entry.id) {
            setOpenEntry(null);
            setDetail(null);
            return;
        }

        setOpenEntry(entry.id);
        setDetail(null);
        setDetailLoading(true);

        try {
            const response = await api.get(`/api/student/journals/${entry.id}`);
            setDetail(response.data);
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setDetailLoading(false);
        }
    };

    const updateAbc = (key, value) => {
        const next = { ...abc, [key]: value };
        setAbc(next);
        queueDraft({ type: 'abc', ...next });
    };

    return (
        <AppShell
            title="Jurnal emosi"
            subtitle="Curhat ABC dan mood harianmu."
            actions={<Button className="min-h-11" variant="info" onClick={openWhatsApp}>Curhat ke Guru BK</Button>}
        >
            <div className="space-y-5">
                <Segmented
                    options={TABS.map((item) => ({ value: item.id, label: item.label }))}
                    value={tab}
                    onChange={setTab}
                />

                {tab === 'abc' ? (
                    <div className="space-y-5">
                        <section className="space-y-3">
                            <div>
                                <h2 className="text-[16px] font-bold leading-tight">Curhat ABC</h2>
                                <p className="mt-0.5 text-[12px] text-[#64748b]">
                                    Pisahkan kejadian, pikiran, dan akibatnya.
                                </p>
                            </div>

                            <div className="space-y-3">
                                {ABC_STEPS.map((step) => (
                                    <div key={step.key} className="rounded-[18px] border border-[#e2e8f0] bg-white p-3.5">
                                        <Field label={`${step.letter} — ${step.label}`} required htmlFor={step.key}>
                                            <Textarea
                                                id={step.key}
                                                rows={3}
                                                value={abc[step.key]}
                                                onChange={(event) => updateAbc(step.key, event.target.value)}
                                                placeholder={step.placeholder}
                                            />
                                        </Field>
                                    </div>
                                ))}
                            </div>

                            <label className="flex items-start gap-3 rounded-[18px] border border-[#e2e8f0] bg-[#f8fafc] p-3.5">
                                <input
                                    type="checkbox"
                                    checked={followUp}
                                    onChange={(event) => setFollowUp(event.target.checked)}
                                    className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[#3f51b5]"
                                />
                                <span className="min-w-0">
                                    <span className="block text-[12.5px] font-semibold text-[#1e293b]">Minta Guru BK menindaklanjuti</span>
                                    <span className="mt-0.5 block text-[11px] leading-snug text-[#64748b]">
                                        Opsional. Tanpa centang, Guru BK tetap bisa membaca tetapi tidak dihubungi untuk sesi konseling.
                                    </span>
                                </span>
                            </label>

                            <div className="flex flex-col gap-3">
                                <p className="flex items-center gap-1.5 text-[11px] text-[#64748b]" aria-live="polite">
                                    <Icon name="check" size={13} />
                                    {lastSaved ? `Draf tersimpan ${lastSaved.toLocaleTimeString('id-ID')}` : 'Tersimpan otomatis sebagai draf.'}
                                </p>
                                <Button variant="primary" className="min-h-11 w-full" onClick={() => submit('abc')} disabled={saving}>
                                    {saving ? 'Menyimpan…' : 'Simpan jurnal'}
                                </Button>
                            </div>
                        </section>


                        <div className="flex gap-3 rounded-[18px] bg-[#e8eaf6] p-4">
                            <Icon name="shield" size={18} className="shrink-0 text-[#303f9f]" />
                            <p className="text-[11.5px] leading-relaxed text-[#303f9f]">
                                Jurnal ini bukan penilaian. Guru BK membacanya hanya untuk mendampingi, dan setiap
                                pembukaan tercatat di halaman Privasi.
                            </p>
                        </div>
                    </div>
                ) : null}

                {tab === 'mood' ? (
                    <div className="space-y-5">
                        <section className="space-y-3">
                            <div>
                                <h2 className="text-[16px] font-bold leading-tight">Mood hari ini</h2>
                                <p className="mt-0.5 text-[12px] text-[#64748b]">
                                    Satu entri per hari. Mengisi ulang akan memperbarui catatan hari ini.
                                </p>
                            </div>

                            <div className="rounded-[20px] border border-[#e2e8f0] bg-white p-4">
                                <MoodPicker value={mood} onChange={handleMoodChange} />

                                <div className="mt-4">
                                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">Tag emosi</p>
                                    {mood === null ? (
                                        <p className="text-[11px] text-[#64748b]">Pilih tingkat mood terlebih dahulu untuk melihat tag yang sesuai.</p>
                                    ) : (
                                        <>
                                            <div className="flex flex-wrap gap-2">
                                                {tagsForMood(mood).map((tag) => (
                                                    <Chip key={tag} active={tags.includes(tag)} onClick={() => toggleTag(tag)}>
                                                        {tag}
                                                    </Chip>
                                                ))}
                                            </div>
                                            <p className="mt-2 text-[11px] text-[#64748b]">Pilih tag yang sesuai mood. Wajib diisi minimal 1.</p>
                                        </>
                                    )}
                                </div>

                                <div className="mt-4">
                                    <Field
                                        label="Alasan perasaan (opsional)"
                                        htmlFor="journal-mood-reason"
                                        hint="Boleh dikosongkan. Tulis bila ada hal spesifik yang memengaruhi perasaanmu."
                                    >
                                        <Textarea
                                            id="journal-mood-reason"
                                            value={note}
                                            onChange={(event) => setNote(event.target.value)}
                                            placeholder={tags[0] ? `${tags[0]} karena…` : 'Hari ini saya merasa … karena …'}
                                            rows={3}
                                        />
                                    </Field>
                                </div>
                            </div>

                            <Button variant="success" className="min-h-11 w-full" onClick={saveMood} disabled={saving || !mood || tags.length === 0}>
                                {saving ? 'Menyimpan…' : 'Simpan mood'}
                            </Button>
                            {moodSavedAt ? (
                                <p className="text-center text-[11px] text-[#64748b]">
                                    Tersimpan {moodSavedAt.toLocaleTimeString('id-ID')}
                                </p>
                            ) : null}
                        </section>
                    </div>
                ) : null}
                {tab === 'history' ? (
                    <section className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="text-[16px] font-bold leading-tight">Riwayat jurnal</h2>
                            <Badge tone="neutral">{entries.length} entri</Badge>
                        </div>

                        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                            {FILTERS.map((item) => (
                                <Chip key={item.value || 'all'} active={filter === item.value} onClick={() => setFilter(item.value)}>
                                    {item.label}
                                </Chip>
                            ))}
                        </div>

                        {loading ? (
                            <Skeleton rows={4} />
                        ) : entries.length === 0 ? (
                            <EmptyState title="Belum ada entri" description="Mulai dari curhat ABC hari ini." />
                        ) : (
                            <div className="space-y-2">
                                {entries.map((entry) => (
                                    <div key={entry.id}>
                                        <ListRow
                                            onClick={() => toggleEntry(entry)}
                                            leading={
                                                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e8eaf6] text-[#3f51b5]">
                                                    <Icon name="book" size={17} />
                                                </span>
                                            }
                                            title={formatDate(entry.entry_date)}
                                            subtitle={entry.excerpt}
                                            meta={
                                                <>
                                                    <Badge tone="info">Curhat ABC</Badge>
                                                    <Badge tone={entry.status === 'published' ? 'success' : 'warning'}>
                                                        {label('journalStatus', entry.status)}
                                                    </Badge>
                                                    {entry.follow_up_requested ? <Badge tone="warning">Minta tindak lanjut</Badge> : null}
                                                    {entry.replies_count > 0 ? <Badge tone="success">{entry.replies_count} balasan</Badge> : null}
                                                </>
                                            }
                                            trailing={
                                                <Icon
                                                    name="chevron"
                                                    size={16}
                                                    className={`text-[#94a3b8] transition ${openEntry === entry.id ? 'rotate-180' : ''}`}
                                                />
                                            }
                                        />

                                        {openEntry === entry.id ? (
                                            <div className="mt-2 space-y-3 rounded-[18px] border border-[#e2e8f0] bg-white p-3.5">
                                                {detailLoading ? (
                                                    <Skeleton rows={2} />
                                                ) : (
                                                    <>
                                                        <div className="space-y-1.5 text-[12px] leading-relaxed">
                                                            <p><span className="font-semibold">A:</span> {detail.activating_event}</p>
                                                            <p><span className="font-semibold">B:</span> {detail.belief}</p>
                                                            <p><span className="font-semibold">C:</span> {detail.consequence}</p>
                                                        </div>

                                                        <div className="border-t border-[#e2e8f0] pt-3">
                                                            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#64748b]">Balasan Guru BK</p>
                                                            {detail?.replies?.length ? (
                                                                <div className="space-y-2">
                                                                    {detail.replies.map((reply) => (
                                                                        <div key={reply.id} className="rounded-2xl bg-[#e8eaf6] p-3">
                                                                            <p className="text-[12px] leading-relaxed text-[#1e293b]">{reply.content}</p>
                                                                            <p className="mt-1 text-[10.5px] text-[#64748b]">
                                                                                {reply.counselor_name} · {formatDate(reply.created_at, true)}
                                                                            </p>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <p className="text-[11.5px] text-[#64748b]">Belum ada balasan.</p>
                                                            )}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                ) : null}
            </div>
        </AppShell>
    );
}
