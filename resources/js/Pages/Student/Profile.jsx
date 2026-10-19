import { useCallback, useEffect, useState } from 'react';
import { Button, Card, CardTitle, Field, Input, Progress, Skeleton, Textarea, useConfirm, useToast } from '../../Components/UI';
import AppShell from '../../Layouts/AppShell';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/format';

export default function Profile() {
    const toast = useToast();
    const confirm = useConfirm();
    const [loading, setLoading] = useState(true);
    const [biodata, setBiodata] = useState({});
    const [self, setSelf] = useState({});
    const [completeness, setCompleteness] = useState(0);
    const [versions, setVersions] = useState([]);
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

    return (
        <AppShell title="Info diri" subtitle="Biodata dan profil diri Anda">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
                <Card className="lg:col-span-8">
                    <CardTitle>Biodata</CardTitle>
                    {loading ? <Skeleton rows={6} /> : (
                        <form onSubmit={saveBiodata} className="space-y-3">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <Field label="Tanggal lahir" htmlFor="birth_date">
                                    <Input id="birth_date" type="date" value={biodata.birth_date ?? ''} onChange={(e) => setBiodata({ ...biodata, birth_date: e.target.value })} />
                                </Field>
                                <Field label="Jenis kelamin" htmlFor="gender">
                                    <select id="gender" className="sd-input" value={biodata.gender ?? ''} onChange={(e) => setBiodata({ ...biodata, gender: e.target.value })}>
                                        <option value="">Pilih</option>
                                        <option value="male">Laki-laki</option>
                                        <option value="female">Perempuan</option>
                                    </select>
                                </Field>
                                <Field label="Nomor kontak" htmlFor="phone">
                                    <Input id="phone" value={biodata.phone ?? ''} onChange={(e) => setBiodata({ ...biodata, phone: e.target.value })} placeholder="08xxxxxxxxxx" />
                                </Field>
                                <Field label="Golongan darah" htmlFor="blood_type">
                                    <Input id="blood_type" value={biodata.blood_type ?? ''} onChange={(e) => setBiodata({ ...biodata, blood_type: e.target.value })} maxLength={3} />
                                </Field>
                                <Field label="Tinggi (cm)" htmlFor="height_cm">
                                    <Input id="height_cm" type="number" value={biodata.height_cm ?? ''} onChange={(e) => setBiodata({ ...biodata, height_cm: e.target.value })} />
                                </Field>
                                <Field label="Berat (kg)" htmlFor="weight_kg">
                                    <Input id="weight_kg" type="number" value={biodata.weight_kg ?? ''} onChange={(e) => setBiodata({ ...biodata, weight_kg: e.target.value })} />
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
                            <div className="flex justify-end">
                                <Button type="submit" disabled={busy}>Simpan biodata</Button>
                            </div>
                        </form>
                    )}
                </Card>

                <div className="space-y-4 lg:col-span-4">
                    <Card>
                        <CardTitle>Kelengkapan profil</CardTitle>
                        <Progress value={completeness} label="Biodata dan profil" />
                        <p className="mt-2 text-[11px] text-[#475569]">Lengkapi agar Guru BK dapat mendampingi lebih tepat.</p>
                    </Card>

                    <Card>
                        <CardTitle>Riwayat versi</CardTitle>
                        {versions.length === 0 ? (
                            <p className="text-[12px] text-[#475569]">Belum ada versi tersimpan.</p>
                        ) : (
                            <ul className="space-y-1.5 text-[12px]">
                                {versions.slice(0, 5).map((version) => (
                                    <li key={version.version} className="flex justify-between gap-2 border-b border-[#e2e8f0] pb-1.5 last:border-0">
                                        <span>Versi {version.version}</span>
                                        <span className="text-[#475569]">{formatDate(version.created_at, true)}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>
                </div>

                <Card className="lg:col-span-12">
                    <CardTitle action={<span className="text-[11px] text-[#475569]">Versi {self.version ?? 1}{self.published_at ? ` · terbit ${formatDate(self.published_at)}` : ' · draf'}</span>}>
                        Profil diri
                    </CardTitle>
                    {loading ? <Skeleton rows={4} /> : (
                        <div className="space-y-3">
                            <div className="grid gap-3 sm:grid-cols-2">
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
                            <div className="flex flex-wrap justify-end gap-2">
                                <Button variant="warning" onClick={() => saveSelf(false)} disabled={busy}>Simpan draf</Button>
                                <Button variant="success" onClick={() => saveSelf(true)} disabled={busy}>Publikasikan ke Guru BK</Button>
                            </div>
                        </div>
                    )}
                </Card>
            </div>
        </AppShell>
    );
}
