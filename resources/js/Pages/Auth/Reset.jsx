import { Link } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { Button, Field, Input, useConfirm } from '../../Components/UI';
import AuthLayout from '../../Layouts/AuthLayout';
import { api } from '../../lib/api';

export default function Reset() {
    const confirm = useConfirm();
    const params = useMemo(() => new URLSearchParams(window.location.search), []);
    const [form, setForm] = useState({
        email: params.get('email') ?? '',
        token: params.get('token') ?? '',
        password: '',
        password_confirmation: '',
    });
    const [errors, setErrors] = useState({});
    const [message, setMessage] = useState('');

    const submit = async (event) => {
        event.preventDefault();

        const decision = await confirm({
            title: 'Simpan kata sandi baru?',
            description: 'Kata sandi lama tidak akan berlaku setelah perubahan ini.',
            confirmLabel: 'Simpan kata sandi',
            tone: 'warning',
            icon: 'shield',
        });
        if (!decision) return;

        setErrors({});
        setMessage('');

        try {
            const response = await api.post('/api/auth/reset-password', form);
            setMessage(response.message);
            setTimeout(() => {
                window.location.href = '/masuk';
            }, 1200);
        } catch (error) {
            setMessage(error.message);
            setErrors(error.details ?? {});
        }
    };

    return (
        <AuthLayout title="Atur ulang kata sandi" subtitle="Minimal 10 karakter, memuat huruf besar, huruf kecil, dan angka.">
            <form onSubmit={submit} className="space-y-4">
                <Field label="Email" required htmlFor="email" error={errors.email?.[0]}>
                    <Input id="email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
                </Field>
                <input type="hidden" value={form.token} readOnly />
                <Field label="Kata sandi baru" required htmlFor="password" error={errors.password?.[0]}>
                    <Input id="password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
                </Field>
                <Field label="Ulangi kata sandi" required htmlFor="password_confirmation">
                    <Input
                        id="password_confirmation"
                        type="password"
                        value={form.password_confirmation}
                        onChange={(event) => setForm({ ...form, password_confirmation: event.target.value })}
                        required
                    />
                </Field>
                {message ? (
                    <p role="status" className="rounded-xl bg-[#e8eaf6] px-3 py-2 text-[12px] text-[#303f9f]">{message}</p>
                ) : null}
                <Button type="submit" className="w-full">Simpan kata sandi</Button>
                <Link href="/masuk" className="block text-center text-[12px] font-semibold text-[#3f51b5]">Kembali ke masuk</Link>
            </form>
        </AuthLayout>
    );
}
