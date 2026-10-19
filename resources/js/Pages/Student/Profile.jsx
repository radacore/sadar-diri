import { usePage } from '@inertiajs/react';
import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../../Components/Icons';
import { Button, Card, Field, HeroCard, Input, ListRow, PageSection, ProgressRing, Select, Skeleton, Textarea, useConfirm, useToast } from '../../Components/UI';
import AppShell from '../../Layouts/AppShell';
import { api } from '../../lib/api';
import { formatDate, initials } from '../../lib/format';

export default function Profile() {
    const { auth } = usePage().props;
    const user = auth.user;
    const toast = useToast();
    const confirm = useConfirm();
    const [loading, setLoading] = useState(true);
    const [biodata, setBiodata] = useState({});
    const [self, setSelf] = useState({});
    const [completeness, setCompleteness] = useState(0);
    const [versions, setVersions] = useState([]);
    const [openSection, setOpenSection] = useState('biodata');
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            const [profile, versionList] = await Promise.all([
                api.get('/api/student/profile'),
                api.get('/api/student/profile/versions'),
            ]);
            setBiodata(profile.data.biodata ?? {});
            setSelf(profile.data.self_profile ?? {});
            setCompleteness(profile.data.completeness_percent ?? 0);
            setVersions(versionList.data ?? []);
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        load();
    }, [load]);

    const saveBiodata = async (event) => {
        event.preventDefault();
        const decision = await confirm({
            title: 'Simpan biodata?',
            description: 'Perubahan biodata akan disimpan.',
            confirmLabel: 'Simpan biodata',
            tone: 'primary',
            icon: 'check',
        });
        if (!decision) return;
        setBusy(true);
        try {
            const response = await api.put('/api/student/profile/biodata', biodata);
            setCompleteness(response.data.completeness_percent);
            toast.push('Biodata tersimpan.');
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setBusy(false);
        }
    };

    const saveSelf = async (publish) => {
        const decision = await confirm(publish ? {
            title: 'Publikasikan profil?',
            description: 'Guru BK kelas Anda akan dapat membaca profil diri ini.',
            confirmLabel: 'Publikasikan',
            tone: 'success',
            icon: 'send',
        } : {
            title: 'Simpan draf?',
            description: 'Profil diri akan disimpan sebagai draf dan belum dapat dibaca Guru BK.',
            confirmLabel: 'Simpan draf',
            tone: 'warning',
            icon: 'file',
        });
        if (!decision) return;
        setBusy(true);
        try {
            const response = await api.put('/api/student/profile/self', { ...self, publish });
            toast.push(publish ? 'Profil dipublikasikan ke Guru BK.' : 'Draf profil tersimpan.');
            setSelf({ ...self, version: response.data.version, published_at: response.data.published_at });
            await load();
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setBusy(false);
        }
    };

    const toggleSection = (section) => {
        setOpenSection((current) => (current === section ? null : section));
    };

    return (
        <AppShell title="Info diri" subtitle="Biodata dan profil diri Anda">
            <div className="space-y-5">
                <HeroCard
                    eyebrow="Profil siswa"
                    title={user?.name ?? 'Siswa'}
                    description={`NIS ${user?.identity_number ?? '—'}`}
                >
                    <div className="mt-4 flex items-center gap-3">
                        <span className="sd-avatar flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-[22px] font-bold">
                            {initials(user?.name)}
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">Kelengkapan profil</p>
                            <p className="mt-0.5 text-[12px] leading-snug text-[#475569]">
                                Lengkapi agar Guru BK dapat mendampingi lebih tepat.
                            </p>
                        </div>
                        <ProgressRing value={completeness} size={68} stroke={7} label={`${completeness}%`} />
                    </div>
                </HeroCard>

                <div className="space-y-3">
                    <Card>
                        <button
                            type="button"
                            onClick={() => toggleSection('biodata')}
                            aria-expanded={openSection === 'biodata'}
                            className="flex min-h-11 w-full items-center gap-3 text-left"
                        >
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e8eaf6] text-[#3f51b5]">
                                <Icon name="user" size={18} />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-[15px] font-bold leading-tight">Biodata</span>
                                <span className="mt-0.5 block text-[11px] text-[#64748b]">Data dasar dan kesehatan</span>
                            </span>
                            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f1f5f9] text-[#475569] transition ${openSection === 'biodata' ? 'rotate-180' : ''}`}>
                                <Icon name="chevron" size={18} />
                            </span>
                        </button>

                        {openSection === 'biodata' ? (
                            <div className="mt-4">
                                {loading ? <Skeleton rows={6} /> : (
                                    <form onSubmit={saveBiodata} className="space-y-3">
                                        <div className="grid gap-3">
                                            <Field label="Tanggal lahir" htmlFor="birth_date">
                                                <Input id="birth_date" className="h-11" type="date" value={biodata.birth_date ?? ''} onChange={(e) => setBiodata({ ...biodata, birth_date: e.target.value })} />
                                            </Field>
                                            <Field label="Jenis kelamin" htmlFor="gender">
                                                <Select id="gender" className="h-11" value={biodata.gender ?? ''} onChange={(e) => setBiodata({ ...biodata, gender: e.target.value })}>
                                                    <option value="">Pilih</option>
                                                    <option value="male">Laki-laki</option>
                                                    <option value="female">Perempuan</option>
                                                </Select>
                                            </Field>
                                            <Field label="Nomor kontak" htmlFor="phone">
                                                <Input id="phone" className="h-11" value={biodata.phone ?? ''} onChange={(e) => setBiodata({ ...biodata, phone: e.target.value })} placeholder="08xxxxxxxxxx" />
                                            </Field>
                                            <Field label="Golongan darah" htmlFor="blood_type">
                                                <Input id="blood_type" className="h-11" value={biodata.blood_type ?? ''} onChange={(e) => setBiodata({ ...biodata, blood_type: e.target.value })} maxLength={3} />
                                            </Field>
                                            <Field label="Tinggi (cm)" htmlFor="height_cm">
                                                <Input id="height_cm" className="h-11" type="number" value={biodata.height_cm ?? ''} onChange={(e) => setBiodata({ ...biodata, height_cm: e.target.value })} />
                                            </Field>
                                            <Field label="Berat (kg)" htmlFor="weight_kg">
                                                <Input id="weight_kg" className="h-11" type="number" value={biodata.weight_kg ?? ''} onChange={(e) => setBiodata({ ...biodata, weight_kg: e.target.value })} />
                                            </Field>
                                        </div>
                                        <Field label="Alamat" htmlFor="address">
                                            <Textarea id="address" rows={2} value={biodata.address ?? ''} onChange={(e) => setBiodata({ ...biodata, address: e.target.value })} />
                                        </Field>
                                        <Field label="Riwayat penyakit" htmlFor="medical_history" hint="Data sensitif. Hanya Guru BK kelas Anda yang dapat melihat.">
                                            <Textarea id="medical_history" rows={2} value={biodata.medical_history ?? ''} onChange={(e) => setBiodata({ ...biodata, medical_history: e.target.value })} />
                                        </Field>
                                        <Field label="Catatan kesehatan" htmlFor="health_notes">
                                            <Textarea id="health_notes" rows={2} value={biodata.health_notes ?? ''} onChange={(e) => setBiodata({ ...biodata, health_notes: e.target.value })} />
                                        </Field>
                                        <Button type="submit" className="h-11 w-full" disabled={busy}>Simpan biodata</Button>
                                    </form>
                                )}
                            </div>
                        ) : null}
                    </Card>

                    <Card>
                        <button
                            type="button"
                            onClick={() => toggleSection('self')}
                            aria-expanded={openSection === 'self'}
                            className="flex min-h-11 w-full items-center gap-3 text-left"
                        >
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e8eaf6] text-[#3f51b5]">
                                <Icon name="sparkle" size={18} />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-[15px] font-bold leading-tight">Profil diri</span>
                                <span className="mt-0.5 block text-[11px] text-[#64748b]">
                                    Versi {self.version ?? 1}{self.published_at ? ` · terbit ${formatDate(self.published_at)}` : ' · draf'}
                                </span>
                            </span>
                            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f1f5f9] text-[#475569] transition ${openSection === 'self' ? 'rotate-180' : ''}`}>
                                <Icon name="chevron" size={18} />
                            </span>
                        </button>

                        {openSection === 'self' ? (
                            <div className="mt-4">
                                {loading ? <Skeleton rows={4} /> : (
                                    <div className="space-y-3">
                                        <div className="grid gap-3">
                                            <Field label="Gambaran psikis" htmlFor="psychological">
                                                <Textarea id="psychological" rows={3} value={self.psychological_summary ?? ''} onChange={(e) => setSelf({ ...self, psychological_summary: e.target.value })} placeholder="Bagaimana kamu menggambarkan dirimu akhir-akhir ini?" />
                                            </Field>
                                            <Field label="Karakter" htmlFor="character">
                                                <Textarea id="character" rows={3} value={self.character_summary ?? ''} onChange={(e) => setSelf({ ...self, character_summary: e.target.value })} />
                                            </Field>
                                            <Field label="Kelebihan" htmlFor="strengths">
                                                <Textarea id="strengths" rows={3} value={self.strengths ?? ''} onChange={(e) => setSelf({ ...self, strengths: e.target.value })} />
                                            </Field>
                                            <Field label="Kekurangan" htmlFor="weaknesses">
                                                <Textarea id="weaknesses" rows={3} value={self.weaknesses ?? ''} onChange={(e) => setSelf({ ...self, weaknesses: e.target.value })} />
                                            </Field>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="warning" className="h-11 flex-1" onClick={() => saveSelf(false)} disabled={busy}>Simpan draf</Button>
                                            <Button variant="success" className="h-11 flex-1" onClick={() => saveSelf(true)} disabled={busy}>Publikasikan</Button>
                                        </div>
                                        <p className="text-[11px] leading-snug text-[#5b6b7f]">
                                            Draf hanya terlihat oleh Anda. Publikasi membuka profil diri untuk Guru BK kelas Anda.
                                        </p>
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </Card>
                </div>

                <div>
                    <PageSection title="Riwayat versi">
                        {versions.length === 0 ? (
                            <p className="text-[12px] text-[#475569]">Belum ada versi tersimpan.</p>
                        ) : (
                            <div className="space-y-2">
                                {versions.slice(0, 5).map((version) => (
                                    <ListRow
                                        key={version.version}
                                        leading={
                                            <span className="flex h-9 min-w-[36px] items-center justify-center rounded-full bg-[#f1f5f9] px-2 text-[11px] font-bold text-[#475569]">
                                                v{version.version}
                                            </span>
                                        }
                                        title={`Versi ${version.version}`}
                                        subtitle={version.summary ?? 'Perubahan profil'}
                                        meta={<span className="text-[11px] text-[#64748b]">{formatDate(version.created_at, true)}</span>}
                                    />
                                ))}
                            </div>
                        )}
                    </PageSection>
                </div>
            </div>
        </AppShell>
    );
}
