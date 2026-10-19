import { useState } from 'react';
import { Button, Field, Input, useConfirm } from '../../Components/UI';
import AuthLayout from '../../Layouts/AuthLayout';
import { api } from '../../lib/api';

export default function Activate({ userId, name, signature, expires }) {
    const confirm = useConfirm();
    const [form, setForm] = useState({ password: '', password_confirmation: '' });
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);

    const submit = async (event) => {
        event.preventDefault();

        const decision = await confirm({
            title: 'Aktifkan akun?',
            description: `Kata sandi permanen akan disimpan untuk akun ${name ?? ''}.`,
            confirmLabel: 'Aktifkan akun',
            tone: 'success',
            icon: 'check',
        });
        if (!decision) return;

        setBusy(true);
        setMessage('');

        const query = new URLSearchParams({ signature: signature ?? '', expires: expires ?? '' }).toString();

        try {
            await api.post(`/api/auth/activate?${query}`, {
                user_id: userId,
                ...form,
            });
            setMessage('Akun aktif. Mengalihkan ke halaman masuk…');
            setTimeout(() => {
                window.location.href = '/masuk';
            }, 1200);
        } catch (error) {
            setMessage(error.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <AuthLayout title={`Aktivasi akun ${name ?? ''}`} subtitle="Buat kata sandi permanen untuk mulai menggunakan SADAR DIRI.">
            <form onSubmit={submit} className="space-y-4">
                <Field label="Kata sandi baru" required htmlFor="password">
                    <Input id="password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
                </Field>
                <Field label="Ulangi kata sandi" required htmlFor="confirm">
                    <Input id="confirm" type="password" value={form.password_confirmation} onChange={(event) => setForm({ ...form, password_confirmation: event.target.value })} required />
                </Field>
                {message ? (
                    <p role="status" className="rounded-xl bg-[#e8eaf6] px-3 py-2 text-[12px] text-[#303f9f]">{message}</p>
                ) : null}
                <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Menyimpan…' : 'Aktifkan akun'}</Button>
            </form>
        </AuthLayout>
    );
}
