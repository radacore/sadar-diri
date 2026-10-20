import { Link, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../Components/Icons';
import { Button, Sheet, useConfirm } from '../Components/UI';
import { api } from '../lib/api';
import { formatDate, initials } from '../lib/format';

const navigation = {
    student: [
        { href: '/siswa/beranda', label: 'Beranda', icon: 'home', short: 'Beranda' },
        { href: '/siswa/profil', label: 'Info', icon: 'user', short: 'Info' },
        { href: '/siswa/jurnal', label: 'Jurnal', icon: 'book', short: 'Jurnal' },
        { href: '/siswa/portofolio', label: 'Portofolio', icon: 'sparkle', short: 'Porto' },
        { href: '/siswa/refleksi', label: 'Refleksi', icon: 'clock', short: 'Refleksi' },
        { href: '/siswa/rencana', label: 'Rencana', icon: 'target', short: 'Rencana' },
        { href: '/siswa/privasi', label: 'Privasi', icon: 'shield', short: 'Privasi' },
    ],
    counselor: [
        { href: '/bk/dashboard', label: 'Dashboard', icon: 'home', short: 'Dashboard' },
        { href: '/bk/alert', label: 'Alert', icon: 'alert', short: 'Alert' },
        { href: '/bk/siswa', label: 'Siswa', icon: 'users', short: 'Siswa' },
        { href: '/bk/refleksi', label: 'Refleksi', icon: 'clock', short: 'Refleksi' },
        { href: '/bk/verifikasi', label: 'Verifikasi', icon: 'check', short: 'Verifikasi' },
        { href: '/bk/catatan', label: 'Catatan', icon: 'file', short: 'Catatan' },
        { href: '/bk/laporan', label: 'Laporan', icon: 'chart', short: 'Laporan' },
    ],
    superadmin: [
        { href: '/admin/dashboard', label: 'Dashboard', icon: 'home', short: 'Dashboard' },
        { href: '/admin/pengguna', label: 'Pengguna', icon: 'users', short: 'Akun' },
        { href: '/admin/kelas', label: 'Kelas', icon: 'calendar', short: 'Kelas' },
        { href: '/admin/tahun-ajaran', label: 'Tahun Ajaran', icon: 'clock', short: 'Tahun' },
        { href: '/admin/konten', label: 'Konten', icon: 'file', short: 'Konten' },
        { href: '/admin/laporan', label: 'Laporan', icon: 'chart', short: 'Laporan' },
        { href: '/admin/pengumuman', label: 'Pengumuman', icon: 'bell', short: 'Umum' },
        { href: '/admin/audit', label: 'Audit', icon: 'shield', short: 'Audit' },
        { href: '/admin/retensi', label: 'Retensi', icon: 'target', short: 'Retensi' },
        { href: '/admin/pengaturan', label: 'Pengaturan', icon: 'settings', short: 'Setelan' },
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

function NotificationPanel({ announcements, notifications, onOpenAnnouncement, scrollClass = '' }) {
    const empty = announcements.length === 0 && notifications.length === 0;

    return (
        <div className={`space-y-2.5 overflow-y-auto ${scrollClass}`}>
            {empty ? (
                <p className="py-6 text-center text-[12px] text-[#475569]">Belum ada notifikasi.</p>
            ) : null}

            {announcements.length ? (
                <div className="space-y-1.5">
                    <p className="px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#94a3b8]">Pengumuman</p>
                    {announcements.map((item) => (
                        <button
                            key={`announcement-${item.id}`}
                            type="button"
                            onClick={() => onOpenAnnouncement(item)}
                            className={`flex w-full gap-2.5 rounded-2xl p-2.5 text-left transition active:scale-[0.99] ${
                                item.read_at ? 'bg-white hover:bg-[#f8fafc]' : 'bg-[#eef2ff] hover:bg-[#e8eaf6]'
                            }`}
                        >
                            <span
                                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                                    item.read_at ? 'bg-[#f1f5f9] text-[#64748b]' : 'bg-[#5c73db] text-white'
                                }`}
                            >
                                <Icon name="bell" size={15} />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className={`block text-[12px] leading-snug ${item.read_at ? 'font-semibold' : 'font-bold'}`}>
                                    {item.title}
                                </span>
                                <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-[#475569]">{item.body}</span>
                                <span className="mt-1 block text-[10px] text-[#94a3b8]">{formatDate(item.published_at)}</span>
                            </span>
                        </button>
                    ))}
                </div>
            ) : null}

            {notifications.length ? (
                <div className="space-y-1.5">
                    <p className="px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#94a3b8]">Notifikasi</p>
                    {notifications.map((item) => (
                        <div key={item.id} className={`flex gap-2.5 rounded-2xl p-2.5 ${item.read_at ? 'bg-white' : 'bg-[#f1f5f9]'}`}>
                            <span
                                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                                    item.read_at ? 'bg-[#f1f5f9] text-[#64748b]' : 'bg-[#e8eaf6] text-[#3f51b5]'
                                }`}
                            >
                                <Icon name="bell" size={15} />
                            </span>
                            <div className="min-w-0">
                                <p className="text-[12px] font-semibold leading-snug">{item.title}</p>
                                <p className="text-[11px] leading-snug text-[#475569]">{item.body}</p>
                            </div>
                        </div>
                    ))}
                </div>
            ) : null}
        </div>
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
    // Siswa dan Guru BK selalu memakai tata letak ponsel, termasuk di desktop.
    const mobileOnly = user?.role === 'student' || user?.role === 'counselor';
    // Menu avatar hanya berisi halaman yang belum ada di bottom navigation.
    const bottomNavHrefs = new Set(mobileItems.map((item) => item.href));
    const profileItems = mobileOnly ? items.filter((item) => !bottomNavHrefs.has(item.href)) : items;

    const [unreadNotifications, setUnreadNotifications] = useState(0);
    const [unreadAnnouncements, setUnreadAnnouncements] = useState(0);
    const unread = unreadNotifications + unreadAnnouncements;
    const [notifOpen, setNotifOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [announcements, setAnnouncements] = useState([]);
    const [activeAnnouncement, setActiveAnnouncement] = useState(null);
    const menuRef = useRef(null);
    const mobileMenuRef = useRef(null);

    useEffect(() => {
        document.body.classList.toggle('sd-phone-mode', mobileOnly);

        return () => document.body.classList.remove('sd-phone-mode');
    }, [mobileOnly]);

    useEffect(() => {
        let active = true;

        Promise.allSettled([
            api.get('/api/notifications?unread=true&per_page=1'),
            api.get('/api/announcements'),
        ]).then(([notifResult, announcementResult]) => {
            if (!active) return;

            if (notifResult.status === 'fulfilled') {
                setUnreadNotifications(notifResult.value.meta?.unread ?? 0);
            }

            if (announcementResult.status === 'fulfilled') {
                setUnreadAnnouncements(announcementResult.value.meta?.unread ?? 0);
            }
        });

        return () => {
            active = false;
        };
    }, [pathname]);

    useEffect(() => {
        setNotifOpen(false);
        setProfileOpen(false);
    }, [pathname]);

    useEffect(() => {
        const handler = (event) => {
            if (event.key === 'Escape') {
                setNotifOpen(false);
                setProfileOpen(false);
            }
        };

        const clickAway = (event) => {
            const insideDesktop = menuRef.current?.contains(event.target);
            const insideMobile = mobileMenuRef.current?.contains(event.target);

            if (!insideDesktop && !insideMobile) {
                setNotifOpen(false);
                setProfileOpen(false);
            }
        };

        document.addEventListener('keydown', handler);
        document.addEventListener('mousedown', clickAway);

        return () => {
            document.removeEventListener('keydown', handler);
            document.removeEventListener('mousedown', clickAway);
        };
    }, []);

    const openNotifications = async () => {
        setProfileOpen(false);
        const next = !notifOpen;
        setNotifOpen(next);

        if (!next) return;

        const [notifResult, announcementResult] = await Promise.allSettled([
            api.get('/api/notifications?per_page=10'),
            api.get('/api/announcements'),
        ]);

        setNotifications(notifResult.status === 'fulfilled' ? notifResult.value.data ?? [] : []);
        setAnnouncements(announcementResult.status === 'fulfilled' ? announcementResult.value.data ?? [] : []);
        setUnreadNotifications(notifResult.status === 'fulfilled' ? notifResult.value.meta?.unread ?? 0 : 0);
        setUnreadAnnouncements(announcementResult.status === 'fulfilled' ? announcementResult.value.meta?.unread ?? 0 : 0);
    };

    const openAnnouncement = (item) => {
        setNotifOpen(false);
        setActiveAnnouncement(item);

        if (item.read_at) return;

        const stamp = new Date().toISOString();
        setAnnouncements((current) => current.map((row) => (row.id === item.id ? { ...row, read_at: stamp } : row)));
        setUnreadAnnouncements((current) => Math.max(0, current - 1));

        api.post(`/api/announcements/${item.id}/read`).catch(() => {});
    };

    const readAll = async () => {
        const decision = await confirm({
            title: 'Tandai semua dibaca?',
            description: 'Semua notifikasi dan pengumuman akan ditandai sudah dibaca, lalu lencana pada lonceng hilang.',
            confirmLabel: 'Tandai dibaca',
            tone: 'info',
            icon: 'bell',
        });

        if (!decision) return;

        try {
            await Promise.all([
                api.post('/api/notifications/read-all'),
                api.post('/api/announcements/read-all'),
            ]);

            const stamp = new Date().toISOString();
            setUnreadNotifications(0);
            setUnreadAnnouncements(0);
            setNotifications((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? stamp })));
            setAnnouncements((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? stamp })));
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
        <div
            className={`mx-auto flex w-full items-stretch transition-all ${
                mobileOnly
                    ? 'sd-phone h-dvh max-w-[480px] gap-0 overflow-hidden px-4 pt-0'
                    : 'min-h-dvh max-w-[1440px] gap-6 px-4 pb-[calc(112px+env(safe-area-inset-bottom))] pt-0 lg:p-5 lg:pb-5'
            }`}
        >
            {!mobileOnly ? (
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
            ) : null}

            <div className={`flex min-w-0 flex-1 flex-col ${mobileOnly ? 'min-h-0' : 'py-1 lg:pr-2'}`}>
                <div className={`sd-mobile-bar flex items-center gap-3 px-4 pb-3 ${mobileOnly ? '' : 'lg:hidden'}`}>
                    <div className="min-w-0 flex-1 leading-none">
                        <span className="block truncate text-[16px] font-extrabold tracking-tight">SADAR DIRI</span>
                        <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">
                            {roleLabels[user?.role] ?? ''}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={openNotifications}
                        aria-label={`Notifikasi${unread ? `, ${unread} belum dibaca` : ''}`}
                        className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[#1e293b] shadow-sm active:scale-95"
                    >
                        <Icon name="bell" size={19} />
                        {unread > 0 ? (
                            <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#dc2626] px-1 text-[9px] font-bold text-white ring-2 ring-[#eceff4]">
                                {unread > 9 ? '9+' : unread}
                            </span>
                        ) : null}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setNotifOpen(false);
                            setProfileOpen((current) => !current);
                        }}
                        aria-label="Menu akun"
                        aria-haspopup="menu"
                        className="shrink-0 rounded-full ring-2 ring-white active:scale-95"
                    >
                        <Avatar name={user?.name} url={user?.avatar_url} size={38} />
                    </button>
                </div>

                <div ref={mobileMenuRef} className={mobileOnly ? '' : 'lg:hidden'}>
                    {notifOpen ? (
                        <div className="sd-popover sd-overlay-panel fixed left-1/2 top-[76px] z-50 w-[calc(100%-24px)] max-w-[448px] -translate-x-1/2 rounded-[22px] border border-[#e2e8f0] bg-white p-3 shadow-[0_24px_44px_-16px_rgba(15,23,42,0.28)]">
                            <div className="mb-2 flex items-center justify-between gap-2 px-1">
                                <p className="text-[13px] font-bold">Notifikasi &amp; Pengumuman</p>
                                <button type="button" onClick={readAll} className="rounded-full bg-[#e8eaf6] px-2.5 py-1 text-[10.5px] font-semibold text-[#3f51b5]">
                                    Tandai dibaca
                                </button>
                            </div>
                            <NotificationPanel
                                announcements={announcements}
                                notifications={notifications}
                                onOpenAnnouncement={openAnnouncement}
                                scrollClass="max-h-[52vh]"
                            />
                        </div>
                    ) : null}

                    {profileOpen ? (
                        <div role="menu" className="sd-popover sd-overlay-panel fixed left-1/2 top-[76px] z-50 w-[calc(100%-24px)] max-w-[448px] -translate-x-1/2 overflow-hidden rounded-[22px] border border-[#e2e8f0] bg-white p-2 shadow-[0_24px_44px_-16px_rgba(15,23,42,0.28)]">
                            <div className="flex items-center gap-3 rounded-2xl bg-[#f8fafc] p-3">
                                <Avatar name={user?.name} url={user?.avatar_url} size={40} />
                                <div className="min-w-0">
                                    <p className="truncate text-[13px] font-bold">{user?.name}</p>
                                    <p className="truncate text-[11px] text-[#475569]">{user?.email ?? user?.identity_number}</p>
                                </div>
                            </div>
                            <p className="mb-1 mt-2.5 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#94a3b8]">Menu</p>
                            <div className="max-h-[46vh] space-y-0.5 overflow-y-auto">
                                {profileItems.map((item) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        role="menuitem"
                                        className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[12.5px] transition ${
                                            isActive(pathname, item.href) ? 'bg-[#e8eaf6] font-semibold text-[#3f51b5]' : 'text-[#1e293b] hover:bg-[#f1f5f9]'
                                        }`}
                                    >
                                        <Icon name={item.icon} size={16} className="text-[#3f51b5]" />
                                        {item.label}
                                    </Link>
                                ))}
                            </div>
                            <div className="my-1.5 h-px bg-[#e2e8f0]" />
                            <button
                                type="button"
                                role="menuitem"
                                onClick={logout}
                                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[12.5px] font-semibold text-[#b91c1c]"
                            >
                                <Icon name="logout" size={16} />
                                Keluar
                            </button>
                        </div>
                    ) : null}
                </div>

                <header className={mobileOnly ? 'hidden' : 'mb-4 hidden items-center gap-2.5 lg:flex'}>
                    <div ref={menuRef} className={`ml-auto items-center gap-1.5 ${mobileOnly ? 'hidden' : 'hidden lg:flex'}`}>
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
                                        <p className="text-[13px] font-bold">Notifikasi &amp; Pengumuman</p>
                                        <button type="button" onClick={readAll} className="rounded-full bg-[#e8eaf6] px-2.5 py-1 text-[10.5px] font-semibold text-[#3f51b5] transition hover:bg-[#d7dcf5]">
                                            Tandai dibaca
                                        </button>
                                    </div>
                                    <NotificationPanel
                                        announcements={announcements}
                                        notifications={notifications}
                                        onOpenAnnouncement={openAnnouncement}
                                        scrollClass="max-h-[340px]"
                                    />
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

                <div
                    key={pathname}
                    className={`sd-page ${mobileOnly ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(96px+env(safe-area-inset-bottom))]' : ''}`}
                >
                    <div className="mb-4">
                        <div className="flex items-end justify-between gap-3">
                            <div className="min-w-0">
                                <h1 className={`truncate text-[24px] font-extrabold leading-tight tracking-tight ${mobileOnly ? '' : 'lg:text-[27px]'}`}>{title}</h1>
                                {subtitle ? <p className="mt-0.5 text-[12.5px] leading-snug text-[#64748b]">{subtitle}</p> : null}
                            </div>
                        </div>
                        {actions ? (
                            <div className={`sd-action-row mt-3 flex items-center gap-2 overflow-x-auto pb-0.5 ${mobileOnly ? '' : 'lg:flex-wrap lg:overflow-visible'}`}>
                                {actions}
                            </div>
                        ) : null}
                    </div>

                    <main className="flex-1">{children}</main>
                </div>
            </div>

            <nav
                className={`sd-mobile-nav fixed bottom-[calc(10px+env(safe-area-inset-bottom))] left-1/2 z-40 w-[calc(100%-24px)] max-w-[448px] -translate-x-1/2 ${mobileOnly ? '' : 'lg:hidden'}`}
                aria-label="Navigasi utama"
            >
                <div className="flex h-[68px] items-center justify-around overflow-visible rounded-[26px] border-t-[3px] border-[#5c73db] bg-[#374987] px-2 shadow-[0_12px_30px_-6px_rgba(24,34,53,0.35)]">
                    {mobileItems.map((item) => {
                        const active = isActive(pathname, item.href);

                        if (active) {
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    aria-current="page"
                                    aria-label={item.label}
                                    className="relative flex h-full flex-1 select-none flex-col items-center justify-start touch-manipulation"
                                >
                                    <span className="sd-nav-well relative z-20 -mt-[3px] flex h-[44px] w-[54px] items-center justify-center rounded-b-full bg-[#eceff4]">
                                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#5c73db] text-white shadow-md">
                                            <Icon name={item.icon} size={18} strokeWidth={2.3} />
                                        </span>
                                    </span>
                                    <span className="mt-1 max-w-full truncate px-1 text-[10px] font-bold leading-none text-white">
                                        {item.short}
                                    </span>
                                </Link>
                            );
                        }

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                aria-label={item.label}
                                className="flex h-full flex-1 select-none flex-col items-center justify-center text-white/75 transition-colors active:text-white touch-manipulation"
                            >
                                <Icon name={item.icon} size={19} />
                                <span className="mt-1 max-w-full truncate px-1 text-[10px] font-medium leading-none">
                                    {item.short}
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </nav>

            <Sheet
                open={Boolean(activeAnnouncement)}
                onClose={() => setActiveAnnouncement(null)}
                title={activeAnnouncement?.title ?? 'Pengumuman'}
                footer={
                    <Button variant="outline" className="min-h-11 flex-1" onClick={() => setActiveAnnouncement(null)}>
                        Tutup
                    </Button>
                }
            >
                {activeAnnouncement ? (
                    <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-[#e8eaf6] px-2.5 py-1 text-[10.5px] font-semibold text-[#3f51b5]">
                                Pengumuman
                            </span>
                            <span className="text-[11px] text-[#64748b]">
                                {formatDate(activeAnnouncement.published_at, true)}
                            </span>
                        </div>
                        <p className="whitespace-pre-line text-[13px] leading-relaxed text-[#1e293b]">
                            {activeAnnouncement.body}
                        </p>
                    </div>
                ) : null}
            </Sheet>
        </div>
    );
}
