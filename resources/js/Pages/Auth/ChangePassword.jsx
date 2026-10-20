import { useState } from 'react';
import { Button, Field, PasswordInput, useConfirm } from '../../Components/UI';
import { Icon } from '../../Components/Icons';
import AuthLayout from '../../Layouts/AuthLayout';
import { api } from '../../lib/api';

const rules = [
    { id: 'length', label: 'Minimal 10 karakter', test: (value) => value.length >= 10 },
    { id: 'lower', label: 'Mengandung huruf kecil', test: (value) => /[a-z]/.test(value) },
    { id: 'upper', label: 'Mengandung huruf besar', test: (value) => /[A-Z]/.test(value) },
    { id: 'digit', label: 'Mengandung angka', test: (value) => /[0-9]/.test(value) },
];

export default function ChangePassword({ identityNumber }) {
    const confirm = useConfirm();
    const [form, setForm] = useState({ current_password: '', password: '', password_confirmation: '' });
    const [errors, setErrors] = useState({});
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);

    const passed = rules.filter((rule) => rule.test(form.password));
    const mismatch = form.password_confirmation.length > 0 && form.password !== form.password_confirmation;
    const ready = passed.length === rules.length && form.password === form.password_confirmation && form.current_password.length > 0;

    const submit = async (event) => {
        event.preventDefault();
        setMessage('');

        if (!ready) {
            setErrors({ password: ['Kata sandi belum memenuhi semua syarat.'] });
            return;
        }

        const decision = await confirm({
            title: 'Simpan kata sandi baru?',
            description: 'Kata sandi awal tidak akan berlaku lagi setelah perubahan ini.',
            confirmLabel: 'Simpan kata sandi',
            tone: 'warning',
            icon: 'shield',
        });
        if (!decision) return;

        setBusy(true);
        setErrors({});

        try {
            const response = await api.put('/api/auth/password', form);
            setMessage(response.message);
            window.location.href = response.data?.redirect_to ?? '/';
        } catch (error) {
            setMessage(error.message);
            setErrors(error.details ?? {});
        } finally {
            setBusy(false);
        }
    };

    const logout = async () => {
        try {
            await api.post('/api/auth/logout');
        } finally {
            window.location.href = '/masuk';
        }
    };

    return (
        <AuthLayout
            title="Ganti kata sandi awal"
            subtitle="Demi keamanan, ganti kata sandi sebelum memakai aplikasi."
        >
            <form onSubmit={submit} className="space-y-4" noValidate>
                <p className="rounded-xl bg-[#e8eaf6] px-3 py-2.5 text-[12px] leading-relaxed text-[#303f9f]">
                    Akun Anda masih memakai kata sandi awal{identityNumber ? <> yaitu NIS/NIP <strong>{identityNumber}</strong></> : null}. Buat kata sandi pribadi yang hanya Anda ketahui.
                </p>

                <Field label="Kata sandi saat ini" required htmlFor="current_password" error={errors.current_password?.[0]}>
                    <PasswordInput
                        id="current_password"
                        value={form.current_password}
                        onChange={(event) => setForm({ ...form, current_password: event.target.value })}
                        placeholder="NIS/NIP atau kata sandi yang Anda terima"
                        autoComplete="current-password"
                        required
                    />
                </Field>

                <Field label="Kata sandi baru" required htmlFor="password" error={errors.password?.[0]}>
                    <PasswordInput
                        id="password"
                        value={form.password}
                        onChange={(event) => setForm({ ...form, password: event.target.value })}
                        placeholder="Minimal 10 karakter"
                        aria-describedby="password-rules"
                        required
                    />
                </Field>

                <ul id="password-rules" className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-xl bg-[#f8fafc] p-3" aria-live="polite">
                    {rules.map((rule) => {
                        const done = rule.test(form.password);

                        return (
                            <li key={rule.id} className={`flex items-center gap-1.5 text-[11.5px] ${done ? 'font-semibold text-[#047857]' : 'text-[#64748b]'}`}>
                                <span
                                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                                        done ? 'bg-[#d1fae5] text-[#047857]' : 'bg-[#e2e8f0] text-[#94a3b8]'
                                    }`}
                                    aria-hidden="true"
                                >
                                    <Icon name={done ? 'check' : 'close'} size={10} strokeWidth={3} />
                                </span>
                                {rule.label}
                            </li>
                        );
                    })}
                </ul>

                <Field
                    label="Ulangi kata sandi baru"
                    required
                    htmlFor="password_confirmation"
                    error={mismatch ? 'Konfirmasi kata sandi tidak sama.' : errors.password_confirmation?.[0]}
                    hint={!mismatch && form.password_confirmation && !errors.password_confirmation ? 'Kedua kata sandi cocok.' : undefined}
                >
                    <PasswordInput
                        id="password_confirmation"
                        value={form.password_confirmation}
                        onChange={(event) => setForm({ ...form, password_confirmation: event.target.value })}
                        placeholder="Ketik ulang kata sandi baru"
                        aria-invalid={mismatch}
                        required
                    />
                </Field>

                {message ? (
                    <p
                        role="status"
                        className={`rounded-xl px-3 py-2 text-[12px] ${
                            Object.keys(errors).length > 0 ? 'bg-[#fee2e2] text-[#991b1b]' : 'bg-[#e8eaf6] text-[#303f9f]'
                        }`}
                    >
                        {message}
                    </p>
                ) : null}

                <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? 'Menyimpan…' : 'Simpan kata sandi'}
                </Button>

                <button type="button" onClick={logout} className="block w-full text-center text-[12px] font-semibold text-[#64748b] hover:text-[#3f51b5]">
                    Keluar dari akun
                </button>
            </form>
        </AuthLayout>
    );
}
