import { useCallback, useEffect, useState } from 'react';
import { Button, Card, CardTitle, Skeleton, Stat, useConfirm, useToast } from '../../Components/UI';
import AppShell from '../../Layouts/AppShell';
import { api } from '../../lib/api';
import { formatDateNumeric } from '../../lib/format';

export default function Retention() {
    const toast = useToast();
    const confirm = useConfirm();
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState(null);

    const load = useCallback(async () => {
        try {
            const response = await api.get('/api/admin/retention/preview');
            setPreview(response.data);
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        load();
    }, [load]);

    const run = async () => {
        const decision = await confirm({
            title: 'Jalankan retensi?',
            description: 'Data siswa alumni akan dianonimkan dan jurnal serta refleksinya dihapus permanen. Tindakan ini tidak dapat dibatalkan.',
            details: preview ? [
                { label: 'Akun dianonimkan', value: String(preview.students_to_anonymize) },
                { label: 'Entri dihapus', value: String(preview.journals_to_purge) },
            ] : undefined,
            confirmLabel: 'Jalankan retensi',
            tone: 'danger',
            icon: 'trash',
            requireReason: 'Alasan menjalankan retensi',
        });
        if (!decision) return;

        setBusy(true);
        try {
            const response = await api.post('/api/admin/retention/run', { confirm: true, reason: decision.reason });
            setResult(response.data);
            toast.push('Proses retensi selesai.');
            await load();
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <AppShell title="Retensi & penghapusan" subtitle="Kebijakan penyimpanan dan anonimisasi data">
            {loading ? <Skeleton rows={4} /> : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
                    <Card className="lg:col-span-3"><Stat label="Akan dianonimkan" value={preview.students_to_anonymize} hint="akun alumni" /></Card>
                    <Card className="lg:col-span-3"><Stat label="Entri dihapus" value={preview.journals_to_purge} hint="jurnal & refleksi" /></Card>
                    <Card className="lg:col-span-3"><Stat label="Batas tanggal" value={formatDateNumeric(preview.cutoff_date)} hint="cutoff" size="sm" /></Card>
                    <Card className="lg:col-span-3"><Stat label="Kebijakan" value={`${preview.policy_years_after_graduation} th`} hint="setelah lulus" /></Card>

                    <Card className="lg:col-span-7">
                        <CardTitle>Jalankan retensi</CardTitle>
                        <p className="mb-3 text-[12px] leading-relaxed text-[#475569]">
                            Data siswa yang telah lulus lebih dari {preview.policy_years_after_graduation} tahun akan dianonimkan:
                            nama, email, dan NIS diganti; jurnal dan refleksi dihapus; audit log tetap disimpan.
                        </p>
                        <div className="flex justify-end">
                            <Button variant="danger" onClick={run} disabled={busy}>{busy ? 'Memproses…' : 'Jalankan retensi'}</Button>
                        </div>
                        {result ? (
                            <div className="mt-3 rounded-xl bg-[#d1fae5] p-3 text-[12px] text-[#065f46]">
                                Selesai. {result.students_anonymized} akun dianonimkan. Job {result.job_id}.
                            </div>
                        ) : null}
                    </Card>

                    <Card className="lg:col-span-5">
                        <CardTitle>Ketentuan</CardTitle>
                        <ul className="space-y-2 text-[12px] text-[#475569]">
                            <li>• Data aktif selama siswa terdaftar.</li>
                            <li>• Diarsipkan {preview.policy_years_after_graduation} tahun setelah lulus.</li>
                            <li>• Setelah itu dianonimkan; agregat dipertahankan.</li>
                            <li>• Audit log tidak dihapus.</li>
                            <li>• Permintaan penghapusan individual diproses melalui halaman pengguna.</li>
                        </ul>
                    </Card>
                </div>
            )}
        </AppShell>
    );
}
