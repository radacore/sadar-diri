const paths = {
    home: 'M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
    user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 9c0-4 3.6-6 8-6s8 2 8 6',
    book: 'M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z M8 9h8 M8 13h6',
    clock: 'M12 3a9 9 0 1 0 9 9 M12 7v5l3 2',
    target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
    shield: 'M12 3l8 3v6c0 5-3.4 8.2-8 9-4.6-.8-8-4-8-9V6z',
    bell: 'M12 22a3 3 0 0 0 3-3H9a3 3 0 0 0 3 3Zm7-6V11a7 7 0 1 0-14 0v5l-2 2h18Z',
    search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4.2-4.2',
    plus: 'M12 5v14M5 12h14',
    check: 'M4 12.5 9 17.5 20 6.5',
    alert: 'M12 3 2 21h20L12 3Zm0 6v6m0 3h.01',
    chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
    users: 'M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20c0-3.3 2.7-5 6-5s6 1.7 6 5m2-5c2.8 0 6 1.3 6 5',
    calendar: 'M4 6h16v15H4z M8 3v5M16 3v5M4 11h16',
    settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-3a8 8 0 0 0-.2-1.7l2-1.5-2-3.4-2.3 1a8 8 0 0 0-3-1.7L14 2h-4l-.5 2.7a8 8 0 0 0-3 1.7l-2.3-1-2 3.4 2 1.5A8 8 0 0 0 4 12c0 .6.1 1.2.2 1.7l-2 1.5 2 3.4 2.3-1a8 8 0 0 0 3 1.7L10 22h4l.5-2.7a8 8 0 0 0 3-1.7l2.3 1 2-3.4-2-1.5c.1-.5.2-1.1.2-1.7Z',
    file: 'M6 2h8l4 4v16H6z M14 2v5h5',
    logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9',
    menu: 'M4 7h16M4 12h16M4 17h16',
    close: 'M6 6l12 12M18 6 6 18',
    sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
    chevron: 'M6 9l6 6 6-6',
    trash: 'M4 7h16M9 7V5h6v2m-8 0 1 13h8l1-13',
    send: 'M4 12l16-8-6 16-2.5-6.5L4 12Z',
    key: 'M15 7a4 4 0 1 1-3.5 5.9L4 20v-3h2v-2h2l3.5-3.5A4 4 0 0 1 15 7Z',
    edit: 'M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z M14 6l4 4',
    eye: 'M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
    'eye-off': 'M3 3l18 18 M10.6 10.6a3 3 0 0 0 4.2 4.2 M9.4 5.3A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a18 18 0 0 1-2.5 3.4 M6.3 6.6C3.6 8.4 2 12 2 12s3.6 7 10 7a10.7 10.7 0 0 0 4.3-.9',
    lock: 'M6 11V8a6 6 0 0 1 12 0v3 M5 11h14v10H5z M12 15v2',
};

export function Icon({ name, size = 19, className = '', strokeWidth = 2 }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            aria-hidden="true"
        >
            <path d={paths[name] ?? paths.sparkle} />
        </svg>
    );
}

/**
 * Wajah mood buatan sendiri (bukan emoji font) agar tampil sama di semua
 * perangkat. Warna muka dan tinta mengikuti tingkat mood 1–5.
 */
const moodPalette = {
    1: { face: '#fecaca', ink: '#b91c1c' },
    2: { face: '#fed7aa', ink: '#c2410c' },
    3: { face: '#e2e8f0', ink: '#64748b' },
    4: { face: '#e0e7ff', ink: '#4338ca' },
    5: { face: '#bbf7d0', ink: '#047857' },
};

export function MoodFace({ level = 3, size = 30, className = '' }) {
    const { face, ink } = moodPalette[level] ?? moodPalette[3];
    const stroke = { stroke: ink, strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' };

    return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
            <circle cx="24" cy="24" r="20" fill={face} stroke={ink} strokeWidth="2" />

            {level === 1 ? (
                <>
                    <path d="M13.5 19.5 19.5 16.5M34.5 19.5 28.5 16.5" {...stroke} />
                    <circle cx="17.5" cy="23.5" r="1.9" fill={ink} />
                    <circle cx="30.5" cy="23.5" r="1.9" fill={ink} />
                    <path d="M16.5 34.5c2.2-4.6 5-6.6 7.5-6.6s5.3 2 7.5 6.6" {...stroke} />
                    <path d="M34.6 26.6c1.4 1.9 2.1 3.1 2.1 4a2.1 2.1 0 0 1-4.2 0c0-.9.7-2.1 2.1-4Z" fill="#3b82f6" />
                </>
            ) : null}

            {level === 2 ? (
                <>
                    <path d="M13.8 18.6 19.6 17M34.2 18.6 28.4 17" {...stroke} />
                    <circle cx="17.5" cy="23.8" r="1.9" fill={ink} />
                    <circle cx="30.5" cy="23.8" r="1.9" fill={ink} />
                    <path d="M17 33c2-3 4.4-4.4 7-4.4s5 1.4 7 4.4" {...stroke} />
                </>
            ) : null}

            {level === 3 ? (
                <>
                    <circle cx="17.5" cy="22.5" r="2" fill={ink} />
                    <circle cx="30.5" cy="22.5" r="2" fill={ink} />
                    <path d="M18 31h12" {...stroke} />
                </>
            ) : null}

            {level === 4 ? (
                <>
                    <circle cx="17.5" cy="22" r="2" fill={ink} />
                    <circle cx="30.5" cy="22" r="2" fill={ink} />
                    <path d="M15.8 28c2.5 5 5.4 7 8.2 7s5.7-2 8.2-7" {...stroke} />
                </>
            ) : null}

            {level === 5 ? (
                <>
                    <path d="M13.5 22.5c1.4-3 3.2-4.4 4.5-4.4s3.1 1.4 4.5 4.4" {...stroke} />
                    <path d="M25.5 22.5c1.4-3 3.2-4.4 4.5-4.4s3.1 1.4 4.5 4.4" {...stroke} />
                    <path d="M15.5 28c2.5 4.6 5.3 6.9 8.5 6.9s6-2.3 8.5-6.9Z" fill={ink} fillOpacity="0.85" />
                </>
            ) : null}
        </svg>
    );
}
