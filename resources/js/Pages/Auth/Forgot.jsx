import { Link } from '@inertiajs/react';
import { useState } from 'react';
import { Button, Field, Input, useConfirm } from '../../Components/UI';
import AuthLayout from '../../Layouts/AuthLayout';
import { api } from '../../lib/api';

export default function Forgot() {
    const confirm = useConfirm();
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);

    const submit = async (event) => {
        event.preventDefault();

        const decision = await confirm({
            title: 'Kirim tautan reset?',
            description: 'Tautan atur ulang kata sandi akan dikirim ke email berikut.',
            details: [{ label: 'Email', value: email }],
            confirmLabel: 'Kirim tautan',
            tone: 'info',
            icon: 'send',
        });
        if (!decision) return;

        setBusy(true);

        try {
            const response = await api.post('/api/auth/forgot-password', { email });
            setMessage(response.message);
        } catch (error) {
            setMessage(error.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <AuthLayout
            title="Lupa kata sandi"
            subtitle="Masukkan email terdaftar. Tautan reset berlaku 30 menit."
            footer={<Link href="/masuk" className="font-semibold text-[#3f51b5]">Kembali ke halaman masuk</Link>}
        >
            <form onSubmit={submit} className="space-y-4">
                <Field label="Email" required htmlFor="email">
                    <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                </Field>
                {message ? (
                    <p role="status" className="rounded-xl bg-[#e8eaf6] px-3 py-2 text-[12px] text-[#303f9f]">{message}</p>
                ) : null}
                <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Mengirim…' : 'Kirim tautan reset'}</Button>
                <p className="text-[11px] text-[#5b6b7f]">
                    Di lingkungan lokal, email ditulis ke <code>storage/logs/laravel.log</code>.
                </p>
            </form>
        </AuthLayout>
    );
}
