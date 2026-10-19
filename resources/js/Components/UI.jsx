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
            <div className="pointer-events-none fixed bottom-24 left-1/2 z-[60] flex w-[calc(100%-32px)] max-w-sm -translate-x-1/2 flex-col gap-2 lg:bottom-6 lg:left-auto lg:right-6 lg:translate-x-0">
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
                    className="sd-backdrop fixed inset-0 z-[70] flex items-end justify-center bg-[rgba(15,23,42,0.5)] p-0 backdrop-blur-[4px] sm:items-center sm:p-4"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) settle(null);
                    }}
                >
                    <div
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby="sd-confirm-title"
                        aria-describedby={request.description ? 'sd-confirm-description' : undefined}
                        className="sd-dialog w-full rounded-t-[26px] bg-white p-6 shadow-[0_24px_48px_-12px_rgba(15,23,42,0.28)] sm:max-w-md sm:rounded-[26px]"
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

export function Skeleton({ rows = 4 }) {
    return (
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
