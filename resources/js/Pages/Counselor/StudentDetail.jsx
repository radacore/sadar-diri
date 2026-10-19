import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, CardTitle, Field, Input, Modal, Skeleton, Stat, Textarea, useConfirm, useToast } from '../../Components/UI';
import AppShell from '../../Layouts/AppShell';
import { api } from '../../lib/api';
import { formatDate, label, relative } from '../../lib/format';

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

    const load = useCallback(async () => {
        try {
            const [overviewResponse, journalResponse, reflectionResponse] = await Promise.all([
                api.get(`/api/counselor/students/${studentId}/overview`),
                api.get(`/api/counselor/students/${studentId}/journals`),
                api.get(`/api/counselor/students/${studentId}/reflections`),
            ]);
            setOverview(overviewResponse.data);
            setJournals(journalResponse.data ?? []);
            setReflections(reflectionResponse.data ?? []);
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [studentId, toast]);

    useEffect(() => {
        load();
    }, [load]);

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

    return (
        <AppShell
            title={overview?.student?.name ?? 'Profil siswa'}
            subtitle={`${overview?.student?.identity_number ?? ''} · ${overview?.student?.class?.name ?? '—'}`}
            actions={
                <>
                    <Button variant="outline" onClick={() => (window.location.href = '/bk/siswa')}>Kembali</Button>
                    <Button onClick={() => setNoteOpen(true)}>Tulis catatan</Button>
                </>
            }
        >
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
                <Card className="lg:col-span-3"><Stat label="Aktivitas" value={relative(overview.activity.last_activity_at)} hint={`${overview.activity.journal_streak_days} hari menulis`} /></Card>
                <Card className="lg:col-span-3"><Stat label="Mood 7 hari" value={`${overview.activity.mood_7d.positive_days}/${overview.activity.mood_7d.negative_days}`} hint="positif / negatif" /></Card>
                <Card className="lg:col-span-3"><Stat label="Prestasi" value={overview.portfolio.total} hint={`${overview.portfolio.verified} terverifikasi`} /></Card>
                <Card className="lg:col-span-3"><Stat label="Alert terbuka" value={overview.open_alerts} hint="Perlu tindak lanjut" tone={overview.open_alerts > 0 ? 'danger' : 'default'} /></Card>

                <Card className="lg:col-span-5">
                    <CardTitle>Profil diri</CardTitle>
                    <div className="space-y-2 text-[12px]">
                        <p><span className="font-semibold">Gambaran psikis:</span> {overview.profile.psychological_summary || '—'}</p>
                        <p><span className="font-semibold">Kelebihan:</span> {overview.profile.strengths || '—'}</p>
                        <p><span className="font-semibold">Kekurangan:</span> {overview.profile.weaknesses || '—'}</p>
                        <p className="text-[11px] text-[#5b6b7f]">Kelengkapan profil {overview.profile.completeness_percent}% · {overview.profile.published_at ? `dipublikasikan ${formatDate(overview.profile.published_at)}` : 'belum dipublikasikan'}</p>
                    </div>
                </Card>

                <Card className="lg:col-span-7">
                    <CardTitle action={<span className="text-[11px] text-[#475569]">{journals.length} entri</span>}>Jurnal</CardTitle>
                    {journals.length === 0 ? (
                        <p className="text-[12px] text-[#475569]">Belum ada jurnal.</p>
                    ) : (
                        <ul className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                            {journals.map((entry) => (
                                <li key={entry.id} className="rounded-[14px] bg-[#f8fafc] p-3">
                                    <div className="mb-1 flex items-center gap-2">
                                        <Badge tone="info">{label('journal', entry.type)}</Badge>
                                        <span className="text-[11px] text-[#475569]">{formatDate(entry.entry_date)}</span>
                                        {entry.is_flagged ? <Badge tone="danger">Perlu perhatian</Badge> : null}
                                    </div>
                                    {entry.type === 'abc' ? (
                                        <div className="space-y-1 text-[12px]">
                                            <p><span className="font-semibold">A:</span> {entry.activating_event}</p>
                                            <p><span className="font-semibold">B:</span> {entry.belief}</p>
                                            <p><span className="font-semibold">C:</span> {entry.consequence}</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-1 text-[12px]">
                                            <p><span className="font-semibold">Bersyukur:</span> {entry.gratitude_text || '—'}</p>
                                            <p><span className="font-semibold">Bahagia:</span> {entry.happiness_text || '—'}</p>
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                    <p className="mt-2 text-[11px] text-[#5b6b7f]">Setiap pembukaan data tercatat di audit log dan terlihat oleh siswa.</p>
                </Card>

                <Card className="lg:col-span-5">
                    <CardTitle>Refleksi</CardTitle>
                    {reflections.length === 0 ? (
                        <p className="text-[12px] text-[#475569]">Belum ada refleksi.</p>
                    ) : (
                        <ul className="space-y-2">
                            {reflections.map((item) => (
                                <li key={item.id} className="flex items-center justify-between gap-2 border-b border-[#e2e8f0] pb-2 text-[12px] last:border-0">
                                    <div>
                                        <p className="font-semibold">{label('reflection', item.type)}</p>
                                        <p className="text-[11px] text-[#475569]">{item.week_start ? formatDate(item.week_start) : formatDate(item.submitted_at)}</p>
                                    </div>
                                    <Badge tone={item.has_feedback ? 'success' : 'neutral'}>{item.has_feedback ? 'Ada umpan balik' : label('reflectionStatus', item.status)}</Badge>
                                </li>
                            ))}
                        </ul>
                    )}
                    <Button variant="outline" className="mt-3" onClick={() => (window.location.href = '/bk/refleksi')}>Buat sesi refleksi</Button>
                </Card>
            </div>

            <Modal
                open={noteOpen}
                onClose={() => setNoteOpen(false)}
                title="Catatan konseling"
                wide
                footer={
                    <>
                        <Button variant="outline" onClick={() => setNoteOpen(false)}>Batal</Button>
                        <Button type="submit" form="note-form" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan catatan'}</Button>
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
                    <label className="flex items-center gap-2 text-[12px]">
                        <input
                            type="checkbox"
                            checked={note.visible_to_student}
                            onChange={(event) => setNote({ ...note, visible_to_student: event.target.checked })}
                            className="h-[18px] w-[18px] accent-[#3f51b5]"
                        />
                        Izinkan siswa melihat ringkasan ini
                    </label>
                </form>
            </Modal>
        </AppShell>
    );
}
