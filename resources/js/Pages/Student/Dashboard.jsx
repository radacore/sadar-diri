import { usePage } from '@inertiajs/react';
import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../../Components/Icons';
import {
    Badge,
    Button,
    EmptyState,
    HeroCard,
    ListRow,
    PageSection,
    Skeleton,
    StatTile,
    useToast,
} from '../../Components/UI';
import AppShell from '../../Layouts/AppShell';
import { api } from '../../lib/api';
import { formatDate, label } from '../../lib/format';


function lastSevenDays(points = []) {
    return Array.from({ length: 7 }).map((_, index) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - index));
        const key = [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, '0'),
            String(date.getDate()).padStart(2, '0'),
        ].join('-');
        return {
            key,
            day: new Intl.DateTimeFormat('id-ID', { weekday: 'narrow' }).format(date),
            point: points.find((item) => item.date === key),
        };
    });
}

export default function Dashboard() {
    const { auth } = usePage().props;
    const user = auth.user;
    const toast = useToast();

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try {
            const response = await api.get('/api/student/dashboard');
            setData(response.data);

        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        load();
    }, [load]);

    const todayMood = data?.today_mood;
    const week = lastSevenDays(data?.mood_7d?.points ?? []);
    const firstName = user?.name?.split(' ')[0] ?? 'Siswa';

    return (
        <AppShell
            title="Beranda"
            subtitle="Ringkasan hari ini"
        >
            <div className="space-y-6">
                <HeroCard
                    eyebrow={formatDate(new Date())}
                    title={`Halo, ${firstName}`}
                    description={
                        todayMood
                            ? `Mood ${label('mood', todayMood.valence).toLowerCase()} · intensitas ${todayMood.intensity}/5`
                            : 'Belum ada catatan mood hari ini. Luangkan satu menit untuk mengenali perasaanmu.'
                    }
                    aside={
                        <span className={`sd-hero-status ${todayMood ? '' : 'is-off'}`}>
                            <span className="sd-hero-status-dot" aria-hidden="true" />
                            {todayMood ? 'Tercatat' : 'Belum dicatat'}
                        </span>
                    }
                    meta={
                        (todayMood?.emotion_tags ?? []).length > 0
                            ? todayMood.emotion_tags.map((tag) => (
                                  <span key={tag} className="sd-hero-tag">
                                      {tag}
                                  </span>
                              ))
                            : null
                    }
                >
                    <div className="sd-hero-actions">
                        <Button variant="outline" className="min-h-11" onClick={() => { window.location.href = '/siswa/jurnal?tab=mood'; }}>
                            <span className="inline-flex items-center gap-1.5">
                                <Icon name={todayMood ? 'edit' : 'plus'} size={16} />
                                {todayMood ? 'Ubah mood' : 'Catat mood'}
                            </span>
                        </Button>
                    </div>
                </HeroCard>

                {!loading && data?.weekly_reflection?.mandatory && !data.weekly_reflection.submitted ? (
                    <section className="rounded-[18px] border border-[#fcd34d] bg-[#fffbeb] p-4">
                        <p className="flex items-center gap-2 text-[13px] font-bold text-[#92400e]">
                            <Icon name="alert" size={16} /> Refleksi pekan ini wajib diisi
                        </p>
                        <p className="mt-1 text-[11.5px] leading-relaxed text-[#92400e]">
                            Tulis hal paling berat serta syukur dan hikmah pekanmu sebelum Minggu berakhir. Butuh sekitar lima menit.
                        </p>
                        <Button
                            className="mt-3 min-h-11"
                            variant="warning"
                            onClick={() => (window.location.href = '/siswa/refleksi')}
                        >
                            Isi refleksi
                        </Button>
                    </section>
                ) : null}

                <div className="grid grid-cols-2 gap-3">
                    <StatTile label="Mood positif" value={data?.mood_7d?.positive_days ?? 0} hint="7 hari terakhir" tone="primary" icon="sparkle" />
                    <StatTile label="Mood negatif" value={data?.mood_7d?.negative_days ?? 0} hint="7 hari terakhir" tone="warning" icon="alert" />
                    <StatTile label="Streak jurnal" value={`${data?.journal_streak_days ?? 0}`} hint="hari berturut-turut" tone="success" icon="book" />
                    <StatTile label="Target aktif" value={data?.active_targets ?? 0} hint="bulan ini" icon="target" />
                </div>

                <section className="sd-tile">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h2 className="text-[13px] font-bold uppercase tracking-[0.1em] text-[#64748b]">Mood 7 hari</h2>
                            <p className="mt-0.5 text-[11.5px] text-[#64748b]">
                                {data?.mood_7d?.positive_days ?? 0} hari positif · {data?.mood_7d?.negative_days ?? 0} hari negatif
                            </p>
                        </div>
                        <Icon name="chart" size={18} className="text-[#94a3b8]" />
                    </div>
                    {loading ? (
                        <div className="mt-3"><Skeleton rows={1} /></div>
                    ) : (
                        <div className="mt-4 flex items-end justify-between gap-1.5">
                            {week.map(({ key, day, point }) => (
                                <div key={key} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                                    <div className="flex h-12 w-full items-end justify-center">
                                        {point ? (
                                            <div
                                                className="w-full max-w-[26px] rounded-full"
                                                style={{
                                                    height: `${Math.max(10, point.intensity * 9)}px`,
                                                    background: point.valence === 'positive' ? '#3f51b5' : '#b45309',
                                                }}
                                            />
                                        ) : (
                                            <div className="h-1.5 w-full max-w-[26px] rounded-full bg-[#e2e8f0]" />
                                        )}
                                    </div>
                                    <span className="text-[11px] font-semibold uppercase text-[#64748b]">{day}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <PageSection
                    title="Jurnal terakhir"
                    action={<Button className="min-h-11" size="sm" variant="ghost" onClick={() => (window.location.href = '/siswa/jurnal')}>Lihat semua</Button>}
                >
                    {loading ? (
                        <Skeleton rows={2} />
                    ) : data?.last_journal ? (
                        <ListRow
                            leading={
                                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e8eaf6] text-[#3f51b5]">
                                    <Icon name="book" size={18} />
                                </span>
                            }
                            title={label('journal', data.last_journal.type)}
                            subtitle={data.last_journal.excerpt}
                            meta={
                                <>
                                    <Badge tone="info">{formatDate(data.last_journal.entry_date)}</Badge>
                                    <Badge tone="success">Terbit</Badge>
                                </>
                            }
                            trailing={<Icon name="chevron" size={16} className="text-[#94a3b8]" />}
                            href="/siswa/jurnal"
                        />
                    ) : (
                        <EmptyState
                            title="Belum ada jurnal"
                            description="Mulai dengan curhat ABC hari ini."
                            action={<Button className="min-h-11" variant="outline" onClick={() => (window.location.href = '/siswa/jurnal')}>Tulis jurnal</Button>}
                        />
                    )}
                </PageSection>

                <PageSection
                    title="Target bulan ini"
                    action={<Button className="min-h-11" size="sm" variant="ghost" onClick={() => (window.location.href = '/siswa/rencana')}>Kelola</Button>}
                >
                    {data?.targets?.length ? (
                        <div className="space-y-2">
                            {data.targets.map((target) => (
                                <ListRow
                                    key={target.id}
                                    leading={
                                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f1f5f9] text-[#475569]">
                                            <Icon name="target" size={18} />
                                        </span>
                                    }
                                    title={target.title}
                                    subtitle={target.success_indicator || 'Tanpa indikator'}
                                    meta={<Badge tone={target.status === 'achieved' ? 'success' : 'neutral'}>{label('targetStatus', target.status)}</Badge>}
                                />
                            ))}
                        </div>
                    ) : (
                        <EmptyState
                            title="Belum ada target"
                            description="Tetapkan satu langkah kecil untuk bulan ini."
                            action={<Button className="min-h-11" variant="outline" onClick={() => (window.location.href = '/siswa/rencana')}>Buat target</Button>}
                        />
                    )}
                </PageSection>

                <div className="rounded-[18px] bg-[#e8eaf6] p-4">
                    <p className="flex items-center gap-2 text-[12px] font-semibold text-[#303f9f]">
                        <Icon name="shield" size={16} /> Data Anda terlindungi
                    </p>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-[#303f9f]">
                        Hanya Guru BK kelas Anda yang dapat membaca jurnal. Setiap akses tercatat.
                    </p>
                </div>
            </div>

        </AppShell>
    );
}
