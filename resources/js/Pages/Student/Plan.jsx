import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, CardTitle, EmptyState, Field, IconButton, Input, Modal, Skeleton, Textarea, useConfirm, useToast } from '../../Components/UI';
import AppShell from '../../Layouts/AppShell';
import { api } from '../../lib/api';
import { formatDate, label } from '../../lib/format';

export default function Plan() {
    const toast = useToast();
    const confirm = useConfirm();
    const [plan, setPlan] = useState(null);
    const [future, setFuture] = useState({});
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [targetForm, setTargetForm] = useState({ title: '', success_indicator: '' });
    const [evaluation, setEvaluation] = useState({ evaluation_text: '', improvement_text: '' });
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            const [planResponse, futureResponse] = await Promise.all([
                api.get('/api/student/action-plans/current'),
                api.get('/api/student/future-plan'),
            ]);
            setPlan(planResponse.data);
            setFuture(futureResponse.data ?? {});

            if (planResponse.data?.evaluation) {
                setEvaluation({
                    evaluation_text: planResponse.data.evaluation.evaluation_text ?? '',
                    improvement_text: planResponse.data.evaluation.improvement_text ?? '',
                });
            }
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        load();
    }, [load]);

    const addTarget = async (event) => {
        event.preventDefault();
        const decision = await confirm({
            title: 'Simpan target?',
            description: 'Target akan ditambahkan ke rencana aksi bulan ini.',
            details: [{ label: 'Target', value: targetForm.title }],
            confirmLabel: 'Simpan target',
            tone: 'primary',
            icon: 'target',
        });
        if (!decision) return;
        setBusy(true);

        try {
            await api.post(`/api/student/action-plans/${plan.id}/targets`, targetForm);
            toast.push('Target ditambahkan.');
            setModalOpen(false);
            setTargetForm({ title: '', success_indicator: '' });
            await load();
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setBusy(false);
        }
    };

    const updateStatus = async (target, status) => {
        const decision = await confirm({
            title: 'Ubah status target?',
            description: 'Status target akan diperbarui.',
            details: [{ label: 'Target', value: target.title }],
            confirmLabel: 'Simpan status',
            tone: 'primary',
            icon: 'target',
        });
        if (!decision) return;

        try {
            await api.put(`/api/student/action-targets/${target.id}`, { status });
            await load();
        } catch (error) {
            toast.push(error.message, 'error');
        }
    };

    const removeTarget = async (target) => {
        const decision = await confirm({
            title: 'Hapus target?',
            description: 'Target akan dihapus permanen dari rencana aksi.',
            details: [{ label: 'Target', value: target.title }],
            confirmLabel: 'Hapus',
            tone: 'danger',
            icon: 'trash',
        });
        if (!decision) return;

        try {
            await api.delete(`/api/student/action-targets/${target.id}`);
            await load();
        } catch (error) {
            toast.push(error.message, 'error');
        }
    };

    const loadEvaluation = async () => {
        try {
            const response = await api.get(`/api/student/action-plans/${plan.id}/evaluation`);
            setPlan({ ...plan, evaluation: response.data });
            setEvaluation({
                evaluation_text: response.data.evaluation_text ?? '',
                improvement_text: response.data.improvement_text ?? '',
            });
        } catch (error) {
            toast.push(error.message, 'error');
        }
    };

    const saveEvaluation = async () => {
        const decision = await confirm({
            title: 'Simpan evaluasi?',
            description: 'Evaluasi bulanan akan diperbarui.',
            confirmLabel: 'Simpan evaluasi',
            tone: 'primary',
            icon: 'check',
        });
        if (!decision) return;
        setBusy(true);
        try {
            await api.post(`/api/student/action-plans/${plan.id}/evaluation`, evaluation);
            toast.push('Evaluasi tersimpan.');
            await load();
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setBusy(false);
        }
    };

    const saveFuture = async () => {
        const decision = await confirm({
            title: 'Simpan rencana?',
            description: 'Rencana masa depan akan disimpan sebagai versi baru.',
            confirmLabel: 'Simpan rencana',
            tone: 'primary',
            icon: 'check',
        });
        if (!decision) return;
        setBusy(true);
        try {
            await api.put('/api/student/future-plan', future);
            toast.push('Rencana masa depan tersimpan.');
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <AppShell
            title="Rencana aksi"
            subtitle={plan ? `${formatDate(plan.period_start)} – ${formatDate(plan.period_end)}` : 'Target bulanan dan rencana masa depan'}
            actions={<Button onClick={() => setModalOpen(true)} disabled={!plan || plan.targets?.length >= 5}>Tambah target</Button>}
        >
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
                <Card className="lg:col-span-7">
                    <CardTitle action={<span className="text-[11px] text-[#475569]">{plan?.targets?.length ?? 0}/5 target</span>}>
                        Target bulan ini
                    </CardTitle>
                    {loading ? <Skeleton rows={4} /> : !plan?.targets?.length ? (
                        <EmptyState
                            title="Belum ada target"
                            description="Tetapkan maksimal lima langkah kecil yang bisa diukur."
                            action={<Button onClick={() => setModalOpen(true)}>Buat target</Button>}
                        />
                    ) : (
                        <ul className="space-y-2">
                            {plan.targets.map((target) => (
                                <li key={target.id} className="rounded-[16px] border border-[#e2e8f0] p-3">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div>
                                            <p className="text-[13px] font-semibold">{target.title}</p>
                                            <p className="text-[12px] text-[#475569]">Indikator: {target.success_indicator}</p>
                                        </div>
                                        <Badge tone={target.status === 'achieved' ? 'success' : target.status === 'in_progress' ? 'info' : 'neutral'}>
                                            {label('targetStatus', target.status)}
                                        </Badge>
                                    </div>
                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                        <select
                                            className="sd-input h-8 w-auto px-2 text-[11px]"
                                            value={target.status}
                                            onChange={(event) => updateStatus(target, event.target.value)}
                                            aria-label={`Status target ${target.title}`}
                                        >
                                            <option value="not_started">Belum mulai</option>
                                            <option value="in_progress">Berjalan</option>
                                            <option value="achieved">Tercapai</option>
                                            <option value="not_achieved">Belum tercapai</option>
                                        </select>
                                        <IconButton icon="trash" label={`Hapus ${target.title}`} variant="danger" onClick={() => removeTarget(target)} />
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>

                <Card className="lg:col-span-5">
                    <CardTitle action={!plan?.evaluation ? <Button variant="outline" onClick={loadEvaluation}>Muat evaluasi</Button> : null}>
                        Evaluasi bulanan
                    </CardTitle>
                    {plan?.evaluation?.snapshot ? (
                        <div className="mb-3 grid grid-cols-2 gap-2 text-[12px]">
                            <div className="rounded-xl bg-[#f1f5f9] p-2">
                                <p className="text-[#475569]">Mood</p>
                                <p className="tabular font-bold">{plan.evaluation.snapshot.mood.positive_days} positif · {plan.evaluation.snapshot.mood.negative_days} negatif</p>
                            </div>
                            <div className="rounded-xl bg-[#f1f5f9] p-2">
                                <p className="text-[#475569]">Jurnal</p>
                                <p className="tabular font-bold">{plan.evaluation.snapshot.journals.abc} ABC · {plan.evaluation.snapshot.journals.grateful} grateful</p>
                            </div>
                            <div className="rounded-xl bg-[#f1f5f9] p-2">
                                <p className="text-[#475569]">Refleksi</p>
                                <p className="tabular font-bold">{plan.evaluation.snapshot.reflections}</p>
                            </div>
                            <div className="rounded-xl bg-[#f1f5f9] p-2">
                                <p className="text-[#475569]">Target tercapai</p>
                                <p className="tabular font-bold">{plan.evaluation.snapshot.targets_achieved}/{plan.evaluation.snapshot.targets_total}</p>
                            </div>
                        </div>
                    ) : (
                        <p className="mb-3 text-[12px] text-[#475569]">Ringkasan data bulan ini belum dibuat.</p>
                    )}
                    <Field label="Evaluasi kekurangan" htmlFor="evaluation">
                        <Textarea id="evaluation" rows={2} value={evaluation.evaluation_text} onChange={(event) => setEvaluation({ ...evaluation, evaluation_text: event.target.value })} />
                    </Field>
                    <div className="mt-2">
                        <Field label="Rencana perbaikan" htmlFor="improvement">
                            <Textarea id="improvement" rows={2} value={evaluation.improvement_text} onChange={(event) => setEvaluation({ ...evaluation, improvement_text: event.target.value })} />
                        </Field>
                    </div>
                    <div className="mt-3 flex justify-end">
                        <Button onClick={saveEvaluation} disabled={busy || !plan}>Simpan evaluasi</Button>
                    </div>
                </Card>

                <Card className="lg:col-span-12">
                    <CardTitle action={<Button onClick={saveFuture} disabled={busy}>Simpan rencana</Button>}>
                        Rencana masa depan
                    </CardTitle>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Cita-cita" htmlFor="dream">
                            <Textarea id="dream" rows={3} value={future.dream ?? ''} onChange={(event) => setFuture({ ...future, dream: event.target.value })} />
                        </Field>
                        <Field label="Perencanaan karir" htmlFor="career">
                            <Textarea id="career" rows={3} value={future.career_plan ?? ''} onChange={(event) => setFuture({ ...future, career_plan: event.target.value })} />
                        </Field>
                        <Field label="Perencanaan pendidikan" htmlFor="education">
                            <Textarea id="education" rows={3} value={future.education_plan ?? ''} onChange={(event) => setFuture({ ...future, education_plan: event.target.value })} />
                        </Field>
                        <Field label="Target nyata" htmlFor="targets">
                            <Textarea id="targets" rows={3} value={future.concrete_targets ?? ''} onChange={(event) => setFuture({ ...future, concrete_targets: event.target.value })} />
                        </Field>
                    </div>
                    <p className="mt-2 text-[11px] text-[#5b6b7f]">Setiap perubahan disimpan sebagai versi baru.</p>
                </Card>
            </div>

            <Modal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                title="Tambah target bulanan"
                footer={
                    <>
                        <Button variant="outline" onClick={() => setModalOpen(false)}>Batal</Button>
                        <Button type="submit" form="target-form" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan target'}</Button>
                    </>
                }
            >
                <form id="target-form" onSubmit={addTarget} className="space-y-3">
                    <Field label="Target" required htmlFor="title">
                        <Input id="title" value={targetForm.title} onChange={(event) => setTargetForm({ ...targetForm, title: event.target.value })} required />
                    </Field>
                    <Field label="Indikator keberhasilan" required htmlFor="indicator">
                        <Textarea id="indicator" rows={2} value={targetForm.success_indicator} onChange={(event) => setTargetForm({ ...targetForm, success_indicator: event.target.value })} required />
                    </Field>
                </form>
            </Modal>
        </AppShell>
    );
}
