import { Link } from '@inertiajs/react';
import { useState } from 'react';
import { Button, Field, Input } from '../../Components/UI';
import AuthLayout from '../../Layouts/AuthLayout';
import { api } from '../../lib/api';

export default function Login() {
    const [form, setForm] = useState({ identity: '', password: '', remember: false });
    const [errors, setErrors] = useState({});
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);

    const submit = async (event) => {
        event.preventDefault();
        setBusy(true);
        setErrors({});
        setMessage('');

        try {
            const response = await api.post('/api/auth/login', form);
            window.location.href = response.data.redirect_to;
        } catch (error) {
            setMessage(error.message);
            setErrors(error.details ?? {});
            setBusy(false);
        }
    };

    return (
        <AuthLayout
            title="Masuk"
            subtitle="Gunakan email atau NIS/NIP yang terdaftar di sekolah."
            footer={
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <Link href="/lupa-sandi" className="font-semibold text-[#3f51b5]">Lupa kata sandi?</Link>
                    <span>Belum punya akun? Hubungi Guru BK atau admin sekolah.</span>
                </div>
            }
        >
            <form onSubmit={submit} className="space-y-4" noValidate>
                <Field label="Email atau NIS/NIP" required htmlFor="identity">
                    <Input
                        id="identity"
                        autoComplete="username"
                        value={form.identity}
                        onChange={(event) => setForm({ ...form, identity: event.target.value })}
                        placeholder="nama@sekolah.sch.id atau 2024001"
                        required
                    />
                </Field>
                <Field label="Kata sandi" required htmlFor="password" error={errors.password?.[0]}>
                    <Input
                        id="password"
                        type="password"
                        autoComplete="current-password"
                        value={form.password}
                        onChange={(event) => setForm({ ...form, password: event.target.value })}
                        required
                    />
                </Field>
                <label className="flex items-center gap-2 text-[12px] text-[#475569]">
                    <input
                        type="checkbox"
                        className="h-[18px] w-[18px] rounded-[6px] border-[1.5px] border-[#cbd5e1] accent-[#3f51b5]"
                        checked={form.remember}
                        onChange={(event) => setForm({ ...form, remember: event.target.checked })}
                    />
                    Ingat saya di perangkat ini
                </label>

                {message ? (
                    <p role="alert" className="rounded-xl bg-[#fee2e2] px-3 py-2 text-[12px] text-[#991b1b]">
                        {message}
                    </p>
                ) : null}

                <Button type="submit" variant="primary" className="w-full" disabled={busy}>
                    {busy ? 'Memeriksa…' : 'Masuk'}
                </Button>
            </form>
        </AuthLayout>
    );
}
