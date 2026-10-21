import { useCallback, useEffect, useState } from 'react';
import {
    Badge,
    Button,
    Card,
    CardTitle,
    EmptyState,
    Field,
    IconButton,
    Input,
    ListRow,
    Progress,
    Segmented,
    Sheet,
    Skeleton,
    StatTile,
    Textarea,
    useConfirm,
    useToast,
} from '../../Components/UI';
import { Icon } from '../../Components/Icons';
import AppShell from '../../Layouts/AppShell';
import { api } from '../../lib/api';
import { formatDate, initials, label, relative } from '../../lib/format';

const tabs = [
    { value: 'ringkasan', label: 'Ringkasan' },
    { value: 'jurnal', label: 'Jurnal' },
    { value: 'refleksi', label: 'Refleksi' },
    { value: 'prestasi', label: 'Prestasi' },
    { value: 'rencana', label: 'Rencana' },
    { value: 'profil', label: 'Profil' },
];

const emptyAchievement = {
    category: 'academic',
    title: '',
    organizer: '',
    level: 'school',
    achieved_at: new Date().toISOString().slice(0, 10),
    rank: '',
    description: '',
};

const emptyBiodata = {
    birth_date: '',
    gender: '',
    address: '',
    phone: '',
    height_cm: '',
    weight_kg: '',
    blood_type: '',
    medical_history: '',
    health_notes: '',
    extra_fields: [],
};

const emptySelf = {
    psychological_summary: '',
    character_summary: '',
    strengths: '',
    weaknesses: '',
};

