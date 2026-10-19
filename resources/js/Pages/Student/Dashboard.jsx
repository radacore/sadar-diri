import { usePage } from '@inertiajs/react';
import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../../Components/Icons';
import { Badge, Button, Card, CardTitle, EmptyState, MoodPicker, Skeleton, Stat, useConfirm, useToast } from '../../Components/UI';
import AppShell from '../../Layouts/AppShell';
import { api } from '../../lib/api';
import { formatDate, label, relative } from '../../lib/format';

const TAGS = ['senang', 'tenang', 'sedih', 'marah', 'cemas', 'takut', 'kecewa', 'bersemangat'];

export default function Dashboard() {
    const { auth } = usePage().props;
    const user = auth.user;
    const toast = useToast();
    const confirm = useConfirm();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [mood, setMood] = useState(null);
    const [tags, setTags] = useState([]);
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        try {
            const response = await api.get('/api/student/dashboard');
            setData(response.data);
            if (response.data.today_mood) {
                const saved = response.data.today_mood;
                setMood(saved.valence === 'positive' ? saved.intensity : (saved.intensity >= 5 ? 1 : 2));
                setTags(saved.emotion_tags ?? []);
                setNote(saved.note ?? '');
            }
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        load();
    }, [load]);

    const toggleTag = (tag) => {
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
            details: [
                { label: 'Mood', value: mood >= 3 ? `${mood}/5 positif` : 'negatif' },
                { label: 'Tag emosi', value: tags.join(', ') },
            ],
            confirmLabel: 'Simpan mood',
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
                note: note || null,
            });
            toast.push('Mood tersimpan.');
            await load();
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <AppShell
            title={`Halo, ${user?.name?.split(' ')[0] ?? 'Siswa'}`}
            subtitle="Bagaimana perasaanmu hari ini?"
            actions={<Button variant="primary" onClick={() => (window.location.href = '/siswa/jurnal')}>Tulis jurnal</Button>}
        >
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
                <Card className="bg-[#f8fafc] lg:col-span-8">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-[13px] text-[#475569]">Mood hari ini</p>
                            <p className="text-[22px] font-bold tracking-tight">
                                {data?.today_mood ? label('mood', data.today_mood.valence) : 'Belum dicatat'}
                            </p>
                            <p className="text-[12px] text-[#475569]">
                                {data?.today_mood ? `${data.today_mood.intensity}/5 · ${data.today_mood.emotion_tags.join(', ')}` : 'Luangkan satu menit untuk mencatat.'}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge tone="info">{data?.journal_streak_days ?? 0} hari menulis</Badge>
                            <Badge tone={(data?.active_targets ?? 0) > 0 ? 'success' : 'neutral'}>
                                {data?.active_targets ?? 0} target aktif
                            </Badge>
                        </div>
                    </div>
                </Card>

                <Card className="lg:col-span-4">
                    <CardTitle>Ringkasan pekan</CardTitle>
                    {loading ? (
                        <Skeleton rows={2} />
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            <Stat label="Mood positif" value={data?.mood_7d?.positive_days ?? 0} hint="7 hari terakhir" />
                            <Stat label="Mood negatif" value={data?.mood_7d?.negative_days ?? 0} hint="7 hari terakhir" tone="warning" />
                        </div>
                    )}
                </Card>

                <Card className="lg:col-span-8">
                    <CardTitle>Catat mood</CardTitle>
                    <MoodPicker value={mood} onChange={setMood} />
                    <div className="mt-3 flex flex-wrap gap-1.5">
                        {TAGS.map((tag) => (
                            <button
                                key={tag}
                                type="button"
                                aria-pressed={tags.includes(tag)}
                                onClick={() => toggleTag(tag)}
                                className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition ${
                                    tags.includes(tag)
                                        ? 'bg-[#e8eaf6] text-[#303f9f] ring-1 ring-[#3f51b5]'
                                        : 'bg-[#f1f5f9] text-[#475569] hover:bg-[#e2e8f0]'
                                }`}
                            >
                                {tag}
                            </button>
                        ))}
                    </div>
                    <textarea
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        placeholder="Catatan singkat (opsional)"
                        className="sd-input sd-textarea mt-3 text-[13px]"
                        rows={2}
                    />
                    <div className="mt-3 flex items-center justify-between gap-2">
                        <p className="text-[11px] text-[#5b6b7f]">Maksimal 5 tag. Satu entri per hari.</p>
                        <Button variant="success" onClick={saveMood} disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan mood'}</Button>
                    </div>
                </Card>

                <Card className="lg:col-span-4">
                    <CardTitle>Target bulan ini</CardTitle>
                    {data?.targets?.length ? (
                        <ul className="space-y-2">
                            {data.targets.map((target) => (
                                <li key={target.id} className="rounded-[14px] bg-[#f1f5f9] p-3">
                                    <p className="text-[13px] font-semibold">{target.title}</p>
                                    <p className="text-[11px] text-[#475569]">{target.success_indicator}</p>
                                    <Badge tone={target.status === 'achieved' ? 'success' : 'neutral'}>
                                        {label('targetStatus', target.status)}
                                    </Badge>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <EmptyState
                            title="Belum ada target"
                            description="Tetapkan satu langkah kecil untuk bulan ini."
                            action={<Button variant="outline" onClick={() => (window.location.href = '/siswa/rencana')}>Buat target</Button>}
                        />
                    )}
                </Card>

                <Card className="lg:col-span-7">
                    <CardTitle action={<Button variant="ghost" onClick={() => (window.location.href = '/siswa/jurnal')}>Lihat semua</Button>}>
                        Jurnal terakhir
                    </CardTitle>
                    {data?.last_journal ? (
                        <div className="rounded-[18px] bg-[#f8fafc] p-4">
                            <div className="mb-1 flex items-center gap-2">
                                <Badge tone="info">{label('journal', data.last_journal.type)}</Badge>
                                <span className="text-[11px] text-[#475569]">{formatDate(data.last_journal.entry_date)}</span>
                            </div>
                            <p className="text-[13px] leading-relaxed">{data.last_journal.excerpt}</p>
                        </div>
                    ) : (
                        <EmptyState title="Belum ada jurnal" description="Mulai dengan curhat ABC atau grateful journal." />
                    )}
                </Card>

                <Card className="lg:col-span-5">
                    <CardTitle>Pengumuman</CardTitle>
                    {data?.announcements?.length ? (
                        <ul className="space-y-2">
                            {data.announcements.map((item) => (
                                <li key={item.id} className="rounded-[14px] border border-[#e2e8f0] p-3">
                                    <p className="text-[13px] font-semibold">{item.title}</p>
                                    <p className="text-[12px] text-[#475569]">{item.body}</p>
                                    <p className="mt-1 text-[11px] text-[#5b6b7f]">{relative(item.published_at)}</p>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="py-6 text-center text-[12px] text-[#475569]">Belum ada pengumuman.</p>
                    )}
                    <div className="mt-4 rounded-[14px] bg-[#e8eaf6] p-3">
                        <p className="flex items-center gap-2 text-[12px] font-semibold text-[#303f9f]">
                            <Icon name="shield" size={16} /> Data Anda terlindungi
                        </p>
                        <p className="mt-1 text-[11px] text-[#303f9f]">
                            Hanya Guru BK kelas Anda yang dapat membaca jurnal. Setiap akses tercatat.
                        </p>
                    </div>
                </Card>
            </div>
        </AppShell>
    );
}
