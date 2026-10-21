import { router, usePage } from '@inertiajs/react';
import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../../Components/Icons';
import { Badge, Button, Card, EmptyState, Field, HeroCard, Input, ListRow, PageSection, Skeleton, useConfirm, useToast } from '../../Components/UI';
import AppShell from '../../Layouts/AppShell';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/format';

function Switch({ checked, onChange, label, hint, icon }) {
    return (
        <label className="flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-2xl bg-[#f8fafc] px-3 py-2">
            <span className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#3f51b5]">
                    <Icon name={icon} size={17} />
                </span>
                <span className="min-w-0">
                    <span className="block text-[12.5px] font-semibold leading-snug">{label}</span>
                    {hint ? <span className="mt-0.5 block text-[11px] leading-snug text-[#64748b]">{hint}</span> : null}
                </span>
            </span>
            <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
                <input type="checkbox" className="peer sr-only" checked={checked} onChange={onChange} />
                <span className="absolute inset-0 rounded-full bg-[#cbd5e1] transition peer-checked:bg-[#3f51b5]" aria-hidden="true" />
                <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition peer-checked:translate-x-5" aria-hidden="true" />
            </span>
        </label>
    );
}

export default function Privacy() {
    const { auth } = usePage().props;
    const toast = useToast();
    const confirm = useConfirm();
    const [logs, setLogs] = useState([]);
    const [summaries, setSummaries] = useState([]);
    const [preferences, setPreferences] = useState(null);
    const [consent, setConsent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            const [logResponse, summaryResponse, preferenceResponse, consentResponse] = await Promise.all([
                api.get('/api/student/privacy/access-log'),
                api.get('/api/student/counseling-summaries'),
                api.get('/api/student/preferences/reminders'),
                api.get('/api/student/privacy/consent'),
            ]);
            setLogs(logResponse.data ?? []);
            setSummaries(summaryResponse.data ?? []);
            setPreferences(preferenceResponse.data);
            setConsent(consentResponse.data);
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
                channel: preferences.channel,
            });
            toast.push('Preferensi pengingat tersimpan.');
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setBusy(false);
        }
    };

    const activate = async () => {
        const version = consent?.version;

        if (!version) {
            toast.push('Versi kebijakan belum tersedia. Muat ulang halaman.', 'error');
            return;
        }

        const decision = await confirm({
            title: 'Aktifkan persetujuan?',
            description: 'Jurnal, refleksi, dan portofolio akan dapat dipakai kembali dengan data yang tersimpan.',
            details: [{ label: 'Versi kebijakan', value: version }],
            confirmLabel: 'Aktifkan',
            tone: 'primary',
            icon: 'shield',
        });
        if (!decision) return;

        setBusy(true);

        try {
            const response = await api.post('/api/auth/consent', { version, accepted: true });
            setConsent({
                version: response.data?.consent_version ?? version,
                has_consent: true,
                consented_at: response.data?.consented_at ?? new Date().toISOString(),
            });
            toast.push('Persetujuan aktif kembali.');
            router.reload({ only: ['auth'] });
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

        setBusy(true);

        try {
            await api.delete('/api/auth/consent');
            setConsent({ ...(consent ?? {}), has_consent: false, consented_at: null });
            toast.push('Persetujuan dicabut.');
            router.reload({ only: ['auth'] });
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setBusy(false);
        }
    };

    const channelEnabled = preferences?.channel !== 'in_app';
    const hasConsent = consent ? consent.has_consent : Boolean(auth?.user?.has_consent);

    return (
        <AppShell title="Privasi & data saya" subtitle="Siapa yang melihat data Anda dan pengaturan pengingat">
            <div className="space-y-5">
                <HeroCard
                    tone="soft"
                    eyebrow="Persetujuan data"
                    title={hasConsent ? 'Persetujuan aktif' : 'Persetujuan tidak aktif'}
                    description="Data psikologis diproses untuk layanan BK, dienkripsi, dan hanya dibaca Guru BK kelas Anda."
                >
                    <div className="mt-4 flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                            <Badge tone={hasConsent ? 'success' : 'danger'}>{hasConsent ? 'Aktif' : 'Tidak aktif'}</Badge>
                            <span className="text-[11px] leading-snug text-[#64748b]">
                                {hasConsent ? 'Dapat dicabut kapan saja.' : 'Aktifkan sendiri kapan saja, tanpa menunggu Guru BK.'}
                            </span>
                        </div>
                        {hasConsent ? (
                            <Button variant="danger" className="h-11 w-full" onClick={revoke} disabled={busy}>Cabut persetujuan</Button>
                        ) : (
                            <Button variant="success" className="h-11 w-full" onClick={activate} disabled={busy}>
                                {busy ? 'Mengaktifkan…' : 'Aktifkan persetujuan'}
                            </Button>
                        )}
                    </div>
                </HeroCard>

                <Card>
                    <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                            <h2 className="text-[16px] font-bold leading-tight">Pengingat</h2>
                            <p className="mt-0.5 text-[11px] text-[#64748b]">Atur kapan Anda ingin diingatkan.</p>
                        </div>
                        <Icon name="bell" size={18} className="mt-0.5 shrink-0 text-[#3f51b5]" />
                    </div>

                    {loading || !preferences ? <Skeleton rows={4} /> : (
                        <div className="space-y-2">
                            <Switch
                                icon="sparkle"
                                label="Pengingat mood harian"
                                hint="Catat mood sekali sehari."
                                checked={Boolean(preferences.mood_reminder_enabled)}
                                onChange={(event) => setPreferences({ ...preferences, mood_reminder_enabled: event.target.checked })}
                            />
                            <Switch
                                icon="book"
                                label="Pengingat refleksi akhir pekan"
                                hint="Isi refleksi mandiri tiap pekan."
                                checked={Boolean(preferences.reflection_reminder_enabled)}
                                onChange={(event) => setPreferences({ ...preferences, reflection_reminder_enabled: event.target.checked })}
                            />
                            <Switch
                                icon="bell"
                                label="Kanal notifikasi"
                                hint={channelEnabled ? 'Email dan dalam aplikasi.' : 'Hanya dalam aplikasi.'}
                                checked={channelEnabled}
                                onChange={(event) => setPreferences({ ...preferences, channel: event.target.checked ? 'email_and_in_app' : 'in_app' })}
                            />
                            <div className="pt-1">
                                <Field label="Jam pengingat (06–21)" htmlFor="hour">
                                    <Input
                                        id="hour"
                                        className="h-11"
                                        type="number"
                                        min={6}
                                        max={21}
                                        value={preferences.mood_reminder_hour}
                                        onChange={(event) => setPreferences({ ...preferences, mood_reminder_hour: event.target.value })}
                                    />
                                </Field>
                            </div>
                            <Button className="mt-1 h-11 w-full" onClick={savePreferences} disabled={busy}>Simpan preferensi</Button>
                        </div>
                    )}
                </Card>

                <div>
                    <PageSection title="Log akses">
                        {loading ? <Skeleton rows={4} /> : logs.length === 0 ? (
                            <EmptyState title="Belum ada akses" description="Belum ada Guru BK yang membuka data Anda." />
                        ) : (
                            <div className="space-y-2">
                                {logs.map((log, index) => (
                                    <ListRow
                                        key={`${log.action}-${index}`}
                                        leading={
                                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f1f5f9] text-[#475569]">
                                                <Icon name={log.action === 'journal.viewed' ? 'book' : log.action === 'reflection.viewed' ? 'clock' : 'file'} size={17} />
                                            </span>
                                        }
                                        title={log.actor_name ?? 'Sistem'}
                                        subtitle={log.action === 'journal.viewed' ? 'Membuka jurnal' : log.action === 'reflection.viewed' ? 'Membuka refleksi' : 'Membuka catatan'}
                                        meta={<span className="text-[11px] text-[#64748b]">{formatDate(log.created_at, true)}</span>}
                                        trailing={<Badge tone="neutral">Tercatat</Badge>}
                                    />
                                ))}
                            </div>
                        )}
                    </PageSection>
                </div>

                <div>
                    <PageSection title="Riwayat masalah">
                        {summaries.length === 0 ? (
                            <p className="text-[12px] text-[#475569]">Belum ada ringkasan dari Guru BK.</p>
                        ) : (
                            <div className="space-y-2">
                                {summaries.map((item) => (
                                    <div key={item.id} className="rounded-[18px] border border-[#e2e8f0] bg-white p-3.5">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className="text-[13px] font-semibold leading-snug">{item.title}</p>
                                            <Badge tone={item.status === 'open' ? 'warning' : 'neutral'}>
                                                {item.status === 'open' ? 'Berlangsung' : 'Selesai'}
                                            </Badge>
                                        </div>
                                        <p className="mt-0.5 text-[11px] text-[#64748b]">{formatDate(item.occurred_at)}</p>
                                        <p className="mt-1.5 text-[12px] leading-relaxed">{item.summary}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                        <p className="text-[11px] leading-snug text-[#5b6b7f]">
                            Catatan internal Guru BK tidak ditampilkan. Hanya ringkasan yang ditandai dapat dilihat siswa.
                        </p>
                    </PageSection>
                </div>
            </div>
        </AppShell>
    );
}
