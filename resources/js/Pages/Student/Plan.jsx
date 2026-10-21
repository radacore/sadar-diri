import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../../Components/Icons';
import { Button, Card, CardTitle, EmptyState, Field, HeroCard, IconButton, Input, ListRow, ProgressRing, Select, Sheet, Skeleton, Textarea, useConfirm, useToast } from '../../Components/UI';
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
    const [targetForm, setTargetForm] = useState({ title: '', success_indicator: '', basis: 'general', steps: [] });
    const [evaluation, setEvaluation] = useState({ evaluation_text: '', improvement_text: '' });
    const [evaluationOpen, setEvaluationOpen] = useState(false);
    const [stepDraft, setStepDraft] = useState({});
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
            setTargetForm({ title: '', success_indicator: '', basis: 'general', steps: [] });
            await load();
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setBusy(false);
        }
    };

    const addStep = async (target) => {
        const title = (stepDraft[target.id] ?? '').trim();
        if (!title) return;

        try {
            await api.post(`/api/student/action-targets/${target.id}/steps`, { title });
            setStepDraft({ ...stepDraft, [target.id]: '' });
            await load();
        } catch (error) {
            toast.push(error.message, 'error');
        }
    };

    const removeStep = async (step) => {
        try {
            await api.delete(`/api/student/action-steps/${step.id}`);
            await load();
        } catch (error) {
            toast.push(error.message, 'error');
        }
    };

    const toggleStep = async (step) => {
        try {
            await api.put(`/api/student/action-steps/${step.id}`, { is_done: !step.is_done });
            await load();
        } catch (error) {
            toast.push(error.message, 'error');
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

    const targets = plan?.targets ?? [];
    const achieved = targets.filter((target) => target.status === 'achieved').length;
    const percent = targets.length ? Math.round((achieved / targets.length) * 100) : 0;

    return (
        <AppShell
            title="Rencana aksi"
            subtitle={plan ? `${formatDate(plan.period_start)} – ${formatDate(plan.period_end)}` : 'Target bulanan dan rencana masa depan'}
            actions={<Button className="h-11" onClick={() => setModalOpen(true)} disabled={!plan || plan.targets?.length >= 5}>Tambah target</Button>}
        >
            <div className="space-y-5">
                <HeroCard
                    tone="soft"
                    eyebrow="Rencana bulan ini"
                    title={plan ? (targets.length ? `${achieved} dari ${targets.length} target tercapai` : 'Belum ada target bulan ini') : 'Rencana aksi bulanan'}
                    description={plan ? `Periode ${formatDate(plan.period_start)} – ${formatDate(plan.period_end)}` : 'Tetapkan langkah kecil yang bisa diukur.'}
                >
                    <div className="mt-4 flex items-center gap-4">
                        <ProgressRing value={percent} size={88} stroke={9} label={`${percent}%`} />
                        <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">Target tercapai</p>
                            <p className="tabular mt-0.5 text-[28px] font-extrabold leading-none tracking-tight">
                                {achieved}
                                <span className="text-[15px] font-semibold text-[#64748b]">/{targets.length}</span>
                            </p>
                            <p className="mt-1 text-[11.5px] leading-snug text-[#64748b]">
                                Maksimal 5 target per bulan. Perbarui status secara berkala.
                            </p>
                        </div>
                    </div>
                </HeroCard>

                <Card>
                    <CardTitle action={<span className="text-[11px] text-[#475569]">{targets.length}/5 target</span>}>
                        Target bulan ini
                    </CardTitle>
                    {loading ? <Skeleton rows={4} /> : targets.length === 0 ? (
                        <EmptyState
                            title="Belum ada target"
                            description="Tetapkan maksimal lima langkah kecil yang bisa diukur."
                            action={<Button className="mt-2 h-11" onClick={() => setModalOpen(true)}>Buat target</Button>}
                        />
                    ) : (
                        <div className="space-y-2">
                            {targets.map((target, index) => (
                                <div key={target.id} className="space-y-2">
                                <ListRow
                                    leading={
                                        <span className={`flex h-10 w-10 items-center justify-center rounded-full text-[12px] font-bold ${ target.status === 'achieved' ? 'bg-[#d1fae5] text-[#047857]' : 'bg-[#e8edf5] text-[#475569]' }`}>
                                            {target.status === 'achieved' ? <Icon name="check" size={16} /> : index + 1}
                                        </span>
                                    }
                                    title={target.title}
                                    subtitle={target.success_indicator ? `Indikator: ${target.success_indicator}` : 'Tanpa indikator'}
                                    meta={
                                        <Select
                                            className="h-11 w-auto min-w-[136px] px-3 text-[12px]"
                                            value={target.status}
                                            onChange={(event) => updateStatus(target, event.target.value)}
                                            aria-label={`Status target ${target.title}`}
                                        >
                                            <option value="not_started">Belum mulai</option>
                                            <option value="in_progress">Berjalan</option>
                                            <option value="achieved">Tercapai</option>
                                            <option value="not_achieved">Belum tercapai</option>
                                        </Select>
                                    }
                                    trailing={
                                        <IconButton icon="trash" label={`Hapus ${target.title}`} variant="danger" size={44} onClick={() => removeTarget(target)} />
                                    }
                                />
                                <div className="-mt-1 ml-[52px] space-y-1.5">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                                        {label('targetBasis', target.basis ?? 'general')}
                                    </p>
                                    <p className="text-[11px] font-semibold text-[#475569]">Langkah konkret</p>
                                    {(target.steps ?? []).length === 0 ? (
                                        <p className="text-[11.5px] text-[#94a3b8]">Belum ada langkah.</p>
                                    ) : (
                                        (target.steps ?? []).map((step) => (
                                            <div key={step.id} className="flex min-h-10 items-center gap-2 rounded-[12px] bg-[#f8fafc] px-3 py-2 text-[12.5px]">
                                                <input
                                                    id={`step-${step.id}`}
                                                    type="checkbox"
                                                    className="h-4 w-4 accent-[#3f51b5]"
                                                    checked={Boolean(step.is_done)}
                                                    onChange={() => toggleStep(step)}
                                                />
                                                <label htmlFor={`step-${step.id}`} className={`min-w-0 flex-1 ${step.is_done ? 'text-[#94a3b8] line-through' : 'text-[#1e293b]'}`}>
                                                    {step.title}
                                                </label>
                                                <IconButton icon="trash" label={`Hapus langkah ${step.title}`} variant="danger" size={36} onClick={() => removeStep(step)} />
                                            </div>
                                        ))
                                    )}
                                    {(target.steps ?? []).length < 10 ? (
                                        <div className="flex items-center gap-2">
                                            <Input
                                                className="min-w-0 flex-1"
                                                placeholder="Tambah langkah…"
                                                aria-label={`Tambah langkah untuk ${target.title}`}
                                                value={stepDraft[target.id] ?? ''}
                                                onChange={(event) => setStepDraft({ ...stepDraft, [target.id]: event.target.value })}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter') {
                                                        event.preventDefault();
                                                        addStep(target);
                                                    }
                                                }}
                                            />
                                            <IconButton
                                                icon="plus"
                                                label={`Simpan langkah ${target.title}`}
                                                variant="primary"
                                                size={44}
                                                disabled={!(stepDraft[target.id] ?? '').trim()}
                                                onClick={() => addStep(target)}
                                            />
                                        </div>
                                    ) : (
                                        <p className="text-[11px] text-[#94a3b8]">Maksimal 10 langkah per target.</p>
                                    )}
                                </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                <Card>
                    <button
                        type="button"
                        onClick={() => setEvaluationOpen((open) => !open)}
                        aria-expanded={evaluationOpen}
                        className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
                    >
                        <span>
                            <span className="block text-[16px] font-bold leading-tight">Evaluasi bulanan</span>
                            <span className="mt-0.5 block text-[11px] text-[#64748b]">
                                {plan?.evaluation ? 'Evaluasi tersimpan' : 'Belum diisi'}
                            </span>
                        </span>
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f1f5f9] text-[#475569] transition ${evaluationOpen ? 'rotate-180' : ''}`}>
                            <Icon name="chevron" size={18} />
                        </span>
                    </button>

                    {evaluationOpen ? (
                        <div className="mt-4">
                            {plan?.evaluation?.snapshot ? (
                                <div className="mb-3 grid grid-cols-1 gap-2 text-[12px]">
                                    <div className="rounded-xl bg-[#f1f5f9] p-2.5">
                                        <p className="text-[11px] text-[#475569]">Mood</p>
                                        <p className="tabular mt-0.5 text-[12px] font-bold">{plan.evaluation.snapshot.mood.positive_days} positif · {plan.evaluation.snapshot.mood.negative_days} negatif</p>
                                    </div>
                                    <div className="rounded-xl bg-[#f1f5f9] p-2.5">
                                        <p className="text-[11px] text-[#475569]">Jurnal</p>
                                        <p className="tabular mt-0.5 text-[12px] font-bold">{plan.evaluation.snapshot.journals.abc} ABC · {plan.evaluation.snapshot.journals.grateful} grateful</p>
                                    </div>
                                    <div className="rounded-xl bg-[#f1f5f9] p-2.5">
                                        <p className="text-[11px] text-[#475569]">Refleksi</p>
                                        <p className="tabular mt-0.5 text-[12px] font-bold">{plan.evaluation.snapshot.reflections}</p>
                                    </div>
                                    <div className="rounded-xl bg-[#f1f5f9] p-2.5">
                                        <p className="text-[11px] text-[#475569]">Target tercapai</p>
                                        <p className="tabular mt-0.5 text-[12px] font-bold">{plan.evaluation.snapshot.targets_achieved}/{plan.evaluation.snapshot.targets_total}</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="mb-3">
                                    <p className="text-[12px] text-[#475569]">Ringkasan data bulan ini belum dibuat.</p>
                                    {plan && !plan.evaluation ? (
                                        <Button variant="outline" className="mt-2 h-11 w-full" onClick={loadEvaluation}>Muat evaluasi</Button>
                                    ) : null}
                                </div>
                            )}
                            <Field label="Evaluasi kekurangan" htmlFor="evaluation">
                                <Textarea id="evaluation" rows={3} value={evaluation.evaluation_text} onChange={(event) => setEvaluation({ ...evaluation, evaluation_text: event.target.value })} />
                            </Field>
                            <div className="mt-3">
                                <Field label="Rencana perbaikan" htmlFor="improvement">
                                    <Textarea id="improvement" rows={3} value={evaluation.improvement_text} onChange={(event) => setEvaluation({ ...evaluation, improvement_text: event.target.value })} />
                                </Field>
                            </div>
                            <Button className="mt-3 h-11 w-full" onClick={saveEvaluation} disabled={busy || !plan}>Simpan evaluasi</Button>
                        </div>
                    ) : null}
                </Card>

                <Card>
                    <CardTitle>Rencana jangka panjang (opsional)</CardTitle>
                    <p className="-mt-1 mb-3 text-[12px] leading-snug text-[#64748b]">Boleh dikosongkan bila belum menentukan arah karier; isi kapan saja.</p>
                    <div className="space-y-3">
                        <Field label="Cita-cita / gambaran masa depan" htmlFor="dream">
                            <Textarea id="dream" rows={3} value={future.dream ?? ''} onChange={(event) => setFuture({ ...future, dream: event.target.value })} />
                        </Field>
                        <Field label="Rencana karier (opsional)" htmlFor="career">
                            <Textarea id="career" rows={3} value={future.career_plan ?? ''} onChange={(event) => setFuture({ ...future, career_plan: event.target.value })} />
                        </Field>
                        <Field label="Rencana pendidikan (opsional)" htmlFor="education">
                            <Textarea id="education" rows={3} value={future.education_plan ?? ''} onChange={(event) => setFuture({ ...future, education_plan: event.target.value })} />
                        </Field>
                        <Field label="Langkah besar menuju rencana" htmlFor="targets">
                            <Textarea id="targets" rows={3} value={future.concrete_targets ?? ''} onChange={(event) => setFuture({ ...future, concrete_targets: event.target.value })} />
                        </Field>
                    </div>
                    <p className="mt-3 text-[11px] text-[#5b6b7f]">Setiap perubahan disimpan sebagai versi baru.</p>
                    <Button className="mt-3 h-11 w-full" onClick={saveFuture} disabled={busy}>Simpan rencana</Button>
                </Card>
            </div>

            <Sheet
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                title="Tambah target bulanan"
                footer={
                    <>
                        <Button variant="outline" className="h-11 flex-1" onClick={() => setModalOpen(false)}>Batal</Button>
                        <Button type="submit" form="target-form" className="h-11 flex-1" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan target'}</Button>
                    </>
                }
            >
                <form id="target-form" onSubmit={addTarget} className="space-y-3">
                    <Field label="Target" required htmlFor="title">
                        <Input id="title" className="h-11" value={targetForm.title} onChange={(event) => setTargetForm({ ...targetForm, title: event.target.value })} required />
                    </Field>
                    <Field label="Indikator keberhasilan" required htmlFor="indicator">
                        <Textarea id="indicator" rows={3} value={targetForm.success_indicator} onChange={(event) => setTargetForm({ ...targetForm, success_indicator: event.target.value })} required />
                    </Field>
                    <Field label="Dasar target" htmlFor="basis" hint="Pilih dari mana target ini berasal.">
                        <Select id="basis" value={targetForm.basis} onChange={(event) => setTargetForm({ ...targetForm, basis: event.target.value })}>
                            <option value="general">Umum</option>
                            <option value="reflection">Dari refleksi</option>
                            <option value="future_plan">Dari rencana masa depan</option>
                        </Select>
                    </Field>
                    <Field label="Langkah kecil (opsional)" hint="Maksimal 10 langkah. Bisa dicentang saat selesai.">
                        <div className="space-y-2">
                            {(targetForm.steps ?? []).map((step, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <Input
                                        className="min-w-0 flex-1"
                                        placeholder={`Langkah ${index + 1}`}
                                        aria-label={`Langkah ${index + 1}`}
                                        value={step}
                                        onChange={(event) => {
                                            const steps = [...targetForm.steps];
                                            steps[index] = event.target.value;
                                            setTargetForm({ ...targetForm, steps });
                                        }}
                                    />
                                    <IconButton
                                        icon="trash"
                                        label={`Hapus langkah ${index + 1}`}
                                        variant="danger"
                                        size={44}
                                        onClick={() => setTargetForm({ ...targetForm, steps: targetForm.steps.filter((_, position) => position !== index) })}
                                    />
                                </div>
                            ))}
                        </div>
                    </Field>
                    <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        disabled={(targetForm.steps ?? []).length >= 10}
                        onClick={() => setTargetForm({ ...targetForm, steps: [...(targetForm.steps ?? []), ''] })}
                    >
                        Tambah langkah
                    </Button>
                </form>
            </Sheet>
        </AppShell>
    );
}
