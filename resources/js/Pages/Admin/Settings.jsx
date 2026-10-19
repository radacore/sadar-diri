import { useCallback, useEffect, useState } from 'react';
import { Button, Card, CardTitle, Field, Input, Skeleton, useConfirm, useToast } from '../../Components/UI';
import AppShell from '../../Layouts/AppShell';
import { api } from '../../lib/api';

export default function Settings() {
    const toast = useToast();
    const confirm = useConfirm();
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            const response = await api.get('/api/admin/settings');
            setSettings(response.data);
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        load();
    }, [load]);

    const save = async () => {
        const decision = await confirm({
            title: 'Simpan pengaturan?',
            description: 'Perubahan berlaku untuk seluruh pengguna: identitas sekolah, notifikasi, privasi, dan fitur.',
            confirmLabel: 'Simpan perubahan',
            tone: 'warning',
            icon: 'shield',
        });
        if (!decision) return;
        setBusy(true);

        try {
            await api.put('/api/admin/settings', {
                whatsapp_number: settings.school.whatsapp_number,
                reminder_hour: Number(settings.notification.reminder_hour),
                digest_hour: Number(settings.notification.digest_hour),
                retention_years_after_graduation: Number(settings.privacy.retention_years_after_graduation),
                consent_version: settings.privacy.consent_version,
                feature: settings.feature,
                school: {
                    name: settings.school.name,
                    npsn: settings.school.npsn,
                    address: settings.school.address,
                    timezone: settings.school.timezone,
                    service_hours: settings.school.service_hours,
                },
            });
            toast.push('Konfigurasi tersimpan.');
            await load();
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <AppShell
            title="Pengaturan"
            subtitle="Identitas sekolah, notifikasi, privasi, dan fitur"
            actions={<Button variant="primary" onClick={save} disabled={busy || !settings}>{busy ? 'Menyimpan…' : 'Simpan perubahan'}</Button>}
        >
            {loading || !settings ? <Skeleton rows={6} /> : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
                    <Card className="lg:col-span-6">
                        <CardTitle>Identitas sekolah</CardTitle>
                        <div className="space-y-3">
                            <Field label="Nama sekolah" htmlFor="name">
                                <Input id="name" value={settings.school.name ?? ''} onChange={(event) => setSettings({ ...settings, school: { ...settings.school, name: event.target.value } })} />
                            </Field>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="NPSN" htmlFor="npsn">
                                    <Input id="npsn" value={settings.school.npsn ?? ''} onChange={(event) => setSettings({ ...settings, school: { ...settings.school, npsn: event.target.value } })} />
                                </Field>
                                <Field label="Zona waktu" htmlFor="timezone">
                                    <Input id="timezone" value={settings.school.timezone ?? ''} onChange={(event) => setSettings({ ...settings, school: { ...settings.school, timezone: event.target.value } })} />
                                </Field>
                            </div>
                            <Field label="Alamat" htmlFor="address">
                                <Input id="address" value={settings.school.address ?? ''} onChange={(event) => setSettings({ ...settings, school: { ...settings.school, address: event.target.value } })} />
                            </Field>
                            <Field label="Nomor WhatsApp layanan BK" htmlFor="wa" hint="Format internasional tanpa tanda plus, mis. 6281234567890.">
                                <Input id="wa" value={settings.school.whatsapp_number ?? ''} onChange={(event) => setSettings({ ...settings, school: { ...settings.school, whatsapp_number: event.target.value } })} />
                            </Field>
                            <Field label="Jam layanan" htmlFor="hours">
                                <Input id="hours" value={settings.school.service_hours ?? ''} onChange={(event) => setSettings({ ...settings, school: { ...settings.school, service_hours: event.target.value } })} />
                            </Field>
                        </div>
                    </Card>

                    <Card className="lg:col-span-6">
                        <CardTitle>Notifikasi & privasi</CardTitle>
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Jam ringkasan harian" htmlFor="digest">
                                    <Input id="digest" type="number" min={5} max={10} value={settings.notification.digest_hour ?? 7} onChange={(event) => setSettings({ ...settings, notification: { ...settings.notification, digest_hour: event.target.value } })} />
                                </Field>
                                <Field label="Jam pengingat siswa" htmlFor="reminder">
                                    <Input id="reminder" type="number" min={6} max={21} value={settings.notification.reminder_hour ?? 19} onChange={(event) => setSettings({ ...settings, notification: { ...settings.notification, reminder_hour: event.target.value } })} />
                                </Field>
                            </div>
                            <Field label="Versi kebijakan consent" htmlFor="consent" hint="Mengubah versi akan meminta persetujuan ulang.">
                                <Input id="consent" value={settings.privacy.consent_version ?? ''} onChange={(event) => setSettings({ ...settings, privacy: { ...settings.privacy, consent_version: event.target.value } })} />
                            </Field>
                            <Field label="Retensi setelah lulus (tahun)" htmlFor="retention">
                                <Input id="retention" type="number" min={1} max={10} value={settings.privacy.retention_years_after_graduation ?? 3} onChange={(event) => setSettings({ ...settings, privacy: { ...settings.privacy, retention_years_after_graduation: event.target.value } })} />
                            </Field>
                        </div>

                        <CardTitle>
                            <span className="mt-4 block">Fitur</span>
                        </CardTitle>
                        <div className="space-y-2">
                            {[
                                ['journaling', 'Jurnal emosi'],
                                ['portfolio', 'Portofolio prestasi'],
                                ['reflection', 'Ruang refleksi'],
                                ['whatsapp_escalation', 'Eskalasi WhatsApp'],
                            ].map(([key, text]) => (
                                <label key={key} className="flex items-center justify-between gap-3 rounded-xl bg-[#f1f5f9] p-3 text-[12px]">
                                    <span>{text}</span>
                                    <input
                                        type="checkbox"
                                        checked={Boolean(settings.feature[key])}
                                        onChange={(event) => setSettings({ ...settings, feature: { ...settings.feature, [key]: event.target.checked } })}
                                        className="h-[18px] w-[18px] accent-[#3f51b5]"
                                    />
                                </label>
                            ))}
                        </div>
                    </Card>
                </div>
            )}
        </AppShell>
    );
}
