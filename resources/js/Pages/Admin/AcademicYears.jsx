import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, CardTitle, EmptyState, Field, Input, Modal, Select, Skeleton, useConfirm, useToast } from '../../Components/UI';
import AppShell from '../../Layouts/AppShell';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/format';

export default function AcademicYears() {
    const toast = useToast();
    const confirm = useConfirm();
    const [years, setYears] = useState([]);
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [promoteFor, setPromoteFor] = useState(null);
    const [mapping, setMapping] = useState([]);
    const [carryCounselors, setCarryCounselors] = useState(true);
    const [preview, setPreview] = useState(null);
    const [busy, setBusy] = useState(false);
    const [form, setForm] = useState({ name: '', starts_on: '', ends_on: '' });

    const load = useCallback(async () => {
        try {
            const [yearList, classList] = await Promise.all([
                api.get('/api/admin/academic-years'),
                api.get('/api/admin/classes'),
            ]);
            setYears(yearList.data ?? []);
            setClasses(classList.data ?? []);
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        load();
    }, [load]);

    const create = async (event) => {
        event.preventDefault();
        const decision = await confirm({
            title: 'Tambah tahun ajaran?',
            description: `Tahun ajaran "${form.name}" akan dibuat untuk periode ${form.starts_on} – ${form.ends_on}.`,
            confirmLabel: 'Simpan',
            tone: 'primary',
            icon: 'file',
        });
        if (!decision) return;
        setBusy(true);

        try {
            await api.post('/api/admin/academic-years', form);
            toast.push('Tahun ajaran dibuat.');
            setOpen(false);
            setForm({ name: '', starts_on: '', ends_on: '' });
            await load();
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setBusy(false);
        }
    };

    const activate = async (year) => {
        const decision = await confirm({
            title: 'Aktifkan tahun ajaran?',
            description: `Tahun ajaran ${year.name} akan menjadi acuan default untuk data baru.`,
            confirmLabel: 'Aktifkan',
            tone: 'warning',
            icon: 'check',
        });
        if (!decision) return;

        try {
            await api.patch(`/api/admin/academic-years/${year.id}/activate`);
            toast.push(`Tahun ajaran ${year.name} diaktifkan.`);
            await load();
        } catch (error) {
            toast.push(error.message, 'error');
        }
    };

    const startPromote = (year) => {
        setPromoteFor(year);
        setPreview(null);
        setCarryCounselors(true);
        setMapping(classes.filter((item) => item.is_active).map((item) => ({
            from_class_id: item.id,
            from_name: item.name,
            to_class_id: '',
            graduate: false,
        })));
    };

    const runPromote = async (isPreview) => {
        const decision = await confirm(isPreview ? {
            title: 'Hitung pratinjau kenaikan kelas?',
            description: 'Pratinjau menghitung jumlah siswa yang dipindahkan dan diluluskan tanpa mengubah data.',
            confirmLabel: 'Hitung pratinjau',
            tone: 'info',
            icon: 'target',
        } : {
            title: 'Eksekusi kenaikan kelas?',
            description: 'Siswa akan dipindahkan ke kelas tujuan dan siswa tingkat akhir diluluskan. Tindakan ini mengubah data secara massal.',
            details: preview ? [
                { label: 'Siswa dipindahkan', value: String(preview.students_moved) },
                { label: 'Siswa diluluskan', value: String(preview.students_graduated) },
                { label: 'Penugasan Guru BK disalin', value: String(preview.counselors_carried ?? 0) },
            ] : undefined,
            confirmLabel: 'Eksekusi kenaikan kelas',
            tone: 'warning',
            icon: 'alert',
        });
        if (!decision) return;
        setBusy(true);

        try {
            const response = await api.post(`/api/admin/academic-years/${promoteFor.id}/promote`, {
                preview: isPreview,
                carry_counselors: carryCounselors,
                mapping: mapping.map((item) => ({
                    from_class_id: item.from_class_id,
                    to_class_id: item.to_class_id ? Number(item.to_class_id) : null,
                    graduate: item.graduate,
                })),
            });
            setPreview(response.data);

            if (!isPreview) {
                toast.push(`Kenaikan kelas selesai: ${response.data.students_moved} dipindahkan, ${response.data.students_graduated} lulus, ${response.data.counselors_carried ?? 0} penugasan Guru BK disalin.`);
                setPromoteFor(null);
                await load();
            }
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <AppShell
            title="Tahun ajaran"
            subtitle="Aktivasi tahun ajaran dan kenaikan kelas massal"
            actions={<Button variant="primary" onClick={() => setOpen(true)}>Tambah tahun ajaran</Button>}
        >
            {loading ? <Skeleton rows={3} /> : years.length === 0 ? (
                <Card><EmptyState title="Belum ada tahun ajaran" description="Buat tahun ajaran pertama untuk memulai." /></Card>
            ) : (
                <div className="space-y-3">
                    {years.map((year) => (
                        <Card key={year.id} className="p-4 sm:p-5">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="text-[15px] font-bold">{year.name}</p>
                                        {year.is_active ? <Badge tone="success">Aktif</Badge> : <Badge tone="neutral">Arsip</Badge>}
                                    </div>
                                    <p className="text-[12px] text-[#475569]">{formatDate(year.starts_on)} – {formatDate(year.ends_on)}</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {!year.is_active ? <Button variant="success" size="sm" onClick={() => activate(year)}>Aktifkan</Button> : null}
                                    <Button variant="outline" size="sm" onClick={() => startPromote(year)}>Kenaikan kelas</Button>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            <Modal
                open={open}
                onClose={() => setOpen(false)}
                title="Tambah tahun ajaran"
                footer={
                    <>
                        <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
                        <Button type="submit" variant="primary" form="year-form" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</Button>
                    </>
                }
            >
                <form id="year-form" onSubmit={create} className="space-y-3">
                    <Field label="Nama" required htmlFor="year-name" hint="Contoh: 2026/2027">
                        <Input id="year-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Mulai" required htmlFor="starts">
                            <Input id="starts" type="date" value={form.starts_on} onChange={(event) => setForm({ ...form, starts_on: event.target.value })} required />
                        </Field>
                        <Field label="Selesai" required htmlFor="ends">
                            <Input id="ends" type="date" value={form.ends_on} onChange={(event) => setForm({ ...form, ends_on: event.target.value })} required />
                        </Field>
                    </div>
                </form>
            </Modal>

            <Modal
                open={Boolean(promoteFor)}
                onClose={() => setPromoteFor(null)}
                title={`Kenaikan kelas ${promoteFor?.name ?? ''}`}
                wide
                footer={
                    <>
                        <Button variant="outline" onClick={() => setPromoteFor(null)}>Batal</Button>
                        <Button variant="info" onClick={() => runPromote(true)} disabled={busy}>Pratinjau</Button>
                        <Button variant="warning" onClick={() => runPromote(false)} disabled={busy || !preview}>Eksekusi</Button>
                    </>
                }
            >
                <div className="space-y-2">
                    <p className="text-[12px] text-[#475569]">
                        Tentukan kelas tujuan untuk setiap kelas. Pilih "Luluskan" untuk siswa tingkat akhir.
                    </p>
                    <label className="flex items-start gap-2 rounded-xl border border-[#e2e8f0] bg-white p-3 text-[12px] text-[#475569]">
                        <input
                            type="checkbox"
                            checked={carryCounselors}
                            onChange={(event) => {
                                setCarryCounselors(event.target.checked);
                                setPreview(null);
                            }}
                            className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[#3f51b5]"
                        />
                        <span>
                            <span className="font-semibold text-[#1e293b]">Ikutkan Guru BK pendamping</span>
                            <br />
                            Penugasan Guru BK pada kelas asal disalin ke kelas tujuan. Penugasan lama tetap tersimpan sebagai riwayat akses.
                        </span>
                    </label>
                    {mapping.map((item, index) => (
                        <div key={item.from_class_id} className="grid items-end gap-2 rounded-xl bg-[#f1f5f9] p-3 sm:grid-cols-[1fr_1fr_auto]">
                            <p className="text-[13px] font-semibold">{item.from_name}</p>
                            <Select
                                value={item.graduate ? 'graduate' : item.to_class_id}
                                onChange={(event) => {
                                    const next = [...mapping];
                                    next[index] = {
                                        ...next[index],
                                        graduate: event.target.value === 'graduate',
                                        to_class_id: event.target.value === 'graduate' ? '' : event.target.value,
                                    };
                                    setMapping(next);
                                    setPreview(null);
                                }}
                                aria-label={`Tujuan untuk ${item.from_name}`}
                            >
                                <option value="">Pilih kelas tujuan</option>
                                {classes.filter((c) => c.id !== item.from_class_id && c.academic_year !== promoteFor?.name).map((c) => (
                                    <option key={c.id} value={c.id}>{c.name} ({c.academic_year})</option>
                                ))}
                                <option value="graduate">Luluskan</option>
                            </Select>
                            <span className="text-[11px] text-[#475569]">{item.graduate ? 'Alumni' : ''}</span>
                        </div>
                    ))}
                    {preview ? (
                        <div className="rounded-xl bg-[#e8eaf6] p-3 text-[12px] text-[#303f9f]">
                            Pratinjau: {preview.students_moved} siswa dipindahkan, {preview.students_graduated} siswa diluluskan, {preview.counselors_carried ?? 0} penugasan Guru BK disalin.
                        </div>
                    ) : null}
                </div>
            </Modal>
        </AppShell>
    );
}
