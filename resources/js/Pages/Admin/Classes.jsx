import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, CardTitle, EmptyState, Field, Input, Modal, Select, Skeleton, useConfirm, useToast } from '../../Components/UI';
import AppShell from '../../Layouts/AppShell';
import { api } from '../../lib/api';

export default function Classes() {
    const toast = useToast();
    const confirm = useConfirm();
    const [classes, setClasses] = useState([]);
    const [years, setYears] = useState([]);
    const [counselors, setCounselors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [assignFor, setAssignFor] = useState(null);
    const [counselorId, setCounselorId] = useState('');
    const [form, setForm] = useState({ academic_year_id: '', name: '', level: 'X', homeroom_teacher_name: '' });
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            const [classList, yearList, counselorList] = await Promise.all([
                api.get('/api/admin/classes'),
                api.get('/api/admin/academic-years'),
                api.get('/api/admin/users?role=counselor&status=active&per_page=100'),
            ]);
            setClasses(classList.data ?? []);
            setYears(yearList.data ?? []);
            setCounselors(counselorList.data ?? []);
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
            title: 'Tambah kelas?',
            description: 'Kelas baru akan dibuat pada tahun ajaran yang dipilih.',
            details: [
                { label: 'Nama kelas', value: form.name },
                { label: 'Tingkat', value: form.level },
            ],
            confirmLabel: 'Simpan',
            tone: 'primary',
            icon: 'users',
        });
        if (!decision) return;
        setBusy(true);

        try {
            await api.post('/api/admin/classes', {
                ...form,
                academic_year_id: Number(form.academic_year_id),
            });
            toast.push('Kelas dibuat.');
            setOpen(false);
            setForm({ academic_year_id: '', name: '', level: 'X', homeroom_teacher_name: '' });
            await load();
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setBusy(false);
        }
    };

    const assign = async (event) => {
        event.preventDefault();
        const counselor = counselors.find((item) => String(item.id) === String(counselorId));
        const decision = await confirm({
            title: 'Tugaskan Guru BK?',
            description: 'Guru BK akan mendampingi kelas ini.',
            details: [
                { label: 'Kelas', value: assignFor.name },
                { label: 'Guru BK', value: counselor?.name ?? '—' },
            ],
            confirmLabel: 'Tugaskan',
            tone: 'primary',
            icon: 'users',
        });
        if (!decision) return;
        setBusy(true);

        try {
            await api.post(`/api/admin/classes/${assignFor.id}/counselors`, { counselor_id: Number(counselorId) });
            toast.push('Guru BK ditugaskan.');
            setAssignFor(null);
            setCounselorId('');
            await load();
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <AppShell
            title="Kelas & penugasan"
            subtitle="Kelola kelas per tahun ajaran dan Guru BK pendamping"
            actions={<Button variant="primary" onClick={() => setOpen(true)}>Tambah kelas</Button>}
        >
            {loading ? <Skeleton rows={5} /> : classes.length === 0 ? (
                <Card><EmptyState title="Belum ada kelas" description="Buat tahun ajaran lalu tambahkan kelas." /></Card>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {classes.map((item) => (
                        <Card key={item.id}>
                            <div className="mb-2 flex items-start justify-between gap-2">
                                <div>
                                    <p className="text-[15px] font-bold">{item.name}</p>
                                    <p className="text-[11px] text-[#475569]">Tahun {item.academic_year} · {item.students_count} siswa</p>
                                </div>
                                <Badge tone={item.is_active ? 'success' : 'neutral'}>{item.is_active ? 'Aktif' : 'Arsip'}</Badge>
                            </div>
                            <p className="text-[12px] text-[#475569]">
                                Guru BK: {item.counselors.length ? item.counselors.map((c) => c.name).join(', ') : 'belum ada'}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-1">
                                <Button variant="outline" size="sm" onClick={() => setAssignFor(item)}>Tugaskan Guru BK</Button>
                                <Button variant="ghost" size="sm" onClick={() => (window.location.href = `/admin/pengguna?class_id=${item.id}`)}>Lihat siswa</Button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            <Modal
                open={open}
                onClose={() => setOpen(false)}
                title="Tambah kelas"
                footer={
                    <>
                        <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
                        <Button type="submit" variant="primary" form="class-form" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan kelas'}</Button>
                    </>
                }
            >
                <form id="class-form" onSubmit={create} className="space-y-3">
                    <Field label="Tahun ajaran" required htmlFor="year">
                        <Select id="year" value={form.academic_year_id} onChange={(event) => setForm({ ...form, academic_year_id: event.target.value })} required>
                            <option value="">Pilih tahun ajaran</option>
                            {years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
                        </Select>
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Nama kelas" required htmlFor="name">
                            <Input id="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="XI IPA 2" required />
                        </Field>
                        <Field label="Tingkat" required htmlFor="level">
                            <Select id="level" value={form.level} onChange={(event) => setForm({ ...form, level: event.target.value })}>
                                <option value="X">X</option>
                                <option value="XI">XI</option>
                                <option value="XII">XII</option>
                            </Select>
                        </Field>
                    </div>
                    <Field label="Wali kelas" htmlFor="homeroom">
                        <Input id="homeroom" value={form.homeroom_teacher_name} onChange={(event) => setForm({ ...form, homeroom_teacher_name: event.target.value })} />
                    </Field>
                </form>
            </Modal>

            <Modal
                open={Boolean(assignFor)}
                onClose={() => setAssignFor(null)}
                title={`Tugaskan Guru BK — ${assignFor?.name ?? ''}`}
                footer={
                    <>
                        <Button variant="outline" onClick={() => setAssignFor(null)}>Batal</Button>
                        <Button type="submit" variant="primary" form="assign-form" disabled={busy}>Tugaskan</Button>
                    </>
                }
            >
                <form id="assign-form" onSubmit={assign} className="space-y-3">
                    <Field label="Guru BK" required htmlFor="counselor">
                        <Select id="counselor" value={counselorId} onChange={(event) => setCounselorId(event.target.value)} required>
                            <option value="">Pilih Guru BK</option>
                            {counselors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </Select>
                    </Field>
                </form>
            </Modal>
        </AppShell>
    );
}
