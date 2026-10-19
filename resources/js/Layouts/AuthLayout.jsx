import { Link } from '@inertiajs/react';

export default function AuthLayout({ title, subtitle, children, footer }) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-[#eceff4] p-4">
            <div className="grid w-full max-w-[980px] overflow-hidden rounded-[28px] bg-white shadow-[0_20px_32px_-8px_rgba(15,23,42,0.14)] lg:grid-cols-[380px_1fr]">
                <div className="relative hidden flex-col justify-between bg-[#374987] p-8 text-white lg:flex">
                    <div className="flex items-center gap-2">
                        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#5c73db] text-[12px] font-bold">SD</span>
                        <span className="text-[18px] font-bold tracking-tight">SADAR DIRI</span>
                    </div>
                    <div>
                        <p className="text-[24px] font-bold leading-tight tracking-tight">
                            Ruang aman untuk mengenali diri, satu hari satu langkah.
                        </p>
                        <p className="mt-3 text-[13px] leading-relaxed text-[#cbd5e1]">
                            Catat emosi, refleksikan pekanmu, dan susun rencana. Data pribadimu terenkripsi dan hanya
                            dapat dibaca Guru BK kelasmu.
                        </p>
                    </div>
                    <div className="space-y-2 text-[12px] text-[#cbd5e1]">
                        <p>Enam aspek kesejahteraan psikologis Ryff</p>
                        <div className="flex flex-wrap gap-1.5">
                            {['Penerimaan diri', 'Relasi positif', 'Kemandirian', 'Penguasaan diri', 'Tujuan hidup', 'Pertumbuhan'].map((tag) => (
                                <span key={tag} className="rounded-full bg-white/10 px-2.5 py-1">{tag}</span>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-6 sm:p-10">
                    <div className="mb-6 flex items-center gap-2 lg:hidden">
                        <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#374987] text-[11px] font-bold text-white">SD</span>
                        <span className="text-[17px] font-bold tracking-tight">SADAR DIRI</span>
                    </div>
                    <h1 className="text-[24px] font-bold tracking-tight">{title}</h1>
                    {subtitle ? <p className="mt-1 text-[13px] text-[#475569]">{subtitle}</p> : null}
                    <div className="mt-6">{children}</div>
                    {footer ? <div className="mt-6 text-[12px] text-[#475569]">{footer}</div> : null}
                    <p className="mt-8 text-[11px] text-[#5b6b7f]">
                        <Link href="/" className="hover:text-[#3f51b5]">Kembali ke beranda</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
