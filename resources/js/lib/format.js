export const labels = {
    role: { student: 'Siswa', counselor: 'Guru BK', superadmin: 'Superadmin' },
    status: {
        pending: 'Menunggu aktivasi',
        active: 'Aktif',
        inactive: 'Nonaktif',
        archived: 'Diarsipkan',
        alumni: 'Alumni',
    },
    mood: { positive: 'Positif', negative: 'Negatif' },
    journal: { abc: 'Curhat ABC', grateful: 'Grateful journal' },
    journalStatus: { draft: 'Draf', published: 'Terbit' },
    reflection: { self: 'Mandiri', guided: 'Terbimbing' },
    reflectionStatus: { draft: 'Draf', submitted: 'Terkirim', late: 'Terlambat' },
    verification: { pending: 'Menunggu', verified: 'Terverifikasi', rejected: 'Ditolak' },
    category: {
        academic: 'Akademik',
        non_academic: 'Non-akademik',
        competition: 'Lomba',
        soft_skill: 'Soft skill',
    },
    level: {
        school: 'Sekolah',
        district: 'Kecamatan',
        city: 'Kota',
        province: 'Provinsi',
        national: 'Nasional',
        international: 'Internasional',
    },
    severity: { low: 'Rendah', medium: 'Sedang', high: 'Tinggi' },
    alertStatus: { new: 'Baru', in_progress: 'Ditangani', resolved: 'Selesai' },
    targetStatus: {
        not_started: 'Belum mulai',
        in_progress: 'Berjalan',
        achieved: 'Tercapai',
        not_achieved: 'Belum tercapai',
    },
    targetBasis: {
        general: 'Umum',
        reflection: 'Dari refleksi',
        future_plan: 'Dari rencana masa depan',
    },
    audience: { all: 'Semua', role: 'Peran', class: 'Kelas' },
    content: {
        abc_prompt: 'Prompt ABC',
        reflection_question: 'Pertanyaan refleksi',
        emotion_category: 'Kategori emosi',
        tip_article: 'Artikel tips',
    },
};

export function label(group, value) {
    return labels[group]?.[value] ?? value ?? '—';
}

export function formatDate(value, withTime = false) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    const options = withTime
        ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
        : { day: '2-digit', month: 'short', year: 'numeric' };

    return new Intl.DateTimeFormat('id-ID', options).format(date);
}

export function formatDateNumeric(value) {
    if (!value) return '—';

    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
    if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    const pad = (number) => String(number).padStart(2, '0');

    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export function relative(value) {
    if (!value) return 'Belum pernah';
    const date = new Date(value);
    const diff = Math.floor((Date.now() - date.getTime()) / 86400000);

    if (diff <= 0) return 'Hari ini';
    if (diff === 1) return 'Kemarin';
    if (diff < 7) return `${diff} hari lalu`;
    if (diff < 30) return `${Math.floor(diff / 7)} pekan lalu`;
    return formatDate(value);
}

export function weekStart(date = new Date()) {
    const d = new Date(date);
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    return d.toISOString().slice(0, 10);
}

export function initials(name = '') {
    return name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('');
}

export function percent(value, total) {
    if (!total) return 0;
    return Math.round((value / total) * 100);
}
