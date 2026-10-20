import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Skeleton, useConfirm, useToast } from '../../Components/UI';
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
    const [assignOpen, setAssignOpen] = useState(false);
    const [focusClassId, setFocusClassId] = useState(null);
    const [counselorId, setCounselorId] = useState('');
    const [selectedClassIds, setSelectedClassIds] = useState([]);
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

    const counselorClassIds = (id) => classes
        .filter((item) => item.counselors.some((c) => String(c.id) === String(id)))
        .map((item) => item.id);

    const openAssign = (classItem = null) => {
        setAssignOpen(true);
        setCounselorId('');
        setFocusClassId(classItem?.id ?? null);
        setSelectedClassIds(classItem ? [classItem.id] : []);
    };

    const chooseCounselor = (value) => {
        setCounselorId(value);

        if (!value) {
            setSelectedClassIds(focusClassId ? [focusClassId] : []);

            return;
        }

        const existing = counselorClassIds(value);
        setSelectedClassIds(focusClassId && !existing.includes(focusClassId) ? [...existing, focusClassId] : existing);
    };

    const toggleClass = (id) => {
        setSelectedClassIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
    };

    const saveAssign = async () => {
        const counselor = counselors.find((item) => String(item.id) === String(counselorId));
        const existing = counselorClassIds(counselorId);
        const toAttach = selectedClassIds.filter((id) => !existing.includes(id));
        const toDetach = existing.filter((id) => !selectedClassIds.includes(id));

        if (!counselor || (toAttach.length === 0 && toDetach.length === 0)) {
            toast.push('Tidak ada perubahan penugasan.', 'info');

            return;
        }

        const nameOf = (id) => classes.find((item) => item.id === id)?.name ?? `#${id}`;
        const decision = await confirm({
            title: 'Simpan penugasan Guru BK?',
            description: 'Satu Guru BK boleh mendampingi banyak kelas, dan satu kelas boleh punya lebih dari satu Guru BK.',
            details: [
                { label: 'Guru BK', value: counselor.name },
                { label: 'Kelas ditambahkan', value: toAttach.length ? toAttach.map(nameOf).join(', ') : '—' },
                { label: 'Kelas dilepas', value: toDetach.length ? toDetach.map(nameOf).join(', ') : '—' },
            ],
            confirmLabel: 'Simpan penugasan',
            tone: 'primary',
            icon: 'users',
        });
        if (!decision) return;
        setBusy(true);

        try {
            if (toAttach.length) {
                await api.post(`/api/admin/counselors/${counselorId}/classes`, { class_ids: toAttach });
            }

            for (const classId of toDetach) {
                await api.delete(`/api/admin/classes/${classId}/counselors/${counselorId}`);
            }

            toast.push(`Penugasan ${counselor.name} diperbarui: ${toAttach.length} ditambahkan, ${toDetach.length} dilepas.`);
            setAssignOpen(false);
            await load();
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setBusy(false);
        }
    };

    const detach = async (classItem, counselor) => {
        const decision = await confirm({
            title: 'Lepas penugasan Guru BK?',
            description: 'Guru BK tidak lagi mendampingi kelas ini. Riwayat akses ke data lama tetap tersimpan.',
            details: [
                { label: 'Kelas', value: classItem.name },
                { label: 'Guru BK', value: counselor.name },
            ],
            confirmLabel: 'Lepas',
            tone: 'danger',
            icon: 'users',
        });
        if (!decision) return;

        try {
            await api.delete(`/api/admin/classes/${classItem.id}/counselors/${counselor.id}`);
            toast.push('Penugasan dilepas.');
            await load();
        } catch (error) {
            toast.push(error.message, 'error');
        }
    };

    const hasMultipleYears = new Set(classes.map((item) => item.academic_year)).size > 1;

    return (
        <AppShell
            title="Kelas & penugasan"
            subtitle="Kelola kelas per tahun ajaran dan Guru BK pendamping"
            actions={
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => openAssign(null)}>Tugaskan Guru BK</Button>
                    <Button variant="primary" onClick={() => setOpen(true)}>Tambah kelas</Button>
                </div>
            }
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
                            <div className="mt-1 flex flex-wrap items-center gap-1">
                                <span className="text-[12px] text-[#475569]">Guru BK:</span>
                                {item.counselors.length === 0 ? (
                                    <span className="text-[12px] text-[#94a3b8]">belum ada</span>
                                ) : item.counselors.map((counselor) => (
                                    <span key={counselor.id} className="inline-flex items-center gap-1 rounded-full border border-[#e2e8f0] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#475569]">
                                        {counselor.name}
                                        <button
                                            type="button"
                                            onClick={() => detach(item, counselor)}
                                            aria-label={`Lepas ${counselor.name} dari ${item.name}`}
                                            className="text-[13px] leading-none text-[#94a3b8] transition hover:text-[#b91c1c]"
                                        >
                                            ×
                                        </button>
                                    </span>
                                ))}
                            </div>
                            {item.counselors.length > 2 ? (
                                <p className="mt-1 text-[11px] text-[#92400e]">{item.counselors.length} Guru BK mendampingi kelas ini.</p>
                            ) : null}
                            <div className="mt-3 flex flex-wrap gap-1">
                                <Button variant="outline" size="sm" onClick={() => openAssign(item)}>Atur Guru BK</Button>
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
                open={assignOpen}
                onClose={() => setAssignOpen(false)}
                title="Tugaskan Guru BK"
                footer={
                    <>
                        <Button variant="outline" onClick={() => setAssignOpen(false)}>Batal</Button>
                        <Button variant="primary" onClick={saveAssign} disabled={busy || !counselorId}>
                            {busy ? 'Menyimpan…' : 'Simpan penugasan'}
                        </Button>
                    </>
                }
            >
                <div className="space-y-3">
                    <Field label="Guru BK" required htmlFor="counselor">
                        <Select id="counselor" value={counselorId} onChange={(event) => chooseCounselor(event.target.value)}>
                            <option value="">Pilih Guru BK</option>
                            {counselors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </Select>
                    </Field>

                    <div>
                        <p className="mb-1.5 text-[12px] font-semibold text-[#1e293b]">Kelas yang didampingi</p>
                        <p className="mb-2 text-[11px] text-[#475569]">
                            {counselorId
                                ? 'Centang semua kelas yang diampu. Melepas centang akan mengakhiri penugasan pada kelas tersebut.'
                                : 'Pilih Guru BK lebih dahulu untuk melihat kelas yang sudah diampu.'}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            {classes.map((item) => {
                                const active = selectedClassIds.includes(item.id);
                                const disabled = !counselorId;

                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        disabled={disabled}
                                        aria-pressed={active}
                                        onClick={() => toggleClass(item.id)}
                                        className={`rounded-full border px-3 py-1.5 text-[11.5px] font-semibold transition ${
                                            disabled
                                                ? 'cursor-not-allowed border-[#e2e8f0] bg-[#f8fafc] text-[#cbd5e1]'
                                                : active
                                                    ? 'border-[#3f51b5] bg-[#3f51b5] text-white active:scale-95'
                                                    : 'border-[#e2e8f0] bg-white text-[#475569] active:scale-95'
                                        }`}
                                    >
                                        {item.name}
                                        {hasMultipleYears ? <span className="opacity-70"> · {item.academic_year}</span> : null}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </Modal>
        </AppShell>
    );
}