export default function StudentDetail({ studentId }) {
    const toast = useToast();
    const confirm = useConfirm();
    const [overview, setOverview] = useState(null);
    const [journals, setJournals] = useState([]);
    const [reflections, setReflections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [noteOpen, setNoteOpen] = useState(false);
    const [note, setNote] = useState({ title: '', summary: '', content: '', visible_to_student: false });
    const [busy, setBusy] = useState(false);
    const [tab, setTab] = useState('ringkasan');
    const [openJournal, setOpenJournal] = useState(null);
    const [achievements, setAchievements] = useState([]);
    const [planData, setPlanData] = useState(null);
    const [achievementOpen, setAchievementOpen] = useState(false);
    const [achievementForm, setAchievementForm] = useState(emptyAchievement);
    const [biodataForm, setBiodataForm] = useState(emptyBiodata);
    const [selfForm, setSelfForm] = useState(emptySelf);
    const [profileOpen, setProfileOpen] = useState(false);
    const [replyFor, setReplyFor] = useState(null);
    const [replyText, setReplyText] = useState('');

    const load = useCallback(async () => {
        try {
            const [overviewResponse, journalResponse, reflectionResponse, achievementResponse, planResponse] = await Promise.all([
                api.get(`/api/counselor/students/${studentId}/overview`),
                api.get(`/api/counselor/students/${studentId}/journals`),
                api.get(`/api/counselor/students/${studentId}/reflections`),
                api.get(`/api/counselor/students/${studentId}/achievements`),
                api.get(`/api/counselor/students/${studentId}/action-plan`),
            ]);
            setOverview(overviewResponse.data);
            setJournals(journalResponse.data ?? []);
            setReflections(reflectionResponse.data ?? []);
            setAchievements(achievementResponse.data ?? []);
            setPlanData(planResponse.data);
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [studentId, toast]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        if (!overview?.profile) return;

        const biodata = overview.profile.biodata ?? {};
        const self = overview.profile.self_profile ?? {};

        setBiodataForm({
            birth_date: biodata.birth_date ?? '',
            gender: biodata.gender ?? '',
            address: biodata.address ?? '',
            phone: biodata.phone ?? '',
            height_cm: biodata.height_cm ?? '',
            weight_kg: biodata.weight_kg ?? '',
            blood_type: biodata.blood_type ?? '',
            medical_history: biodata.medical_history ?? '',
            health_notes: biodata.health_notes ?? '',
            extra_fields: biodata.extra_fields ?? [],
        });

        setSelfForm({
            psychological_summary: self.psychological_summary ?? '',
            character_summary: self.character_summary ?? '',
            strengths: self.strengths ?? '',
            weaknesses: self.weaknesses ?? '',
        });
    }, [overview]);

    const saveAchievement = async (event) => {
        event.preventDefault();

        const decision = await confirm({
            title: 'Tambahkan prestasi untuk siswa?',
            description: 'Prestasi yang dicatat Guru BK langsung berstatus terverifikasi.',
            details: [
                { label: 'Siswa', value: overview?.student?.name ?? '—' },
                { label: 'Prestasi', value: achievementForm.title },
            ],
            confirmLabel: 'Simpan prestasi',
            tone: 'primary',
            icon: 'sparkle',
        });
        if (!decision) return;

        setBusy(true);

        try {
            await api.post(`/api/counselor/students/${studentId}/achievements`, achievementForm);
            toast.push('Prestasi ditambahkan.');
            setAchievementOpen(false);
            setAchievementForm(emptyAchievement);
            await load();
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setBusy(false);
        }
    };

    const updateExtraBiodata = (index, key, value) => {
        const rows = [...(biodataForm.extra_fields ?? [])];
        rows[index] = { ...rows[index], [key]: value };
        setBiodataForm({ ...biodataForm, extra_fields: rows });
    };

    const removeExtraBiodata = (index) => {
        setBiodataForm({
            ...biodataForm,
            extra_fields: (biodataForm.extra_fields ?? []).filter((_, position) => position !== index),
        });
    };

    const saveProfile = async (event) => {
        event.preventDefault();
        const decision = await confirm({
            title: 'Simpan perubahan profil siswa?',
            description: 'Perubahan dicatat di audit log dan riwayat versi profil.',
            confirmLabel: 'Simpan profil',
            tone: 'warning',
            icon: 'shield',
        });
        if (!decision) return;

        setBusy(true);

        try {
            await api.put(`/api/counselor/students/${studentId}/profile/biodata`, {
                ...biodataForm,
                height_cm: biodataForm.height_cm === '' ? null : Number(biodataForm.height_cm),
                weight_kg: biodataForm.weight_kg === '' ? null : Number(biodataForm.weight_kg),
                birth_date: biodataForm.birth_date || null,
                gender: biodataForm.gender || null,
            });
            await api.put(`/api/counselor/students/${studentId}/profile/self`, selfForm);
            toast.push('Profil siswa diperbarui.');
            setProfileOpen(false);
            await load();
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setBusy(false);
        }
    };

    const sendReply = async (entry) => {
        if (!replyText.trim()) return;

        const decision = await confirm({
            title: 'Kirim balasan ke siswa?',
            description: 'Siswa akan menerima notifikasi dan dapat membaca balasan di riwayat jurnalnya.',
            details: [
                { label: 'Siswa', value: overview?.student?.name ?? '—' },
                { label: 'Tanggal jurnal', value: formatDate(entry.entry_date) },
            ],
            confirmLabel: 'Kirim balasan',
            tone: 'primary',
            icon: 'send',
        });
        if (!decision) return;

        setBusy(true);

        try {
            await api.post(`/api/counselor/journals/${entry.id}/replies`, { content: replyText });
            toast.push('Balasan terkirim.');
            setReplyFor(null);
            setReplyText('');
            await load();
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setBusy(false);
        }
    };

    const saveNote = async (event) => {
        event.preventDefault();

        const decision = await confirm({
            title: 'Simpan catatan konseling?',
            description: note.visible_to_student
                ? 'Ringkasan catatan akan terlihat oleh siswa.'
                : 'Catatan terenkripsi dan hanya dapat dibaca Guru BK.',
            details: [
                { label: 'Siswa', value: overview?.student?.name ?? '—' },
                { label: 'Judul', value: note.title },
            ],
            confirmLabel: 'Simpan catatan',
            tone: 'primary',
            icon: 'file',
        });
        if (!decision) return;

        setBusy(true);

        try {
            await api.post('/api/counselor/counseling-notes', {
                student_id: Number(studentId),
                occurred_at: new Date().toISOString(),
                ...note,
            });
            toast.push('Catatan konseling tersimpan.');
            setNoteOpen(false);
            setNote({ title: '', summary: '', content: '', visible_to_student: false });
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setBusy(false);
        }
    };

    if (loading) {
        return (
            <AppShell title="Profil siswa" subtitle="Memuat data…">
                <Skeleton rows={6} />
            </AppShell>
        );
    }

    if (!overview) {
        return (
            <AppShell title="Profil siswa" subtitle="Data tidak dapat dimuat">
                <Card>
                    <p className="text-[13px] text-[#475569]">Data siswa tidak dapat dimuat. Coba muat ulang halaman.</p>
                    <Button variant="outline" className="mt-3" onClick={() => window.location.reload()}>Muat ulang</Button>
                </Card>
            </AppShell>
        );
    }

    const student = overview.student;
    const openAlerts = overview.open_alerts;

    return (
        <AppShell
            title="Profil siswa"
            subtitle="Riwayat jurnal, refleksi, dan pendampingan"
            actions={
                <>
                    <Button variant="ghost" onClick={() => (window.location.href = '/bk/siswa')}>Kembali</Button>
                    <Button onClick={() => setNoteOpen(true)}>Tulis catatan</Button>
                    <Button variant="outline" onClick={() => (window.location.href = '/bk/refleksi')}>Buat sesi refleksi</Button>
                    <Button variant="ghost" onClick={() => window.location.reload()}>Muat ulang</Button>
                </>
            }
        >
            <div className="space-y-4">
                <section className="rounded-[24px] border border-[#e2e8f0] bg-white p-4 shadow-[0_2px_10px_-6px_rgba(15,23,42,0.12)]">
                    <div className="flex items-center gap-3">
                        <span className="sd-avatar flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-[17px] font-bold">
                            {initials(student.name)}
                        </span>
                        <div className="min-w-0">
                            <h2 className="truncate text-[18px] font-extrabold leading-tight">{student.name}</h2>
                            <p className="truncate text-[12px] text-[#64748b]">
                                {student.class?.name ?? '—'} · NIS {student.identity_number ?? '—'}
                            </p>
                            <p className="mt-0.5 text-[11px] text-[#94a3b8]">
                                Aktif {relative(overview.activity.last_activity_at)} · {overview.activity.journal_streak_days} hari menulis
                            </p>
                        </div>
                    </div>
                    <Segmented className="mt-4 [&>button]:min-h-[44px]" options={tabs} value={tab} onChange={setTab} />
                </section>

                {tab === 'ringkasan' ? (
                    <div className="grid gap-4">
                        <div className="grid grid-cols-2 gap-3">
                            <StatTile
                                label="Mood 7 hari"
                                value={`${overview.activity.mood_7d.positive_days}/${overview.activity.mood_7d.negative_days}`}
                                hint="positif / negatif"
                                tone="primary"
                                icon="sparkle"
                            />
                            <StatTile
                                label="Jurnal"
                                value={journals.length}
                                hint={`${overview.activity.journal_streak_days} hari menulis`}
                                icon="book"
                            />
                            <StatTile
                                label="Prestasi"
                                value={overview.portfolio.total}
                                hint={`${overview.portfolio.verified} terverifikasi`}
                                icon="target"
                            />
                            <StatTile
                                label="Alert terbuka"
                                value={openAlerts}
                                hint={openAlerts > 0 ? 'Perlu tindak lanjut' : 'Tidak ada alert'}
                                tone={openAlerts > 0 ? 'danger' : 'default'}
                                icon="alert"
                            />
                        </div>

                        <Card>
                            <CardTitle>Ringkasan konseling</CardTitle>
                            <dl className="space-y-3 text-[12.5px]">
                                <div>
                                    <dt className="font-semibold">Gambaran psikis</dt>
                                    <dd className="break-words text-[#475569]">{overview.profile.psychological_summary || '—'}</dd>
                                </div>
                                <div>
                                    <dt className="font-semibold">Kelebihan</dt>
                                    <dd className="break-words text-[#475569]">{overview.profile.strengths || '—'}</dd>
                                </div>
                                <div>
                                    <dt className="font-semibold">Kekurangan</dt>
                                    <dd className="break-words text-[#475569]">{overview.profile.weaknesses || '—'}</dd>
                                </div>
                            </dl>
                            <div className="mt-4">
                                <Progress value={overview.profile.completeness_percent} label="Kelengkapan profil" />
                            </div>
                            <p className="mt-2 text-[11px] text-[#5b6b7f]">
                                {overview.profile.published_at
                                    ? `Dipublikasikan ${formatDate(overview.profile.published_at)}`
                                    : 'Belum dipublikasikan'}
                            </p>
                        </Card>
                    </div>
                ) : null}

                {tab === 'jurnal' ? (
                    <div>
                        {journals.length === 0 ? (
                            <div className="rounded-[22px] border border-dashed border-[#cbd5e1] bg-white/70">
                                <EmptyState title="Belum ada jurnal" description="Siswa belum menulis jurnal." />
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {journals.map((entry) => (
                                    <div key={entry.id}>
                                        <ListRow
                                            onClick={() => setOpenJournal(openJournal === entry.id ? null : entry.id)}
                                            leading={
                                                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e8eaf6] text-[#3f51b5]">
                                                    <Icon name="book" size={17} />
                                                </span>
                                            }
                                            title={formatDate(entry.entry_date)}
                                            subtitle={
                                                entry.type === 'abc'
                                                    ? entry.activating_event
                                                    : entry.gratitude_text || entry.happiness_text || '—'
                                            }
                                            meta={
                                                <>
                                                    <Badge tone="info">{label('journal', entry.type)}</Badge>
                                                    {entry.is_flagged ? <Badge tone="danger">Perlu perhatian</Badge> : null}
                                                    {entry.follow_up_requested ? <Badge tone="warning">Minta tindak lanjut</Badge> : null}
                                                    {entry.replies?.length ? <Badge tone="success">{entry.replies.length} balasan</Badge> : null}
                                                </>
                                            }
                                            trailing={
                                                <Icon
                                                    name="chevron"
                                                    size={16}
                                                    className={`text-[#94a3b8] transition ${openJournal === entry.id ? 'rotate-180' : ''}`}
                                                />
                                            }
                                        />
                                        {openJournal === entry.id ? (
                                            <div className="mt-2 space-y-1.5 break-words rounded-[16px] border border-[#e2e8f0] bg-white p-3 text-[12px]">
                                                {entry.type === 'abc' ? (
                                                    <>
                                                        <p><span className="font-semibold">A:</span> {entry.activating_event}</p>
                                                        <p><span className="font-semibold">B:</span> {entry.belief}</p>
                                                        <p><span className="font-semibold">C:</span> {entry.consequence}</p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <p><span className="font-semibold">Bersyukur:</span> {entry.gratitude_text || '—'}</p>
                                                        <p><span className="font-semibold">Bahagia:</span> {entry.happiness_text || '—'}</p>
                                                    </>
                                                )}

                                                <div className="mt-3 border-t border-[#e2e8f0] pt-3">
                                                    <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#64748b]">Balasan Anda</p>
                                                    {entry.replies?.length ? (
                                                        <div className="space-y-2">
                                                            {entry.replies.map((reply) => (
                                                                <div key={reply.id} className="rounded-2xl bg-[#e8eaf6] p-2.5">
                                                                    <p className="text-[12px] leading-relaxed">{reply.content}</p>
                                                                    <p className="mt-1 text-[10.5px] text-[#64748b]">
                                                                        {reply.counselor_name} · {formatDate(reply.created_at, true)}
                                                                    </p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-[11.5px] text-[#64748b]">Belum ada balasan.</p>
                                                    )}

                                                    {replyFor === entry.id ? (
                                                        <div className="mt-2 space-y-2">
                                                            <Textarea
                                                                rows={3}
                                                                value={replyText}
                                                                onChange={(event) => setReplyText(event.target.value)}
                                                                placeholder="Tulis tanggapan yang menenangkan dan terarah…"
                                                                aria-label="Balasan untuk siswa"
                                                            />
                                                            <div className="flex gap-2">
                                                                <Button variant="outline" className="flex-1" onClick={() => { setReplyFor(null); setReplyText(''); }}>
                                                                    Batal
                                                                </Button>
                                                                <Button variant="primary" className="flex-1" disabled={busy || !replyText.trim()} onClick={() => sendReply(entry)}>
                                                                    Kirim balasan
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <Button
                                                            variant="soft"
                                                            className="mt-2 w-full"
                                                            onClick={() => { setReplyFor(entry.id); setReplyText(''); }}
                                                        >
                                                            Balas jurnal ini
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        )}
                        <p className="pt-1 text-[11px] text-[#5b6b7f]">
                            Setiap pembukaan data tercatat di audit log dan terlihat oleh siswa.
                        </p>
                    </div>
                ) : null}

                {tab === 'refleksi' ? (
                    <div>
                        {reflections.length === 0 ? (
                            <div className="rounded-[22px] border border-dashed border-[#cbd5e1] bg-white/70">
                                <EmptyState title="Belum ada refleksi" description="Belum ada sesi refleksi untuk siswa ini." />
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {reflections.map((item) => (
                                    <ListRow
                                        key={item.id}
                                        leading={
                                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e0f2fe] text-[#0369a1]">
                                                <Icon name="clock" size={17} />
                                            </span>
                                        }
                                        title={label('reflection', item.type)}
                                        subtitle={item.week_start ? formatDate(item.week_start) : formatDate(item.submitted_at)}
                                        meta={
                                            <Badge tone={item.has_feedback ? 'success' : 'neutral'}>
                                                {item.has_feedback ? 'Ada umpan balik' : label('reflectionStatus', item.status)}
                                            </Badge>
                                        }
                                        trailing={<Icon name="chevron" size={16} className="text-[#94a3b8]" />}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                ) : null}
                {tab === 'prestasi' ? (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="text-[15px] font-bold">Portofolio prestasi</h2>
                            <Button size="sm" variant="primary" onClick={() => setAchievementOpen(true)}>Tambah prestasi</Button>
                        </div>

                        {achievements.length === 0 ? (
                            <div className="rounded-[22px] border border-dashed border-[#cbd5e1] bg-white/70">
                                <EmptyState title="Belum ada prestasi" description="Catat capaian siswa bila Anda menemukannya." />
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {achievements.map((item) => (
                                    <ListRow
                                        key={item.id}
                                        leading={
                                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fef3c7] text-[#b45309]">
                                                <Icon name="sparkle" size={17} />
                                            </span>
                                        }
                                        title={item.title}
                                        subtitle={`${label('category', item.category)} · ${label('level', item.level)} · ${formatDate(item.achieved_at)}`}
                                        meta={
                                            <Badge tone={item.verification_status === 'verified' ? 'success' : item.verification_status === 'rejected' ? 'danger' : 'warning'}>
                                                {label('verification', item.verification_status)}
                                            </Badge>
                                        }
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                ) : null}

                {tab === 'rencana' ? (
                    <div className="space-y-4">
                        {planData?.plan ? (
                            <Card>
                                <CardTitle action={<Badge tone="info">{formatDate(planData.plan.period_start)} – {formatDate(planData.plan.period_end)}</Badge>}>
                                    Target bulan ini
                                </CardTitle>
                                {planData.plan.targets.length === 0 ? (
                                    <p className="text-[12.5px] text-[#64748b]">Siswa belum menetapkan target.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {planData.plan.targets.map((target) => (
                                            <div key={target.id} className="rounded-2xl border border-[#e2e8f0] p-3">
                                                <p className="text-[13px] font-semibold">{target.title}</p>
                                                {target.success_indicator ? (
                                                    <p className="mt-0.5 text-[11.5px] text-[#64748b]">Indikator: {target.success_indicator}</p>
                                                ) : null}
                                                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                                    <Badge tone={target.status === 'achieved' ? 'success' : target.status === 'not_achieved' ? 'danger' : 'info'}>
                                                        {label('targetStatus', target.status)}
                                                    </Badge>
                                                    <Badge tone="neutral">{label('targetBasis', target.basis ?? 'general')}</Badge>
                                                </div>
                                                {(target.steps ?? []).length > 0 ? (
                                                    <ul className="mt-2 space-y-1">
                                                        {target.steps.map((step) => (
                                                            <li key={step.id} className="flex items-start gap-2 text-[11.5px] text-[#475569]">
                                                                <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${step.is_done ? 'bg-[#047857]' : 'bg-[#cbd5e1]'}`} aria-hidden="true" />
                                                                <span className={step.is_done ? 'line-through text-[#94a3b8]' : ''}>{step.title}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : null}
                                                {target.progress_note ? (
                                                    <p className="mt-2 text-[11.5px] text-[#64748b]">Catatan: {target.progress_note}</p>
                                                ) : null}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </Card>
                        ) : (
                            <div className="rounded-[22px] border border-dashed border-[#cbd5e1] bg-white/70">
                                <EmptyState title="Belum ada rencana aksi" description="Siswa belum menyusun target bulanan." />
                            </div>
                        )}

                        <Card>
                            <CardTitle>Rencana masa depan</CardTitle>
                            {planData?.future_plan ? (
                                <dl className="space-y-2.5 text-[12.5px]">
                                    <div>
                                        <dt className="font-semibold">Cita-cita</dt>
                                        <dd className="break-words text-[#475569]">{planData.future_plan.dream || '—'}</dd>
                                    </div>
                                    <div>
                                        <dt className="font-semibold">Rencana karier</dt>
                                        <dd className="break-words text-[#475569]">{planData.future_plan.career_plan || '—'}</dd>
                                    </div>
                                    <div>
                                        <dt className="font-semibold">Rencana pendidikan</dt>
                                        <dd className="break-words text-[#475569]">{planData.future_plan.education_plan || '—'}</dd>
                                    </div>
                                    <div>
                                        <dt className="font-semibold">Langkah konkret</dt>
                                        <dd className="break-words text-[#475569]">{planData.future_plan.concrete_targets || '—'}</dd>
                                    </div>
                                </dl>
                            ) : (
                                <p className="text-[12.5px] text-[#64748b]">Siswa belum mengisi rencana masa depan.</p>
                            )}
                        </Card>
                    </div>
                ) : null}

                {tab === 'profil' ? (
                    <div className="space-y-4">
                        <Card>
                            <CardTitle action={<Button size="sm" variant="outline" onClick={() => setProfileOpen(true)}>Ubah profil</Button>}>
                                Biodata & profil diri
                            </CardTitle>
                            <dl className="space-y-2.5 text-[12.5px]">
                                <div><dt className="font-semibold">Tanggal lahir</dt><dd className="text-[#475569]">{biodataForm.birth_date ? formatDate(biodataForm.birth_date) : '—'}</dd></div>
                                <div><dt className="font-semibold">Jenis kelamin</dt><dd className="text-[#475569]">{biodataForm.gender === 'male' ? 'Laki-laki' : biodataForm.gender === 'female' ? 'Perempuan' : '—'}</dd></div>
                                <div><dt className="font-semibold">Kontak</dt><dd className="break-words text-[#475569]">{biodataForm.phone || '—'}</dd></div>
                                <div><dt className="font-semibold">Alamat</dt><dd className="break-words text-[#475569]">{biodataForm.address || '—'}</dd></div>
                                <div><dt className="font-semibold">Riwayat penyakit</dt><dd className="break-words text-[#475569]">{biodataForm.medical_history || '—'}</dd></div>
                                <div><dt className="font-semibold">Catatan kesehatan</dt><dd className="break-words text-[#475569]">{biodataForm.health_notes || '—'}</dd></div>
                                {(biodataForm.extra_fields ?? []).map((row, index) => (
                                    <div key={index}><dt className="font-semibold">{row.label}</dt><dd className="break-words text-[#475569]">{row.value}</dd></div>
                                ))}
                                <div><dt className="font-semibold">Gambaran psikis</dt><dd className="break-words text-[#475569]">{selfForm.psychological_summary || '—'}</dd></div>
                                <div><dt className="font-semibold">Karakter</dt><dd className="break-words text-[#475569]">{selfForm.character_summary || '—'}</dd></div>
                                <div><dt className="font-semibold">Kelebihan</dt><dd className="break-words text-[#475569]">{selfForm.strengths || '—'}</dd></div>
                                <div><dt className="font-semibold">Kekurangan</dt><dd className="break-words text-[#475569]">{selfForm.weaknesses || '—'}</dd></div>
                            </dl>
                            <div className="mt-3">
                                <Progress value={overview.profile.completeness_percent} label="Kelengkapan profil" />
                            </div>
                        </Card>
                    </div>
                ) : null}
            </div>

            <Sheet
                open={achievementOpen}
                onClose={() => setAchievementOpen(false)}
                title="Tambah prestasi siswa"
                footer={
                    <>
                        <Button variant="outline" className="flex-1" onClick={() => setAchievementOpen(false)}>Batal</Button>
                        <Button type="submit" form="achievement-form" className="flex-1" disabled={busy}>
                            {busy ? 'Menyimpan…' : 'Simpan prestasi'}
                        </Button>
                    </>
                }
            >
                <form id="achievement-form" onSubmit={saveAchievement} className="space-y-3">
                    <Field label="Judul prestasi" required htmlFor="ach-title">
                        <Input id="ach-title" value={achievementForm.title} onChange={(event) => setAchievementForm({ ...achievementForm, title: event.target.value })} required />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Kategori" required htmlFor="ach-category">
                            <select id="ach-category" className="sd-input" value={achievementForm.category} onChange={(event) => setAchievementForm({ ...achievementForm, category: event.target.value })}>
                                <option value="academic">Akademik</option>
                                <option value="non_academic">Non-akademik</option>
                                <option value="competition">Lomba</option>
                                <option value="soft_skill">Soft skill</option>
                            </select>
                        </Field>
                        <Field label="Tingkat" htmlFor="ach-level">
                            <select id="ach-level" className="sd-input" value={achievementForm.level} onChange={(event) => setAchievementForm({ ...achievementForm, level: event.target.value })}>
                                <option value="school">Sekolah</option>
                                <option value="district">Kecamatan</option>
                                <option value="city">Kota</option>
                                <option value="province">Provinsi</option>
                                <option value="national">Nasional</option>
                                <option value="international">Internasional</option>
                            </select>
                        </Field>
                    </div>
                    <Field label="Tanggal" required htmlFor="ach-date">
                        <Input id="ach-date" type="date" value={achievementForm.achieved_at} onChange={(event) => setAchievementForm({ ...achievementForm, achieved_at: event.target.value })} required />
                    </Field>
                    <Field label="Penyelenggara" htmlFor="ach-organizer">
                        <Input id="ach-organizer" value={achievementForm.organizer} onChange={(event) => setAchievementForm({ ...achievementForm, organizer: event.target.value })} />
                    </Field>
                    <Field label="Peringkat" htmlFor="ach-rank">
                        <Input id="ach-rank" value={achievementForm.rank} onChange={(event) => setAchievementForm({ ...achievementForm, rank: event.target.value })} />
                    </Field>
                    <Field label="Keterangan" htmlFor="ach-desc">
                        <Textarea id="ach-desc" rows={3} value={achievementForm.description} onChange={(event) => setAchievementForm({ ...achievementForm, description: event.target.value })} />
                    </Field>
                </form>
            </Sheet>

            <Sheet
                open={profileOpen}
                onClose={() => setProfileOpen(false)}
                title="Ubah profil siswa"
                footer={
                    <>
                        <Button variant="outline" className="flex-1" onClick={() => setProfileOpen(false)}>Batal</Button>
                        <Button type="submit" form="profile-form" className="flex-1" disabled={busy}>
                            {busy ? 'Menyimpan…' : 'Simpan profil'}
                        </Button>
                    </>
                }
            >
                <form id="profile-form" onSubmit={saveProfile} className="space-y-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#64748b]">Biodata</p>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Tanggal lahir" htmlFor="bio-birth">
                            <Input id="bio-birth" type="date" value={biodataForm.birth_date} onChange={(event) => setBiodataForm({ ...biodataForm, birth_date: event.target.value })} />
                        </Field>
                        <Field label="Jenis kelamin" htmlFor="bio-gender">
                            <select id="bio-gender" className="sd-input" value={biodataForm.gender} onChange={(event) => setBiodataForm({ ...biodataForm, gender: event.target.value })}>
                                <option value="">—</option>
                                <option value="male">Laki-laki</option>
                                <option value="female">Perempuan</option>
                            </select>
                        </Field>
                    </div>
                    <Field label="Kontak" htmlFor="bio-phone">
                        <Input id="bio-phone" value={biodataForm.phone} onChange={(event) => setBiodataForm({ ...biodataForm, phone: event.target.value })} />
                    </Field>
                    <Field label="Alamat" htmlFor="bio-address">
                        <Textarea id="bio-address" rows={2} value={biodataForm.address} onChange={(event) => setBiodataForm({ ...biodataForm, address: event.target.value })} />
                    </Field>
                    <div className="grid grid-cols-3 gap-2">
                        <Field label="Tinggi" htmlFor="bio-height">
                            <Input id="bio-height" type="number" value={biodataForm.height_cm} onChange={(event) => setBiodataForm({ ...biodataForm, height_cm: event.target.value })} />
                        </Field>
                        <Field label="Berat" htmlFor="bio-weight">
                            <Input id="bio-weight" type="number" value={biodataForm.weight_kg} onChange={(event) => setBiodataForm({ ...biodataForm, weight_kg: event.target.value })} />
                        </Field>
                        <Field label="Gol. darah" htmlFor="bio-blood">
                            <Input id="bio-blood" value={biodataForm.blood_type} onChange={(event) => setBiodataForm({ ...biodataForm, blood_type: event.target.value })} />
                        </Field>
                    </div>
                    <Field label="Riwayat penyakit" htmlFor="bio-medical">
                        <Textarea id="bio-medical" rows={2} value={biodataForm.medical_history} onChange={(event) => setBiodataForm({ ...biodataForm, medical_history: event.target.value })} />
                    </Field>
                    <Field label="Catatan kesehatan" htmlFor="bio-health">
                        <Textarea id="bio-health" rows={2} value={biodataForm.health_notes} onChange={(event) => setBiodataForm({ ...biodataForm, health_notes: event.target.value })} />
                    </Field>

                    <div className="rounded-[18px] border border-dashed border-[#cbd5e1] p-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-[12.5px] font-semibold">Data lain</p>
                                <p className="mt-0.5 text-[11px] leading-snug text-[#64748b]">Tambahkan hal yang belum tercakup, mis. ukuran seragam.</p>
                            </div>
                            <span className="shrink-0 text-[11px] tabular text-[#64748b]">{(biodataForm.extra_fields ?? []).length}/5</span>
                        </div>
                        <div className="mt-2 space-y-2">
                            {(biodataForm.extra_fields ?? []).map((row, index) => (
                                <div key={index} className="flex items-start gap-2">
                                    <Input
                                        className="min-w-0 flex-1"
                                        placeholder="Nama data"
                                        value={row.label ?? ''}
                                        aria-label={`Nama data tambahan ${index + 1}`}
                                        onChange={(event) => updateExtraBiodata(index, 'label', event.target.value)}
                                    />
                                    <Input
                                        className="min-w-0 flex-1"
                                        placeholder="Isi"
                                        value={row.value ?? ''}
                                        aria-label={`Isi data tambahan ${index + 1}`}
                                        onChange={(event) => updateExtraBiodata(index, 'value', event.target.value)}
                                    />
                                    <IconButton
                                        icon="trash"
                                        label={`Hapus data ${row.label || index + 1}`}
                                        variant="danger"
                                        size={44}
                                        onClick={() => removeExtraBiodata(index)}
                                    />
                                </div>
                            ))}
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            className="mt-2 w-full"
                            disabled={(biodataForm.extra_fields ?? []).length >= 5}
                            onClick={() => setBiodataForm({ ...biodataForm, extra_fields: [...(biodataForm.extra_fields ?? []), { label: '', value: '' }] })}
                        >
                            Tambah data lain
                        </Button>
                    </div>

                    <p className="pt-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[#64748b]">Profil diri</p>
                    <Field label="Gambaran psikis" htmlFor="self-psych">
                        <Textarea id="self-psych" rows={3} value={selfForm.psychological_summary} onChange={(event) => setSelfForm({ ...selfForm, psychological_summary: event.target.value })} />
                    </Field>
                    <Field label="Karakter" htmlFor="self-char">
                        <Textarea id="self-char" rows={3} value={selfForm.character_summary} onChange={(event) => setSelfForm({ ...selfForm, character_summary: event.target.value })} />
                    </Field>
                    <Field label="Kelebihan" htmlFor="self-strength">
                        <Textarea id="self-strength" rows={2} value={selfForm.strengths} onChange={(event) => setSelfForm({ ...selfForm, strengths: event.target.value })} />
                    </Field>
                    <Field label="Kekurangan" htmlFor="self-weakness">
                        <Textarea id="self-weakness" rows={2} value={selfForm.weaknesses} onChange={(event) => setSelfForm({ ...selfForm, weaknesses: event.target.value })} />
                    </Field>
                </form>
            </Sheet>

            <Sheet
                open={noteOpen}
                onClose={() => setNoteOpen(false)}
                title="Catatan konseling"
                footer={
                    <>
                        <Button variant="outline" className="flex-1" onClick={() => setNoteOpen(false)}>Batal</Button>
                        <Button type="submit" form="note-form" className="flex-1" disabled={busy}>
                            {busy ? 'Menyimpan…' : 'Simpan catatan'}
                        </Button>
                    </>
                }
            >
                <form id="note-form" onSubmit={saveNote} className="space-y-3">
                    <Field label="Judul" required htmlFor="note-title">
                        <Input id="note-title" value={note.title} onChange={(event) => setNote({ ...note, title: event.target.value })} required />
                    </Field>
                    <Field label="Ringkasan yang boleh dilihat siswa" htmlFor="note-summary" hint="Hanya ringkasan ini yang tampil di halaman siswa bila diizinkan.">
                        <Textarea id="note-summary" rows={2} value={note.summary} onChange={(event) => setNote({ ...note, summary: event.target.value })} />
                    </Field>
                    <Field label="Isi catatan" required htmlFor="note-content" hint="Terenkripsi dan hanya dapat dibaca Guru BK.">
                        <Textarea id="note-content" rows={5} value={note.content} onChange={(event) => setNote({ ...note, content: event.target.value })} required />
                    </Field>
                    <label className="flex min-h-11 items-center gap-2 text-[12px]">
                        <input
                            type="checkbox"
                            checked={note.visible_to_student}
                            onChange={(event) => setNote({ ...note, visible_to_student: event.target.checked })}
                            className="h-[18px] w-[18px] accent-[#3f51b5]"
                        />
                        Izinkan siswa melihat ringkasan ini
                    </label>
                </form>
            </Sheet>
        </AppShell>
    );
}
