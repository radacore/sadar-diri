import { useEffect, useRef, useState } from 'react';
import { Button, Field, Input } from '../../Components/UI';
import AuthLayout from '../../Layouts/AuthLayout';
import { api } from '../../lib/api';

export default function TwoFactor({ maskedEmail, resendSeconds = 0, devCode = null }) {
    const [code, setCode] = useState('');
    const [message, setMessage] = useState('');
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState(false);
    const [wait, setWait] = useState(resendSeconds);
    const inputRef = useRef(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    useEffect(() => {
        if (wait <= 0) return undefined;

        const timer = setTimeout(() => setWait((current) => Math.max(0, current - 1)), 1000);

        return () => clearTimeout(timer);
    }, [wait]);

    const submit = async (event) => {
        event.preventDefault();
        setBusy(true);
        setMessage('');
        setNotice('');

        try {
            const response = await api.post('/api/auth/2fa/verify', { code });
            window.location.href = response.data.redirect_to;
        } catch (error) {
            setMessage(error.message);
            setCode('');
            inputRef.current?.focus();
            setBusy(false);
        }
    };

    const resend = async () => {
        setMessage('');
        setNotice('');

        try {
            const response = await api.post('/api/auth/2fa/resend');
            setNotice(response.message ?? 'Kode baru dikirim.');
            setWait(response.data?.retry_after ?? 60);
            setCode('');
            inputRef.current?.focus();
        } catch (error) {
            setMessage(error.message);

            if (error.payload?.data?.retry_after) {
                setWait(error.payload.data.retry_after);
            }
        }
    };

    return (
        <AuthLayout
            title="Verifikasi dua faktor"
            subtitle={
                devCode
                    ? 'Mode pengembangan: email tidak dikirim, gunakan kode tetap di bawah.'
                    : maskedEmail
                        ? `Kode 6 digit dikirim ke ${maskedEmail}.`
                        : 'Kode 6 digit dikirim ke email akun Anda.'
            }
        >
            <form onSubmit={submit} className="space-y-4">
                {devCode ? (
                    <p role="status" className="rounded-xl bg-[#e8eaf6] px-3 py-2 text-[12px] leading-relaxed text-[#303f9f]">
                        Kode pengembangan: <b className="tabular tracking-[0.2em]">{devCode}</b>
                    </p>
                ) : null}

                <Field label="Kode 6 digit" required htmlFor="code" hint="Berlaku 10 menit dan hanya dapat dipakai sekali.">
                    <Input
                        id="code"
                        ref={inputRef}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        value={code}
                        onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="123456"
                        className="text-center text-[20px] font-bold tracking-[0.4em] tabular"
                    />
                </Field>

                {message ? (
                    <p role="alert" className="rounded-xl bg-[#fee2e2] px-3 py-2 text-[12px] text-[#991b1b]">{message}</p>
                ) : null}

                {notice ? (
                    <p role="status" className="rounded-xl bg-[#d1fae5] px-3 py-2 text-[12px] text-[#065f46]">{notice}</p>
                ) : null}

                <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>
                    {busy ? 'Memverifikasi…' : 'Verifikasi'}
                </Button>
            </form>

            <div className="mt-4 flex flex-col items-center gap-1 text-center">
                <button
                    type="button"
                    onClick={resend}
                    disabled={wait > 0}
                    className="text-[12px] font-semibold text-[#3f51b5] disabled:text-[#94a3b8]"
                >
                    {wait > 0 ? `Kirim ulang dalam ${wait} detik` : 'Kirim ulang kode'}
                </button>
                <a href="/masuk" className="text-[11.5px] text-[#475569] hover:text-[#3f51b5]">Kembali ke halaman masuk</a>
            </div>
        </AuthLayout>
    );
}
