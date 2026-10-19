import { useState } from 'react';
import { Button, Card, useConfirm } from '../../Components/UI';
import AuthLayout from '../../Layouts/AuthLayout';
import { api } from '../../lib/api';

const points = [
    'Data emosi, jurnal, curhat, dan refleksi dienkripsi saat disimpan.',
    'Hanya Guru BK kelas Anda yang dapat membaca isi jurnal. Superadmin tidak dapat membuka isi jurnal.',
    'Setiap pembukaan data Anda tercatat dan dapat Anda lihat pada halaman Privasi.',
    'Anda dapat mencabut persetujuan kapan saja; fitur jurnal akan nonaktif dan data diproses untuk penghapusan.',
    'Data disimpan selama Anda terdaftar, diarsipkan 3 tahun setelah lulus, lalu dianonimkan.',
];

export default function Consent({ version }) {
    const confirm = useConfirm();
    const [accepted, setAccepted] = useState(false);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');

    const submit = async () => {
        const decision = await confirm({
            title: 'Setujui pemrosesan data?',
            description: 'Data Anda dienkripsi dan hanya dapat dibaca oleh Guru BK kelas Anda.',
            confirmLabel: 'Setujui',
            tone: 'primary',
            icon: 'shield',
        });
        if (!decision) return;

        setBusy(true);
        setMessage('');

        try {
            await api.post('/api/auth/consent', { version, accepted: true });
            window.location.href = '/siswa/beranda';
        } catch (error) {
            setMessage(error.message);
            setBusy(false);
        }
    };

    const decline = async () => {
        await api.post('/api/auth/logout').catch(() => {});
        window.location.href = '/masuk';
    };

    return (
        <AuthLayout title="Persetujuan pemrosesan data" subtitle={`Versi kebijakan ${version}`}>
            <Card className="border border-[#e2e8f0] shadow-none">
                <p className="text-[13px] leading-relaxed text-[#475569]">
                    SADAR DIRI membantu Anda mengenali emosi, merefleksikan pengalaman, dan menyusun rencana.
                    Sebelum mulai, mohon membaca ringkasan berikut.
                </p>
                <ul className="mt-3 space-y-2 text-[13px]">
                    {points.map((point) => (
                        <li key={point} className="flex gap-2">
                            <span aria-hidden="true" className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#3f51b5]" />
                            <span>{point}</span>
                        </li>
                    ))}
                </ul>
            </Card>

            <label className="mt-4 flex items-start gap-2 text-[12px]">
                <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(event) => setAccepted(event.target.checked)}
                    className="mt-[2px] h-[18px] w-[18px] rounded-[6px] border-[1.5px] border-[#cbd5e1] accent-[#3f51b5]"
                />
                <span>Saya menyetujui pemrosesan data psikologis saya sesuai ringkasan di atas.</span>
            </label>

            {message ? <p className="mt-3 rounded-xl bg-[#fee2e2] px-3 py-2 text-[12px] text-[#991b1b]">{message}</p> : null}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button onClick={submit} disabled={!accepted || busy} className="flex-1">
                    {busy ? 'Menyimpan…' : 'Setuju dan lanjut'}
                </Button>
                <Button variant="outline" onClick={decline}>Belum sekarang</Button>
            </div>
        </AuthLayout>
    );
}
