import { Link, router, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../Components/Icons';
import { useConfirm } from '../Components/UI';
import { api } from '../lib/api';
import { initials } from '../lib/format';

const navigation = {
    student: [
        { href: '/siswa/beranda', label: 'Beranda', icon: 'home', short: 'Beranda', keywords: 'dashboard home mood' },
        { href: '/siswa/profil', label: 'Info', icon: 'user', short: 'Info', keywords: 'profil biodata diri' },
        { href: '/siswa/jurnal', label: 'Jurnal', icon: 'book', short: 'Jurnal', keywords: 'curhat abc grateful menulis' },
        { href: '/siswa/portofolio', label: 'Portofolio', icon: 'sparkle', short: 'Porto', keywords: 'prestasi lomba bukti' },
        { href: '/siswa/refleksi', label: 'Refleksi', icon: 'clock', short: 'Refleksi', keywords: 'refleksi terbimbing umpan balik' },
        { href: '/siswa/rencana', label: 'Rencana', icon: 'target', short: 'Rencana', keywords: 'target evaluasi masa depan cita-cita' },
        { href: '/siswa/privasi', label: 'Privasi', icon: 'shield', short: 'Privasi', keywords: 'persetujuan data akses log pengingat' },
    ],
    counselor: [
        { href: '/bk/dashboard', label: 'Dashboard', icon: 'home', short: 'Dashboard', keywords: 'ringkasan kelas' },
        { href: '/bk/alert', label: 'Alert', icon: 'alert', short: 'Alert', keywords: 'peringatan risiko' },
        { href: '/bk/siswa', label: 'Siswa', icon: 'users', short: 'Siswa', keywords: 'daftar siswa kelas' },
        { href: '/bk/refleksi', label: 'Refleksi', icon: 'clock', short: 'Refleksi', keywords: 'sesi terbimbing umpan balik' },
        { href: '/bk/verifikasi', label: 'Verifikasi', icon: 'check', short: 'Verifikasi', keywords: 'prestasi bukti' },
        { href: '/bk/catatan', label: 'Catatan', icon: 'file', short: 'Catatan', keywords: 'konseling catatan' },
        { href: '/bk/laporan', label: 'Laporan', icon: 'chart', short: 'Laporan', keywords: 'ekspor csv pdf' },
    ],
    superadmin: [
        { href: '/admin/dashboard', label: 'Dashboard', icon: 'home', short: 'Dashboard', keywords: 'ringkasan data' },
        { href: '/admin/pengguna', label: 'Pengguna', icon: 'users', short: 'Akun', keywords: 'akun siswa guru bk impor csv' },
        { href: '/admin/kelas', label: 'Kelas', icon: 'calendar', short: 'Kelas', keywords: 'rombel wali kelas' },
        { href: '/admin/tahun-ajaran', label: 'Tahun Ajaran', icon: 'clock', short: 'Tahun', keywords: 'kenaikan kelas promosi' },
        { href: '/admin/konten', label: 'Konten', icon: 'file', short: 'Konten', keywords: 'prompt artikel tips versi' },
        { href: '/admin/laporan', label: 'Laporan', icon: 'chart', short: 'Laporan', keywords: 'agregat ekspor' },
        { href: '/admin/pengumuman', label: 'Pengumuman', icon: 'bell', short: 'Umum', keywords: 'broadcast informasi' },
        { href: '/admin/audit', label: 'Audit', icon: 'shield', short: 'Audit', keywords: 'log aktivitas' },
        { href: '/admin/retensi', label: 'Retensi', icon: 'target', short: 'Retensi', keywords: 'anonimisasi alumni' },
        { href: '/admin/pengaturan', label: 'Pengaturan', icon: 'settings', short: 'Setelan', keywords: 'sekolah jam pengingat' },
    ],
};

// Lima tab bawah per peran. Halaman lain tetap dapat diakses lewat drawer
// dan menu profil; saat dibuka, tab terakhir berganti menjadi halaman itu.
const mobileNav = {
    student: ['/siswa/beranda', '/siswa/jurnal', '/siswa/refleksi', '/siswa/rencana', '/siswa/portofolio'],
    counselor: ['/bk/dashboard', '/bk/alert', '/bk/siswa', '/bk/verifikasi', '/bk/laporan'],
    superadmin: ['/admin/dashboard', '/admin/pengguna', '/admin/kelas', '/admin/konten', '/admin/pengaturan'],
};

const roleLabels = {
    student: 'Portal Siswa',
    counselor: 'Portal Guru BK',
    superadmin: 'Panel Admin',
};

function isActive(pathname, href) {
    return pathname === href || pathname.startsWith(`${href}/`);
}

function Avatar({ name, url, size = 36, className = '' }) {
    if (url) {
        return <img src={url} alt={name} className={`rounded-full object-cover ${className}`} style={{ width: size, height: size }} />;
    }

    return (
        <span
            className={`sd-avatar flex items-center justify-center rounded-full font-bold ${className}`}
            style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.34)) }}
            aria-hidden="true"
        >
            {initials(name)}
        </span>
    );
}

