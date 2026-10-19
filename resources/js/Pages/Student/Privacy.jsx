import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, CardTitle, EmptyState, Field, Input, Skeleton, useConfirm, useToast } from '../../Components/UI';
import AppShell from '../../Layouts/AppShell';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/format';

export default function Privacy() {
    const toast = useToast();
    const confirm = useConfirm();
    const [logs, setLogs] = useState([]);
    const [summaries, setSummaries] = useState([]);
    const [preferences, setPreferences] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            const [logResponse, summaryResponse, preferenceResponse] = await Promise.all([
                api.get('/api/student/privacy/access-log'),
                api.get('/api/student/counseling-summaries'),
                api.get('/api/student/preferences/reminders'),
            ]);
            setLogs(logResponse.data ?? []);
            setSummaries(summaryResponse.data ?? []);
            setPreferences(preferenceResponse.data);
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        load();
    }, [load]);

    const savePreferences = async () => {
        const decision = await confirm({
            title: 'Simpan preferensi?',
            description: 'Pengaturan pengingat akan diperbarui.',
            confirmLabel: 'Simpan preferensi',
            tone: 'primary',
            icon: 'bell',
        });
        if (!decision) return;
        setBusy(true);
        try {
            await api.put('/api/student/preferences/reminders', {
                mood_reminder_enabled: preferences.mood_reminder_enabled,
                mood_reminder_hour: Number(preferences.mood_reminder_hour),
                reflection_reminder_enabled: preferences.reflection_reminder_enabled,
            });
            toast.push('Preferensi pengingat tersimpan.');
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setBusy(false);
        }
    };

    const revoke = async () => {
        const decision = await confirm({
            title: 'Cabut persetujuan?',
            description: 'Fitur jurnal dan portofolio akan terkunci, dan data akan diproses untuk penghapusan.',
            confirmLabel: 'Cabut persetujuan',
            tone: 'danger',
            icon: 'shield',
            requireReason: 'Alasan mencabut persetujuan',
        });
        if (!decision) return;

        try {
            await api.delete('/api/auth/consent');
            toast.push('Persetujuan dicabut.');
            setTimeout(() => {
                window.location.href = '/masuk';
            }, 1200);
        } catch (error) {
            toast.push(error.message, 'error');
        }
    };

    return (
        <AppShell title="Privasi & data saya" subtitle="Siapa yang melihat data Anda dan pengaturan pengingat">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
                <Card className="lg:col-span-7">
                    <CardTitle>Siapa yang melihat data saya</CardTitle>
                    {loading ? <Skeleton rows={4} /> : logs.length === 0 ? (
                        <EmptyState title="Belum ada akses" description="Belum ada Guru BK yang membuka data Anda." />
                    ) : (
                        <ul className="space-y-2">
                            {logs.map((log, index) => (
                                <li key={`${log.action}-${index}`} className="flex items-center justify-between gap-2 border-b border-[#e2e8f0] pb-2 last:border-0">
                                    <div>
                                        <p className="text-[13px] font-semibold">
                                            {log.action === 'journal.viewed' ? 'Jurnal dibuka' : log.action === 'reflection.viewed' ? 'Refleksi dibuka' : 'Catatan dibuka'} oleh {log.actor_name ?? 'sistem'}
                                        </p>
                                        <p className="text-[11px] text-[#475569]">{formatDate(log.created_at, true)}</p>
                                    </div>
                                    <Badge tone="neutral">Tercatat</Badge>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>

                <Card className="lg:col-span-5">
                    <CardTitle>Riwayat masalah</CardTitle>
                    {summaries.length === 0 ? (
                        <p className="text-[12px] text-[#475569]">Belum ada ringkasan dari Guru BK.</p>
                    ) : (
                        <ul className="space-y-2">
                            {summaries.map((item) => (
                                <li key={item.id} className="rounded-[14px] bg-[#f1f5f9] p-3">
                                    <p className="text-[13px] font-semibold">{item.title}</p>
                                    <p className="text-[11px] text-[#475569]">{formatDate(item.occurred_at)} · {item.status === 'open' ? 'Berlangsung' : 'Selesai'}</p>
                                    <p className="mt-1 text-[12px]">{item.summary}</p>
                                </li>
                            ))}
                        </ul>
                    )}
                    <p className="mt-3 text-[11px] text-[#5b6b7f]">
                        Catatan internal Guru BK tidak ditampilkan. Hanya ringkasan yang ditandai dapat dilihat siswa.
                    </p>
                </Card>

                <Card className="lg:col-span-6">
                    <CardTitle>Pengingat</CardTitle>
                    {loading || !preferences ? <Skeleton rows={3} /> : (
                        <div className="space-y-3">
                            <label className="flex items-center justify-between gap-3 rounded-xl bg-[#f1f5f9] p-3 text-[12px]">
                                <span>Pengingat mood harian</span>
                                <input
                                    type="checkbox"
                                    checked={Boolean(preferences.mood_reminder_enabled)}
                                    onChange={(event) => setPreferences({ ...preferences, mood_reminder_enabled: event.target.checked })}
                                    className="h-[18px] w-[18px] accent-[#3f51b5]"
                                />
                            </label>
                            <Field label="Jam pengingat (06–21)" htmlFor="hour">
                                <Input
                                    id="hour"
                                    type="number"
                                    min={6}
                                    max={21}
                                    value={preferences.mood_reminder_hour}
                                    onChange={(event) => setPreferences({ ...preferences, mood_reminder_hour: event.target.value })}
                                />
                            </Field>
                            <label className="flex items-center justify-between gap-3 rounded-xl bg-[#f1f5f9] p-3 text-[12px]">
                                <span>Pengingat refleksi akhir pekan</span>
                                <input
                                    type="checkbox"
                                    checked={Boolean(preferences.reflection_reminder_enabled)}
                                    onChange={(event) => setPreferences({ ...preferences, reflection_reminder_enabled: event.target.checked })}
                                    className="h-[18px] w-[18px] accent-[#3f51b5]"
                                />
                            </label>
                            <div className="flex justify-end">
                                <Button onClick={savePreferences} disabled={busy}>Simpan preferensi</Button>
                            </div>
                        </div>
                    )}
                </Card>

                <Card className="lg:col-span-6">
                    <CardTitle>Persetujuan</CardTitle>
                    <p className="text-[12px] leading-relaxed text-[#475569]">
                        Anda menyetujui pemrosesan data psikologis untuk layanan BK. Data dienkripsi, hanya dibaca Guru BK
                        kelas Anda, dan tidak dapat dibuka Superadmin. Pencabutan akan menonaktifkan fitur jurnal dan
                        mengajukan penghapusan data.
                    </p>
                    <div className="mt-3 rounded-xl bg-[#fee2e2] p-3 text-[11px] text-[#991b1b]">
                        Tindakan ini tidak dapat dibatalkan dari akun Anda. Hubungi Guru BK bila ingin mengaktifkan kembali.
                    </div>
                    <div className="mt-3 flex justify-end">
                        <Button variant="danger" onClick={revoke}>Cabut persetujuan</Button>
                    </div>
                </Card>
            </div>
        </AppShell>
    );
}
