import { useEffect, useState } from 'react';
import { Button, Field, Input } from '../../Components/UI';
import AuthLayout from '../../Layouts/AuthLayout';
import { api } from '../../lib/api';

export default function TwoFactor({ mode }) {
    const [code, setCode] = useState('');
    const [recoveryCode, setRecoveryCode] = useState('');
    const [enrollment, setEnrollment] = useState(null);
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (mode !== 'enroll') return;

        api.post('/api/auth/2fa/enroll')
            .then((response) => setEnrollment(response.data))
            .catch((error) => setMessage(error.message));
    }, [mode]);

    const submit = async (event) => {
        event.preventDefault();
        setBusy(true);
        setMessage('');

        try {
            if (mode === 'enroll') {
                const response = await api.post('/api/auth/2fa/confirm', { code });
                window.location.href = response.data.redirect_to;
            } else {
                const response = await api.post('/api/auth/2fa/verify', {
                    code: code || null,
                    recovery_code: recoveryCode || null,
                });
                window.location.href = response.data.redirect_to;
            }
        } catch (error) {
            setMessage(error.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <AuthLayout
            title={mode === 'enroll' ? 'Aktifkan verifikasi dua faktor' : 'Verifikasi dua faktor'}
            subtitle={
                mode === 'enroll'
                    ? 'Superadmin wajib mengaktifkan TOTP sebelum mengakses panel.'
                    : 'Masukkan kode 6 digit dari aplikasi authenticator Anda.'
            }
        >
            {mode === 'enroll' && enrollment ? (
                <div className="mb-4 space-y-3 rounded-xl bg-[#f1f5f9] p-3 text-[12px]">
                    <div>
                        <p className="font-semibold">Secret</p>
                        <code className="tabular break-all text-[12px]">{enrollment.secret}</code>
                    </div>
                    <div>
                        <p className="font-semibold">Tautan otpauth</p>
                        <code className="break-all text-[11px] text-[#475569]">{enrollment.otpauth_url}</code>
                    </div>
                    <div>
                        <p className="font-semibold">Kode pemulihan (simpan sekarang)</p>
                        <div className="mt-1 grid grid-cols-2 gap-1 font-mono text-[11px]">
                            {enrollment.recovery_codes.map((item) => (
                                <span key={item} className="rounded bg-white px-2 py-1">{item}</span>
                            ))}
                        </div>
                    </div>
                </div>
            ) : null}

            <form onSubmit={submit} className="space-y-4">
                <Field label="Kode 6 digit" required htmlFor="code">
                    <Input id="code" inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value)} placeholder="123456" />
                </Field>
                {mode === 'challenge' ? (
                    <Field label="Atau kode pemulihan" htmlFor="recovery">
                        <Input id="recovery" value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value)} placeholder="1234-5678" />
                    </Field>
                ) : null}
                {message ? (
                    <p role="alert" className="rounded-xl bg-[#fee2e2] px-3 py-2 text-[12px] text-[#991b1b]">{message}</p>
                ) : null}
                <Button type="submit" variant="primary" className="w-full" disabled={busy || (mode === 'enroll' && !enrollment)}>
                    {busy ? 'Memverifikasi…' : 'Verifikasi'}
                </Button>
            </form>
        </AuthLayout>
    );
}