export default function AppShell({ children, title, subtitle, actions }) {
    const page = usePage();
    const { auth } = page.props;
    const user = auth?.user;
    const pathname = page.url.split('?')[0];
    const items = navigation[user?.role] ?? [];
    const barItems = (mobileNav[user?.role] ?? [])
        .map((href) => items.find((item) => item.href === href))
        .filter(Boolean);
    const currentItem = items.find((item) => isActive(pathname, item.href));
    const overflowItem = currentItem && !barItems.some((item) => item.href === currentItem.href) ? currentItem : null;
    const mobileItems = overflowItem ? [...barItems.slice(0, 4), overflowItem] : barItems;
    const confirm = useConfirm();

    const [unread, setUnread] = useState(0);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [query, setQuery] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const searchRef = useRef(null);
    const searchBoxRef = useRef(null);
    const menuRef = useRef(null);

    const results = useMemo(() => {
        const term = query.trim().toLowerCase();

        if (!term) return items;

        return items.filter((item) => `${item.label} ${item.keywords ?? ''}`.toLowerCase().includes(term));
    }, [items, query]);

    useEffect(() => {
        let active = true;

        api.get('/api/notifications?unread=true&per_page=1')
            .then((response) => {
                if (active) setUnread(response.meta?.unread ?? 0);
            })
            .catch(() => {});

        return () => {
            active = false;
        };
    }, [pathname]);

    useEffect(() => {
        setNotifOpen(false);
        setProfileOpen(false);
        setSearchOpen(false);
        setQuery('');
    }, [pathname]);

    useEffect(() => {
        const handler = (event) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                searchRef.current?.focus();
                setSearchOpen(true);
            }

            if (event.key === 'Escape') {
                setSearchOpen(false);
                setNotifOpen(false);
                setProfileOpen(false);
            }
        };

        const clickAway = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setNotifOpen(false);
                setProfileOpen(false);
            }

            if (searchBoxRef.current && !searchBoxRef.current.contains(event.target)) {
                setSearchOpen(false);
            }
        };

        document.addEventListener('keydown', handler);
        document.addEventListener('mousedown', clickAway);

        return () => {
            document.removeEventListener('keydown', handler);
            document.removeEventListener('mousedown', clickAway);
        };
    }, []);

    const goTo = (href) => {
        setSearchOpen(false);
        setQuery('');
        setProfileOpen(false);
        router.visit(href);
    };

    const openNotifications = async () => {
        setProfileOpen(false);
        const next = !notifOpen;
        setNotifOpen(next);

        if (!next) return;

        try {
            const response = await api.get('/api/notifications?per_page=10');
            setNotifications(response.data ?? []);
            setUnread(response.meta?.unread ?? 0);
        } catch {
            setNotifications([]);
        }
    };

    const readAll = async () => {
        const decision = await confirm({
            title: 'Tandai semua notifikasi dibaca?',
            description: 'Semua notifikasi akan ditandai sudah dibaca dan lencana pada lonceng hilang.',
            confirmLabel: 'Tandai dibaca',
            tone: 'info',
            icon: 'bell',
        });

        if (!decision) return;

        try {
            await api.post('/api/notifications/read-all');
            setUnread(0);
            setNotifications((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })));
        } catch {
            /* abaikan */
        }
    };

    const logout = async () => {
        const decision = await confirm({
            title: 'Keluar dari akun?',
            description: 'Sesi Anda di perangkat ini akan diakhiri. Data yang belum disimpan akan hilang.',
            confirmLabel: 'Keluar',
            tone: 'danger',
            icon: 'logout',
        });

        if (!decision) return;

        setProfileOpen(false);

        try {
            await api.post('/api/auth/logout');
        } finally {
            window.location.href = '/masuk';
        }
    };

    const profileLinks = user?.role === 'student'
        ? [{ href: '/siswa/profil', label: 'Info diri', icon: 'user' }, { href: '/siswa/privasi', label: 'Privasi & data', icon: 'shield' }]
        : user?.role === 'counselor'
            ? [{ href: '/bk/refleksi', label: 'Refleksi terbimbing', icon: 'clock' }, { href: '/bk/catatan', label: 'Catatan konseling', icon: 'file' }]
            : [{ href: '/admin/audit', label: 'Audit log', icon: 'shield' }, { href: '/admin/retensi', label: 'Retensi data', icon: 'target' }];

    return (
        <div className="mx-auto flex min-h-screen max-w-[1440px] items-stretch gap-6 p-3 pb-[calc(96px+env(safe-area-inset-bottom))] transition-all lg:p-5 lg:pb-5">
            <aside className="sticky top-5 hidden h-[calc(100vh-40px)] min-h-[640px] w-[248px] shrink-0 overflow-hidden rounded-[28px] lg:flex xl:w-[248px]">
                <div className="flex w-[62px] shrink-0 flex-col items-center gap-2.5 rounded-l-[28px] bg-[#5c73db] pt-[104px]">
                    {items.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            title={item.label}
                            aria-label={item.label}
                            className={`relative flex h-[42px] w-full items-center justify-center text-white transition ${
                                isActive(pathname, item.href) ? 'opacity-100' : 'opacity-75 hover:opacity-100'
                            }`}
                        >
                            {isActive(pathname, item.href) ? (
                                <span className="absolute left-0 h-5 w-[3.5px] rounded-r-full bg-white" />
                            ) : null}
                            <Icon name={item.icon} size={19} strokeWidth={isActive(pathname, item.href) ? 2.3 : 2} />
                        </Link>
                    ))}
                </div>
                <div className="relative flex flex-1 flex-col justify-between overflow-hidden rounded-r-[28px] bg-[#374987]">
                    <div className="flex h-[104px] items-center justify-center gap-2 pr-3 text-white">
                        <span className="text-[19px] font-bold tracking-tight">SADAR DIRI</span>
                    </div>
                    <div className="mb-auto flex flex-col gap-2.5 pl-2.5 pr-0">
                        {items.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`h-[42px] items-center px-5 text-left text-[13.5px] transition ${
                                    isActive(pathname, item.href)
                                        ? 'sd-nav-item-active flex'
                                        : 'flex text-[#cbd5e1] hover:text-white'
                                }`}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </div>
                    <div className="flex items-center justify-center pb-8 pt-6 pr-3">
                        <button
                            type="button"
                            onClick={logout}
                            className="flex items-center gap-2.5 text-[13.5px] font-medium text-white/90 transition hover:text-white active:scale-95"
                        >
                            <Icon name="logout" size={20} />
                            Keluar
                        </button>
                    </div>
                </div>
            </aside>

            <div className="flex min-w-0 flex-1 flex-col py-1 lg:pr-2">
                <div className="mb-2 flex items-center justify-between gap-2 lg:hidden">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setMobileOpen(true)}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#1e293b] shadow-sm"
                            aria-label="Buka menu"
                        >
                            <Icon name="menu" size={18} />
                        </button>
                        <div className="leading-none">
                            <span className="block text-[16px] font-extrabold tracking-tight">SADAR DIRI</span>
                            <span className="text-[10.5px] font-medium text-[#475569]">{roleLabels[user?.role] ?? ''}</span>
                        </div>
                    </div>
                </div>

                <header className="sd-topnav mb-4 flex flex-wrap items-center gap-2.5">
                    <div ref={searchBoxRef} className="relative order-2 w-full min-w-0 sm:order-1 sm:w-auto sm:flex-1 sm:max-w-[360px]">
                        <div className="sd-search flex h-[42px] items-center gap-2 rounded-full px-4">
                            <Icon name="search" size={17} className="shrink-0 text-[#475569]" />
                            <input
                                ref={searchRef}
                                value={query}
                                onChange={(event) => {
                                    setQuery(event.target.value);
                                    setSearchOpen(true);
                                }}
                                onFocus={() => setSearchOpen(true)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' && results[0]) {
                                        event.preventDefault();
                                        goTo(results[0].href);
                                    }
                                }}
                                placeholder="Cari halaman atau menu…"
                                aria-label="Cari halaman"
                                aria-expanded={searchOpen}
                                aria-controls="sd-search-results"
                                role="combobox"
                                className="h-full w-full bg-transparent text-[13px] text-[#1e293b] outline-none placeholder:text-[#64748b]"
                            />
                            <kbd className="hidden shrink-0 rounded-md border border-[#e2e8f0] bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[#64748b] lg:block">⌘K</kbd>
                        </div>

                        {searchOpen && (
                            <div className="sd-popover absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white p-1.5 shadow-[0_20px_40px_-12px_rgba(15,23,42,0.22)]">
                                <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#64748b]">
                                    {query.trim() ? 'Hasil' : 'Semua halaman'}
                                </p>
                                <div id="sd-search-results" role="listbox" className="max-h-[280px] overflow-y-auto">
                                    {results.length === 0 ? (
                                        <p className="px-3 py-4 text-center text-[12px] text-[#475569]">Tidak ada halaman yang cocok.</p>
                                    ) : results.map((item) => (
                                        <button
                                            key={item.href}
                                            type="button"
                                            role="option"
                                            aria-selected={isActive(pathname, item.href)}
                                            onClick={() => goTo(item.href)}
                                            className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] transition ${
                                                isActive(pathname, item.href)
                                                    ? 'bg-[#e8eaf6] font-semibold text-[#3f51b5]'
                                                    : 'text-[#1e293b] hover:bg-[#f1f5f9]'
                                            }`}
                                        >
                                            <Icon name={item.icon} size={16} />
                                            <span className="flex-1">{item.label}</span>
                                            <span className="text-[10px] text-[#94a3b8]">{item.href}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div ref={menuRef} className="order-1 ml-auto flex items-center gap-1.5 sm:order-2">
                        <div className="relative">
                            <button
                                type="button"
                                onClick={openNotifications}
                                aria-expanded={notifOpen}
                                className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#1e293b] shadow-sm transition hover:bg-[#e8eaf6] hover:text-[#3f51b5]"
                                aria-label={`Notifikasi${unread ? `, ${unread} belum dibaca` : ''}`}
                            >
                                <Icon name="bell" size={19} />
                                {unread > 0 ? (
                                    <>
                                        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#dc2626] px-1 text-[9px] font-bold text-white ring-2 ring-[#eceff4]">
                                            {unread > 9 ? '9+' : unread}
                                        </span>
                                    </>
                                ) : null}
                            </button>

                            {notifOpen ? (
                                <div className="sd-popover absolute right-0 top-[calc(100%+10px)] z-50 w-[330px] max-w-[calc(100vw-28px)] rounded-[22px] border border-[#e2e8f0] bg-white p-3 shadow-[0_24px_44px_-16px_rgba(15,23,42,0.28)]">
                                    <div className="mb-2 flex items-center justify-between gap-2 px-1">
                                        <p className="text-[13px] font-bold">Notifikasi</p>
                                        <button type="button" onClick={readAll} className="rounded-full bg-[#e8eaf6] px-2.5 py-1 text-[10.5px] font-semibold text-[#3f51b5] transition hover:bg-[#d7dcf5]">
                                            Tandai dibaca
                                        </button>
                                    </div>
                                    <div className="max-h-[340px] space-y-1.5 overflow-y-auto">
                                        {notifications.length === 0 ? (
                                            <p className="py-6 text-center text-[12px] text-[#475569]">Belum ada notifikasi.</p>
                                        ) : (
                                            notifications.map((item) => (
                                                <div key={item.id} className={`flex gap-2.5 rounded-2xl p-2.5 ${item.read_at ? 'bg-white' : 'bg-[#f1f5f9]'}`}>
                                                    <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${item.read_at ? 'bg-[#f1f5f9] text-[#64748b]' : 'bg-[#e8eaf6] text-[#3f51b5]'}`}>
                                                        <Icon name="bell" size={15} />
                                                    </span>
                                                    <div className="min-w-0">
                                                        <p className="text-[12px] font-semibold leading-snug">{item.title}</p>
                                                        <p className="text-[11px] leading-snug text-[#475569]">{item.body}</p>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        <span className="hidden h-7 w-px bg-[#dbe2ec] sm:block" aria-hidden="true" />

                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => {
                                    setProfileOpen((current) => !current);
                                    setNotifOpen(false);
                                }}
                                aria-expanded={profileOpen}
                                aria-haspopup="menu"
                                className="flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-1 shadow-sm transition hover:bg-[#f8fafc] sm:pr-2.5"
                            >
                                <Avatar name={user?.name} url={user?.avatar_url} size={32} />
                                <span className="hidden min-w-0 text-left sm:block">
                                    <span className="block max-w-[150px] truncate text-[12.5px] font-semibold leading-tight text-[#1e293b]">{user?.name}</span>
                                    <span className="block text-[10px] font-medium text-[#64748b]">{roleLabels[user?.role] ?? ''}</span>
                                </span>
                                <Icon name="chevron" size={15} className={`hidden shrink-0 text-[#64748b] transition-transform sm:block ${profileOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {profileOpen ? (
                                <div role="menu" className="sd-popover absolute right-0 top-[calc(100%+10px)] z-50 w-[260px] overflow-hidden rounded-[22px] border border-[#e2e8f0] bg-white p-2 shadow-[0_24px_44px_-16px_rgba(15,23,42,0.28)]">
                                    <div className="flex items-center gap-3 rounded-2xl bg-[#f8fafc] p-3">
                                        <Avatar name={user?.name} url={user?.avatar_url} size={40} />
                                        <div className="min-w-0">
                                            <p className="truncate text-[13px] font-bold">{user?.name}</p>
                                            <p className="truncate text-[11px] text-[#475569]">{user?.email ?? user?.identity_number}</p>
                                        </div>
                                    </div>
                                    <div className="mt-1.5 space-y-0.5">
                                        {profileLinks.map((link) => (
                                            <Link
                                                key={link.href}
                                                href={link.href}
                                                role="menuitem"
                                                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[12.5px] text-[#1e293b] transition hover:bg-[#f1f5f9]"
                                            >
                                                <Icon name={link.icon} size={16} className="text-[#3f51b5]" />
                                                {link.label}
                                            </Link>
                                        ))}
                                    </div>
                                    <div className="my-1.5 h-px bg-[#e2e8f0]" />
                                    <button
                                        type="button"
                                        role="menuitem"
                                        onClick={logout}
                                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[12.5px] font-semibold text-[#b91c1c] transition hover:bg-[#fee2e2]"
                                    >
                                        <Icon name="logout" size={16} />
                                        Keluar
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </header>

                <div key={pathname} className="sd-page">
                    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                        <div className="min-w-0">
                            <h1 className="truncate text-[22px] font-bold tracking-tight lg:text-[27px]">{title}</h1>
                            {subtitle ? <p className="text-[13px] text-[#475569]">{subtitle}</p> : null}
                        </div>
                        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
                    </div>

                    <main className="flex-1">{children}</main>
                </div>
            </div>

            {mobileOpen ? (
                <div className="sd-backdrop fixed inset-0 z-50 bg-[rgba(15,23,42,0.45)] backdrop-blur-[2px] lg:hidden" onClick={() => setMobileOpen(false)}>
                    <div
                        className="sd-drawer ml-auto h-full w-[280px] overflow-y-auto rounded-l-[24px] bg-[#374987] p-4"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="mb-4 flex items-center justify-between text-white">
                            <span className="text-[16px] font-bold">Menu</span>
                            <button type="button" onClick={() => setMobileOpen(false)} aria-label="Tutup menu" className="text-white/80">
                                <Icon name="close" size={20} />
                            </button>
                        </div>
                        <div className="space-y-1">
                            {items.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setMobileOpen(false)}
                                    className={`flex h-11 items-center gap-3 rounded-xl px-3 text-[13.5px] ${
                                        isActive(pathname, item.href)
                                            ? 'bg-white/95 font-semibold text-[#1e293b]'
                                            : 'text-[#cbd5e1] hover:bg-white/10 hover:text-white'
                                    }`}
                                >
                                    <Icon name={item.icon} size={18} />
                                    {item.label}
                                </Link>
                            ))}
                        </div>
                        <button type="button" onClick={logout} className="mt-6 flex items-center gap-2 text-[13px] text-white/80">
                            <Icon name="logout" size={18} /> Keluar
                        </button>
                    </div>
                </div>
            ) : null}

            <nav
                className="sd-mobile-nav fixed bottom-[calc(12px+env(safe-area-inset-bottom))] left-1/2 z-40 w-[calc(100%-24px)] max-w-[420px] -translate-x-1/2 lg:hidden"
                aria-label="Navigasi utama"
            >
                <div className="flex h-[68px] items-center justify-around overflow-visible rounded-[26px] border-t-[3px] border-[#5c73db] bg-[#374987] px-2 shadow-[0_12px_30px_-6px_rgba(24,34,53,0.35)]">
                    {mobileItems.map((item) => {
                        const active = isActive(pathname, item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                aria-current={active ? 'page' : undefined}
                                aria-label={item.label}
                                className={`flex h-full flex-1 flex-col items-center justify-center gap-1 text-[10px] transition-colors ${
                                    active ? 'font-bold text-white' : 'text-white/75 hover:text-white'
                                }`}
                            >
                                <span
                                    className={`-mt-[3px] flex h-[44px] w-[54px] items-center justify-center ${
                                        active ? 'sd-mobile-well relative z-20 rounded-b-full bg-[#eceff4]' : ''
                                    }`}
                                >
                                    {active ? (
                                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#5c73db] text-white shadow-md">
                                            <Icon name={item.icon} size={18} strokeWidth={2.3} />
                                        </span>
                                    ) : (
                                        <Icon name={item.icon} size={19} />
                                    )}
                                </span>
                                <span className="max-w-full truncate px-1">{item.short}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
}
