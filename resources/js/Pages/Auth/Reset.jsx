import { Link } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { Button, Field, Input, PasswordInput, useConfirm } from '../../Components/UI';
import { Icon } from '../../Components/Icons';
import AuthLayout from '../../Layouts/AuthLayout';
import { api } from '../../lib/api';

const rules = [
    { id: 'length', label: 'Minimal 10 karakter', test: (value) => value.length >= 10 },
    { id: 'lower', label: 'Mengandung huruf kecil', test: (value) => /[a-z]/.test(value) },
    { id: 'upper', label: 'Mengandung huruf besar', test: (value) => /[A-Z]/.test(value) },
    { id: 'digit', label: 'Mengandung angka', test: (value) => /[0-9]/.test(value) },
];

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
    const [touched, setTouched] = useState(false);

    const passed = rules.filter((rule) => rule.test(form.password));
    const mismatch = form.password_confirmation.length > 0 && form.password !== form.password_confirmation;
    const ready = passed.length === rules.length && form.password === form.password_confirmation && form.email && form.token;

    const submit = async (event) => {
        event.preventDefault();
        setTouched(true);
        setMessage('');

        if (form.password !== form.password_confirmation) {
            setErrors({ password_confirmation: ['Konfirmasi kata sandi tidak sama.'] });
            return;
        }

        if (passed.length !== rules.length) {
            setErrors({ password: ['Kata sandi belum memenuhi semua syarat.'] });
            return;
        }

        const decision = await confirm({
            title: 'Simpan kata sandi baru?',
            description: 'Kata sandi lama tidak akan berlaku setelah perubahan ini.',
            confirmLabel: 'Simpan kata sandi',
            tone: 'warning',
            icon: 'shield',
        });
        if (!decision) return;

        setErrors({});

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

    if (!form.token || !form.email) {
        return (
            <AuthLayout title="Tautan tidak lengkap" subtitle="Tautan reset tidak memuat token atau email.">
                <div className="space-y-4">
                    <p className="rounded-xl bg-[#fef3c7] px-3 py-2.5 text-[12px] leading-relaxed text-[#92400e]">
                        Tautan yang Anda buka tidak valid atau sudah terpotong. Minta tautan baru dari halaman lupa kata sandi.
                    </p>
                    <Link href="/lupa-sandi" className="sd-btn sd-btn-primary w-full">Minta tautan baru</Link>
                    <Link href="/masuk" className="block text-center text-[12px] font-semibold text-[#3f51b5]">Kembali ke masuk</Link>
                </div>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout title="Atur ulang kata sandi" subtitle="Buat kata sandi baru untuk akun Anda.">
            <form onSubmit={submit} className="space-y-4" noValidate>
                <Field label="Email" required htmlFor="email" error={errors.email?.[0]} hint="Email akun yang meminta reset. Tidak dapat diubah.">
                    <div className="relative">
                        <Input
                            id="email"
                            type="email"
                            value={form.email}
                            readOnly
                            aria-readonly="true"
                            tabIndex={-1}
                            className="cursor-not-allowed bg-[#f1f5f9] pr-11 text-[#475569] focus:border-[#e2e8f0] focus:bg-[#f1f5f9] focus:shadow-none"
                        />
                        <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8]" aria-hidden="true">
                            <Icon name="lock" size={15} />
                        </span>
                    </div>
                </Field>

                <input type="hidden" value={form.token} readOnly />

                <Field label="Kata sandi baru" required htmlFor="password" error={errors.password?.[0]}>
                    <PasswordInput
                        id="password"
                        value={form.password}
                        onChange={(event) => setForm({ ...form, password: event.target.value })}
                        placeholder="Minimal 10 karakter"
                        aria-describedby="password-rules"
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
                    label="Ulangi kata sandi"
                    required
                    htmlFor="password_confirmation"
                    error={mismatch ? 'Konfirmasi kata sandi tidak sama.' : errors.password_confirmation?.[0]}
                    hint={!mismatch && form.password_confirmation && !errors.password_confirmation ? 'Kedua kata sandi cocok.' : undefined}
                >
                    <PasswordInput
                        id="password_confirmation"
                        value={form.password_confirmation}
                        onChange={(event) => setForm({ ...form, password_confirmation: event.target.value })}
                        placeholder="Ketik ulang kata sandi"
                        aria-invalid={mismatch}
                    />
                </Field>

                {message ? (
                    <p
                        role="status"
                        className={`rounded-xl px-3 py-2 text-[12px] ${
                            errors && Object.keys(errors).length > 0 ? 'bg-[#fee2e2] text-[#991b1b]' : 'bg-[#e8eaf6] text-[#303f9f]'
                        }`}
                    >
                        {message}
                    </p>
                ) : null}

                <Button type="submit" className="w-full">
                    Simpan kata sandi
                </Button>

                {touched && !ready ? (
                    <p role="alert" className="text-center text-[11.5px] text-[#b45309]">
                        Kata sandi belum memenuhi syarat atau konfirmasi tidak sama.
                    </p>
                ) : null}

                <Link href="/masuk" className="block text-center text-[12px] font-semibold text-[#3f51b5]">Kembali ke masuk</Link>
            </form>
        </AuthLayout>
    );
}
