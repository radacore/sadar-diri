import { Link } from '@inertiajs/react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Icons';

const ToastContext = createContext({ push: () => {} });

let scrollLocks = 0;

function lockScroll() {
    scrollLocks += 1;
    document.body.style.overflow = 'hidden';

    return () => {
        scrollLocks = Math.max(0, scrollLocks - 1);
        if (scrollLocks === 0) document.body.style.overflow = '';
    };
}

export function ToastProvider({ children }) {
    const [items, setItems] = useState([]);

    const push = useCallback((message, tone = 'success') => {
        const id = Math.random().toString(36).slice(2);
        setItems((current) => [...current, { id, message, tone }]);
        setTimeout(() => {
            setItems((current) => current.filter((item) => item.id !== id));
        }, 4200);
    }, []);

    const value = useMemo(() => ({ push }), [push]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div className="sd-toast-wrap pointer-events-none fixed bottom-24 left-1/2 z-[60] flex w-[calc(100%-32px)] max-w-[400px] -translate-x-1/2 flex-col gap-2">
                {items.map((item) => (
                    <div
                        key={item.id}
                        role="status"
                        className={`sd-toast pointer-events-auto rounded-[18px] px-4 py-3 text-xs font-medium shadow-[0_12px_24px_-6px_rgba(15,23,42,0.1)] ${
                            item.tone === 'error'
                                ? 'bg-[#7f1d1d] text-white'
                                : 'bg-[#182235] text-white'
                        }`}
                    >
                        {item.message}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    return useContext(ToastContext);
}


/* ============================================
   KONFIRMASI AKSI
   Setiap aksi yang mengubah data melewati dialog ini.
   ============================================ */

const ConfirmContext = createContext(() => Promise.resolve(null));

const confirmTones = {
    primary: { bubble: 'bg-[#e8eaf6] text-[#3f51b5]', button: 'primary', icon: 'alert' },
    success: { bubble: 'bg-[#d1fae5] text-[#047857]', button: 'success', icon: 'check' },
    danger: { bubble: 'bg-[#fee2e2] text-[#b91c1c]', button: 'danger', icon: 'alert' },
    warning: { bubble: 'bg-[#fef3c7] text-[#b45309]', button: 'warning', icon: 'alert' },
    info: { bubble: 'bg-[#e0f2fe] text-[#0369a1]', button: 'info', icon: 'bell' },
};

export function ConfirmProvider({ children }) {
    const [request, setRequest] = useState(null);
    const [reason, setReason] = useState('');
    const resolver = useRef(null);
    const reasonRef = useRef(null);
    const confirmRef = useRef(null);

    const confirm = useCallback((options = {}) => {
        resolver.current?.(null);

        return new Promise((resolve) => {
            resolver.current = resolve;
            setReason('');
            setRequest({
                tone: 'primary',
                confirmLabel: 'Lanjutkan',
                cancelLabel: 'Batal',
                requireReason: false,
                reasonLabel: 'Alasan',
                reasonPlaceholder: 'Tuliskan alasan singkat…',
                minReasonLength: 4,
                ...options,
            });
        });
    }, []);

    const settle = useCallback((value) => {
        resolver.current?.(value);
        resolver.current = null;
        setRequest(null);
    }, []);

    useEffect(() => {
        if (!request) return undefined;

        const handler = (event) => {
            if (event.key === 'Escape') settle(null);
        };

        document.addEventListener('keydown', handler);
        const unlock = lockScroll();

        const timer = setTimeout(() => {
            if (request.requireReason) {
                reasonRef.current?.focus();
            } else {
                confirmRef.current?.focus();
            }
        }, 40);

        return () => {
            document.removeEventListener('keydown', handler);
            unlock();
            clearTimeout(timer);
        };
    }, [request, settle]);

    const tone = confirmTones[request?.tone] ?? confirmTones.primary;
    const reasonReady = !request?.requireReason || reason.trim().length >= request.minReasonLength;

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            {request ? (
                <div
                    className="sd-backdrop fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(15,23,42,0.5)] p-4 backdrop-blur-[4px]"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) settle(null);
                    }}
                >
                    <div
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby="sd-confirm-title"
                        aria-describedby={request.description ? 'sd-confirm-description' : undefined}
                        className="sd-confirm sd-dialog w-full max-w-md rounded-[26px] bg-white p-6 shadow-[0_24px_48px_-12px_rgba(15,23,42,0.28)]"
                    >
                        <div className="flex items-start gap-4">
                            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tone.bubble}`} aria-hidden="true">
                                <Icon name={request.icon ?? tone.icon} size={22} strokeWidth={2.2} />
                            </span>
                            <div className="min-w-0 pt-0.5">
                                <h3 id="sd-confirm-title" className="text-[16px] font-bold leading-tight">{request.title ?? 'Konfirmasi aksi'}</h3>
                                {request.description ? (
                                    <p id="sd-confirm-description" className="mt-1 text-[13px] leading-relaxed text-[#475569]">{request.description}</p>
                                ) : null}
                            </div>
                        </div>

                        {request.details?.length ? (
                            <dl className="mt-4 space-y-1.5 rounded-2xl bg-[#f8fafc] p-3.5 text-[12px]">
                                {request.details.map((item) => (
                                    <div key={item.label} className="flex items-start justify-between gap-3">
                                        <dt className="text-[#475569]">{item.label}</dt>
                                        <dd className="text-right font-semibold">{item.value}</dd>
                                    </div>
                                ))}
                            </dl>
                        ) : null}

                        {request.requireReason ? (
                            <div className="mt-4">
                                <label htmlFor="sd-confirm-reason" className="sd-label">
                                    {typeof request.requireReason === 'string' ? request.requireReason : request.reasonLabel} <span className="text-[11px] font-normal text-[#b42318]">(wajib)</span>
                                </label>
                                <textarea
                                    id="sd-confirm-reason"
                                    ref={reasonRef}
                                    className="sd-input sd-textarea min-h-[76px]"
                                    value={reason}
                                    maxLength={500}
                                    placeholder={request.reasonPlaceholder}
                                    onChange={(event) => setReason(event.target.value)}
                                />
                                <p className="sd-hint">{request.reasonHint ?? 'Tercatat di audit log bersama aksi ini.'}</p>
                            </div>
                        ) : null}

                        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <Button variant="outline" onClick={() => settle(null)}>{request.cancelLabel}</Button>
                            <Button
                                ref={confirmRef}
                                variant={tone.button}
                                disabled={!reasonReady}
                                onClick={() => settle({ reason: reason.trim() })}
                            >
                                {request.confirmLabel}
                            </Button>
                        </div>
                    </div>
                </div>
            ) : null}
        </ConfirmContext.Provider>
    );
}

export function useConfirm() {
    return useContext(ConfirmContext);
}

export function Card({ children, className = '', as: Tag = 'section' }) {
    return <Tag className={`sd-card ${className}`}>{children}</Tag>;
}

export function CardTitle({ children, action }) {
    return (
        <div className="mb-3 flex items-start justify-between gap-3">
            <h2 className="text-[16px] font-bold leading-tight">{children}</h2>
            {action}
        </div>
    );
}

export function Button({ children, variant = 'primary', size = 'md', className = '', type = 'button', ...props }) {
    const map = {
        primary: 'sd-btn sd-btn-primary',
        success: 'sd-btn sd-btn-success',
        danger: 'sd-btn sd-btn-danger',
        warning: 'sd-btn sd-btn-warning',
        info: 'sd-btn sd-btn-info',
        outline: 'sd-btn sd-btn-outline',
        soft: 'sd-btn sd-btn-soft',
        ghost: 'sd-btn sd-btn-ghost',
        ghostDanger: 'sd-btn sd-btn-ghost-danger',
    };

    return (
        <button type={type} className={`${map[variant] ?? map.primary}${size === 'sm' ? ' sd-btn-sm' : ''} ${className}`} {...props}>
            {children}
        </button>
    );
}

export function IconButton({ icon, label, variant = 'outline', size = 34, className = '', ...props }) {
    const tones = {
        primary: 'bg-[#e8eaf6] text-[#3f51b5] hover:bg-[#d7dcf5]',
        success: 'bg-[#d1fae5] text-[#047857] hover:bg-[#a7f3d0]',
        danger: 'bg-[#fee2e2] text-[#b91c1c] hover:bg-[#fecaca]',
        warning: 'bg-[#fef3c7] text-[#b45309] hover:bg-[#fde68a]',
        info: 'bg-[#e0f2fe] text-[#0369a1] hover:bg-[#bae6fd]',
        outline: 'border border-[#e2e8f0] bg-white text-[#475569] hover:border-[#3f51b5] hover:text-[#3f51b5]',
    };

    return (
        <button
            type="button"
            title={label}
            aria-label={label}
            className={`inline-flex shrink-0 items-center justify-center rounded-full transition active:scale-95 ${tones[variant] ?? tones.outline} ${className}`}
            style={{ width: size, height: size }}
            {...props}
        >
            <Icon name={icon} size={16} />
        </button>
    );
}

export function Field({ label, hint, error, required, children, htmlFor }) {
    return (
        <div>
            <label className="sd-label" htmlFor={htmlFor}>
                {label} {required ? <span className="text-[11px] font-normal text-[#b42318]">(wajib)</span> : null}
            </label>
            {children}
            {error ? <p className="sd-error">{error}</p> : hint ? <p className="sd-hint">{hint}</p> : null}
        </div>
    );
}

export function Input({ className = '', ...props }) {
    return <input className={`sd-input ${className}`} {...props} />;
}

export function PasswordInput({ className = '', disabled = false, ...props }) {
    const [visible, setVisible] = useState(false);

    return (
        <div className="relative">
            <input
                {...props}
                type={visible ? 'text' : 'password'}
                disabled={disabled}
                className={`sd-input pr-12 ${className}`}
                autoComplete={props.autoComplete ?? 'new-password'}
            />
            <button
                type="button"
                onClick={() => setVisible((current) => !current)}
                aria-label={visible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                aria-pressed={visible}
                title={visible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[#64748b] transition hover:bg-[#e8eaf6] hover:text-[#3f51b5] active:scale-95"
            >
                <Icon name={visible ? 'eye-off' : 'eye'} size={18} />
            </button>
        </div>
    );
}

export function ReadOnlyValue({ children, mono = false, className = '' }) {
    return (
        <div className={`flex h-[42px] items-center gap-2 rounded-xl border border-[#e2e8f0] bg-[#f1f5f9] px-3.5 text-[13px] text-[#475569] ${className}`}>
            <Icon name="lock" size={15} className="shrink-0 text-[#94a3b8]" />
            <span className={`min-w-0 flex-1 truncate ${mono ? 'font-mono' : ''}`}>{children}</span>
        </div>
    );
}

export function Textarea({ className = '', ...props }) {
    return <textarea className={`sd-input sd-textarea ${className}`} {...props} />;
}

export function Select({ children, className = '', ...props }) {
    return (
        <select className={`sd-input ${className}`} {...props}>
            {children}
        </select>
    );
}

export function Badge({ tone = 'info', children }) {
    const tones = {
        success: 'bg-[#d1fae5] text-[#065f46]',
        warning: 'bg-[#fef3c7] text-[#92400e]',
        danger: 'bg-[#fee2e2] text-[#991b1b]',
        info: 'bg-[#e8eaf6] text-[#3f51b5]',
        neutral: 'bg-[#f1f5f9] text-[#475569]',
    };

    return <span className={`sd-badge ${tones[tone] ?? tones.info}`}>{children}</span>;
}

export function Modal({ open, onClose, title, children, footer, wide = false }) {
    useEffect(() => {
        if (!open) return undefined;
        const handler = (event) => {
            if (event.key === 'Escape') onClose?.();
        };
        document.addEventListener('keydown', handler);
        const unlock = lockScroll();
        return () => {
            document.removeEventListener('keydown', handler);
            unlock();
        };
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            className="sd-backdrop fixed inset-0 z-50 flex items-end justify-center bg-[rgba(15,23,42,0.45)] p-0 backdrop-blur-[4px] sm:items-center sm:p-4"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose?.();
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className={`sd-dialog max-h-[92vh] w-full overflow-y-auto rounded-t-[24px] bg-white p-6 shadow-[0_20px_32px_-8px_rgba(15,23,42,0.14)] sm:rounded-[24px] ${
                    wide ? 'sm:max-w-3xl' : 'sm:max-w-md'
                }`}
            >
                <div className="mb-4 flex items-start justify-between gap-3">
                    <h3 className="text-base font-bold">{title}</h3>
                    <button type="button" onClick={onClose} className="sd-btn sd-btn-ghost h-8 w-8 px-0" aria-label="Tutup">
                        <Icon name="close" size={16} />
                    </button>
                </div>
                {children}
                {footer ? <div className="mt-5 flex justify-end gap-2">{footer}</div> : null}
            </div>
        </div>
    );
}

export function EmptyState({ title, description, action }) {
    return (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <div className="mb-1 flex h-16 w-16 items-center justify-center rounded-full bg-[#f1f5f9] text-2xl" aria-hidden="true">
                ◌
            </div>
            <p className="text-sm font-semibold">{title}</p>
            {description ? <p className="max-w-sm text-[13px] text-[#475569]">{description}</p> : null}
            {action}
        </div>
    );
}

export function Pagination({
    page = 1,
    lastPage = 1,
    total = 0,
    from = null,
    to = null,
    perPage = 20,
    perPageOptions = [20, 50, 100],
    onPageChange,
    onPerPageChange,
    unit = 'data',
}) {
    const pageItems = useMemo(() => {
        const pages = [];
        const push = (value) => pages.push(value);
        const start = Math.max(1, Math.min(page - 1, lastPage - 4));
        const end = Math.min(lastPage, start + 4);

        if (start > 1) {
            push(1);
            if (start > 2) push('…');
        }

        for (let index = start; index <= end; index++) push(index);

        if (end < lastPage) {
            if (end < lastPage - 1) push('…');
            push(lastPage);
        }

        return pages;
    }, [page, lastPage]);

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e2e8f0] px-4 py-3 sm:px-0">
            <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-[#475569]">
                <span>
                    {total === 0 ? `Tidak ada ${unit}` : `Menampilkan ${from ?? 0}–${to ?? 0} dari ${total} ${unit}`}
                </span>
                {onPerPageChange ? (
                    <label className="flex items-center gap-1.5">
                        <span className="sr-only">Baris per halaman</span>
                        <select
                            className="sd-input h-8 w-auto px-2 text-[11.5px]"
                            value={perPage}
                            onChange={(event) => onPerPageChange(Number(event.target.value))}
                        >
                            {perPageOptions.map((option) => <option key={option} value={option}>{option} / halaman</option>)}
                        </select>
                    </label>
                ) : null}
            </div>
            {lastPage > 1 ? (
                <nav className="flex items-center gap-1" aria-label="Navigasi halaman">
                    <button
                        type="button"
                        className="sd-btn sd-btn-outline h-8 px-2 text-[11.5px]"
                        onClick={() => onPageChange?.(page - 1)}
                        disabled={page <= 1}
                        aria-label="Halaman sebelumnya"
                    >
                        <Icon name="chevron" size={14} className="rotate-90" />
                        <span className="hidden sm:inline">Sebelumnya</span>
                    </button>
                    {pageItems.map((item, index) => item === '…' ? (
                        <span key={`gap-${index}`} className="px-1 text-[11.5px] text-[#94a3b8]">…</span>
                    ) : (
                        <button
                            key={item}
                            type="button"
                            onClick={() => onPageChange?.(item)}
                            aria-current={item === page ? 'page' : undefined}
                            className={`h-8 min-w-[32px] rounded-full px-2 text-[11.5px] font-semibold transition ${
                                item === page ? 'bg-[#3f51b5] text-white' : 'text-[#475569] hover:bg-[#e8eaf6]'
                            }`}
                        >
                            {item}
                        </button>
                    ))}
                    <button
                        type="button"
                        className="sd-btn sd-btn-outline h-8 px-2 text-[11.5px]"
                        onClick={() => onPageChange?.(page + 1)}
                        disabled={page >= lastPage}
                        aria-label="Halaman berikutnya"
                    >
                        <span className="hidden sm:inline">Berikutnya</span>
                        <Icon name="chevron" size={14} className="-rotate-90" />
                    </button>
                </nav>
            ) : null}
        </div>
    );
}

export function Skeleton({ rows = 4 }) {    return (
        <div className="space-y-2" aria-hidden="true">
            {Array.from({ length: rows }).map((_, index) => (
                <div key={index} className="h-10 animate-pulse rounded-lg bg-[#f1f5f9]" />
            ))}
        </div>
    );
}

export function Stat({ label, value, hint, tone = 'default' }) {
    const toneClass = tone === 'danger' ? 'text-[#b42318]' : tone === 'warning' ? 'text-[#b45309]' : 'text-[#1e293b]';

    return (
        <div>
            <p className="text-[13px] text-[#475569]">{label}</p>
            <p className={`tabular text-[36px] font-extrabold leading-none tracking-tight ${toneClass}`}>{value}</p>
            {hint ? <p className="mt-1 text-[12px] text-[#475569]">{hint}</p> : null}
        </div>
    );
}

export function Progress({ value = 0, label }) {
    return (
        <div>
            <div className="mb-1 flex justify-between text-[11px] text-[#475569]">
                <span>{label}</span>
                <span className="tabular font-semibold">{value}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#e2e8f0]">
                <div className="h-full rounded-full bg-[#3f51b5] transition-all" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
            </div>
        </div>
    );
}

export function MoodPicker({ value, onChange }) {
    const options = [
        { value: 1, label: 'Sangat berat', icon: 'M4 16l4-8 4 8 4-8 4 8' },
        { value: 2, label: 'Berat', icon: 'M4 14c4-6 8 6 12 0' },
        { value: 3, label: 'Biasa', icon: 'M8 12h8' },
        { value: 4, label: 'Baik', icon: 'M4 12c4-6 8 6 12 0' },
        { value: 5, label: 'Sangat baik', icon: 'M4 12h16' },
    ];

    return (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Pilih mood">
            {options.map((option) => {
                const active = value === option.value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => onChange(option.value)}
                        className={`flex h-[52px] w-[48px] flex-col items-center justify-center gap-1 rounded-[14px] border text-[10px] transition sm:h-[56px] sm:w-[56px] sm:text-[11px] ${
                            active
                                ? 'border-2 border-[#3f51b5] bg-[#e8eaf6] font-semibold text-[#1e293b]'
                                : 'border-[#e2e8f0] bg-white text-[#475569] hover:border-[#cbd5e1]'
                        }`}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <path d={option.icon} />
                        </svg>
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}

export function ToneDot({ tone }) {
    const map = { success: '#10b981', warning: '#f59e0b', danger: '#ef4444', info: '#3b82f6' };
    return <span className="inline-block h-2 w-2 rounded-full" style={{ background: map[tone] ?? map.info }} aria-hidden="true" />;
}

/* ============================================
   MOBILE-FIRST BUILDING BLOCKS
   ============================================ */

export function PageSection({ title, action, children, className = '' }) {
    return (
        <section className={`space-y-3 ${className}`}>
            {(title || action) ? (
                <div className="flex items-center justify-between gap-3">
                    <h2 className="text-[13px] font-bold uppercase tracking-[0.1em] text-[#64748b]">{title}</h2>
                    {action}
                </div>
            ) : null}
            {children}
        </section>
    );
}

export function HeroCard({ eyebrow, title, description, meta, aside, tone = 'primary', children, className = '' }) {
    return (
        <section className={`sd-hero sd-hero--${tone} ${className}`}>
            {(eyebrow || aside) ? (
                <div className="sd-hero-head">
                    {eyebrow ? <p className="sd-hero-eyebrow">{eyebrow}</p> : <span />}
                    {aside}
                </div>
            ) : null}
            <h2 className="sd-hero-title">{title}</h2>
            {description ? <p className="sd-hero-desc">{description}</p> : null}
            {meta ? <div className="sd-hero-meta">{meta}</div> : null}
            {children}
        </section>
    );
}

export function StatTile({ label, value, hint, tone = 'default', icon }) {
    const tones = {
        default: 'text-[#1e293b]',
        primary: 'text-[#3f51b5]',
        success: 'text-[#047857]',
        warning: 'text-[#b45309]',
        danger: 'text-[#b91c1c]',
    };

    return (
        <div className="sd-tile">
            <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">{label}</p>
                {icon ? <Icon name={icon} size={16} className="shrink-0 text-[#94a3b8]" /> : null}
            </div>
            <p className={`tabular mt-1.5 text-[28px] font-extrabold leading-none tracking-tight ${tones[tone] ?? tones.default}`}>{value}</p>
            {hint ? <p className="mt-1 text-[11px] leading-snug text-[#64748b]">{hint}</p> : null}
        </div>
    );
}

export function ListRow({ leading, title, subtitle, meta, trailing, onClick, href, active = false }) {
    const content = (
        <>
            {leading ? <span className="shrink-0">{leading}</span> : null}
            <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold leading-snug text-[#1e293b]">{title}</span>
                {subtitle ? <span className="mt-0.5 block truncate text-[11.5px] text-[#64748b]">{subtitle}</span> : null}
                {meta ? <span className="mt-1.5 flex flex-wrap items-center gap-1.5">{meta}</span> : null}
            </span>
            {trailing ? <span className="shrink-0">{trailing}</span> : null}
        </>
    );

    const className = `sd-list-row ${active ? 'sd-list-row-active' : ''}`;

    if (href) {
        return <Link href={href} className={className}>{content}</Link>;
    }

    if (onClick) {
        return <button type="button" onClick={onClick} className={className}>{content}</button>;
    }

    return <div className={className}>{content}</div>;
}

export function Chip({ active = false, onClick, children, tone = 'neutral' }) {
    const tones = {
        neutral: active ? 'border-[#3f51b5] bg-[#3f51b5] text-white' : 'border-[#e2e8f0] bg-white text-[#475569]',
        danger: active ? 'border-[#b91c1c] bg-[#b91c1c] text-white' : 'border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]',
        success: active ? 'border-[#047857] bg-[#047857] text-white' : 'border-[#bbf7d0] bg-[#ecfdf5] text-[#047857]',
    };

    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-[11.5px] font-semibold transition active:scale-95 ${tones[tone] ?? tones.neutral}`}
        >
            {children}
        </button>
    );
}

export function Segmented({ options, value, onChange, className = '' }) {
    return (
        <div className={`flex gap-1 rounded-full bg-[#e8edf5] p-1 ${className}`} role="tablist">
            {options.map((option) => {
                const active = value === option.value;

                return (
                    <button
                        key={option.value}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => onChange(option.value)}
                        className={`flex-1 rounded-full px-3 py-2 text-[11.5px] font-semibold transition ${
                            active ? 'bg-white text-[#1e293b] shadow-sm' : 'text-[#64748b]'
                        }`}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}

export function Sheet({ open, onClose, title, children, footer }) {
    useEffect(() => {
        if (!open) return undefined;

        const handler = (event) => {
            if (event.key === 'Escape') onClose?.();
        };

        document.addEventListener('keydown', handler);
        const unlock = lockScroll();

        return () => {
            document.removeEventListener('keydown', handler);
            unlock();
        };
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            className="sd-backdrop fixed inset-0 z-50 flex items-end justify-center bg-[rgba(15,23,42,0.45)] backdrop-blur-[3px]"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose?.();
            }}
        >
            <div role="dialog" aria-modal="true" aria-label={title} className="sd-sheet sd-dialog max-h-[90vh] w-full max-w-[448px] overflow-y-auto rounded-t-[26px] bg-white px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-3 shadow-[0_-16px_40px_-12px_rgba(15,23,42,0.3)] sm:mb-4 sm:rounded-[26px]">
                <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#e2e8f0]" aria-hidden="true" />
                <div className="mb-4 flex items-start justify-between gap-3">
                    <h3 className="text-[16px] font-bold leading-tight">{title}</h3>
                    <button type="button" onClick={onClose} className="sd-btn sd-btn-ghost h-8 w-8 px-0" aria-label="Tutup">
                        <Icon name="close" size={16} />
                    </button>
                </div>
                {children}
                {footer ? <div className="mt-5 flex gap-2">{footer}</div> : null}
            </div>
        </div>
    );
}

export function ProgressRing({ value = 0, size = 72, stroke = 8, label, tone = '#3f51b5' }) {
    const clamped = Math.min(100, Math.max(0, value));
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;

    return (
        <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e8edf5" strokeWidth={stroke} />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={tone}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference - (circumference * clamped) / 100}
                    style={{ transition: 'stroke-dashoffset 400ms cubic-bezier(0.16, 1, 0.3, 1)' }}
                />
            </svg>
            <span className="absolute text-[13px] font-extrabold tabular">{label ?? `${clamped}%`}</span>
        </div>
    );
}
