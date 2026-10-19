import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, CardTitle, EmptyState, Field, IconButton, Input, Modal, Select, Skeleton, useConfirm, useToast } from '../../Components/UI';
import AppShell from '../../Layouts/AppShell';
import { api, download } from '../../lib/api';
import { formatDate, label, relative } from '../../lib/format';

export default function Users() {
    const toast = useToast();
    const confirm = useConfirm();
    const [users, setUsers] = useState([]);
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ search: '', role: '', status: '' });
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [importResult, setImportResult] = useState(null);
    const [form, setForm] = useState({ name: '', email: '', identity_number: '', role: 'student', class_id: '', send_invitation: true });

    const load = useCallback(async () => {
        try {
            const query = new URLSearchParams();
            Object.entries(filters).forEach(([key, value]) => value && query.set(key, value));

            const [list, classList] = await Promise.all([
                api.get(`/api/admin/users?${query.toString()}`),
                api.get('/api/admin/classes/options'),
            ]);
            setUsers(list.data ?? []);
            setClasses(classList.data ?? []);
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [filters, toast]);

    useEffect(() => {
        const timer = setTimeout(load, 250);
        return () => clearTimeout(timer);
    }, [load]);

    const create = async (event) => {
        event.preventDefault();

        const decision = await confirm({
            title: 'Buat akun baru?',
            details: [
                { label: 'Nama', value: form.name },
                { label: 'Peran', value: label('role', form.role) },
                { label: 'NIS/NIP', value: form.identity_number },
            ],
            confirmLabel: 'Buat akun',
            tone: 'primary',
            icon: 'users',
        });
        if (!decision) return;

        setBusy(true);

        try {
            const response = await api.post('/api/admin/users', {
                ...form,
                class_id: form.role === 'student' ? Number(form.class_id) : null,
            });
            toast.push(response.message ?? 'Akun dibuat.');
            setOpen(false);
            setForm({ name: '', email: '', identity_number: '', role: 'student', class_id: '', send_invitation: true });
            await load();
        } catch (error) {
            toast.push(error.message, 'error');
        } finally {
            setBusy(false);
        }
    };

    const changeStatus = async (user) => {
        const status = user.status === 'active' ? 'inactive' : 'active';
        const decision = await confirm({
            title: `Ubah status ${user.name}?`,
            description: `Status akun akan diubah menjadi ${label('status', status)}.`,
            details: [{ label: 'Pengguna', value: user.name }],
            confirmLabel: status === 'active' ? 'Aktifkan' : 'Nonaktifkan',
            tone: status === 'active' ? 'success' : 'danger',
            icon: 'shield',
            requireReason: 'Alasan perubahan status',
        });
        if (!decision) return;

        try {
            await api.patch(`/api/admin/users/${user.id}/status`, { status, reason: decision.reason });
            toast.push('Status akun diperbarui.');
            await load();
        } catch (error) {
            toast.push(error.message, 'error');
        }
    };

    const resetPassword = async (user) => {
        const decision = await confirm({
            title: 'Kirim tautan reset kata sandi?',
            details: [{ label: 'Pengguna', value: user.name }],
            confirmLabel: 'Kirim tautan',
            tone: 'warning',
            icon: 'send',
            requireReason: 'Alasan reset kata sandi',
        });
        if (!decision) return;

        try {
            const response = await api.post(`/api/admin/users/${user.id}/reset-password`, { reason: decision.reason });
            toast.push(response.message);
        } catch (error) {
            toast.push(error.message, 'error');
        }
    };

    const forceLogout = async (user) => {
        const decision = await confirm({
            title: 'Putus sesi pengguna?',
            description: `Semua sesi aktif ${user.name} akan diakhiri.`,
            details: [{ label: 'Pengguna', value: user.name }],
            confirmLabel: 'Putus sesi',
            tone: 'danger',
            icon: 'logout',
            requireReason: 'Alasan memutus sesi',
        });
        if (!decision) return;

        try {
            await api.post(`/api/admin/users/${user.id}/force-logout`, { reason: decision.reason });
            toast.push('Sesi pengguna diputus.');
        } catch (error) {
            toast.push(error.message, 'error');
        }
    };

    const importCsv = async (file) => {
        const decision = await confirm({
            title: 'Impor akun dari CSV?',
            details: [{ label: 'Berkas', value: file.name }],
            confirmLabel: 'Impor',
            tone: 'warning',
            icon: 'file',
        });
        if (!decision) return;

        const data = new FormData();
        data.append('file', file);

        try {
            const response = await api.upload('/api/admin/users/import', data);
            const detail = await api.get(`/api/admin/users/import/${response.data.batch_id}`);
            setImportResult(detail.data);
            toast.push(`Impor selesai: ${detail.data.success_rows} berhasil, ${detail.data.failed_rows} gagal.`);
            await load();
        } catch (error) {
            toast.push(error.message, 'error');
        }
    };

    return (
        <AppShell
            title="Akun pengguna"
            subtitle="Kelola siswa, Guru BK, dan admin"
            actions={
                <>
                    <label className="sd-btn sd-btn-outline cursor-pointer">
                        Impor CSV
                        <input type="file" accept=".csv" className="sr-only" onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) importCsv(file);
                            event.target.value = '';
                        }} />
                    </label>
                    <Button variant="primary" onClick={() => setOpen(true)}>Tambah akun</Button>
                </>
            }
        >
            <Card className="p-0 sm:p-6">
                <div className="flex flex-wrap items-center gap-2 p-4 sm:p-0 sm:pb-4">
                    <CardTitle>Pengguna</CardTitle>
                    <div className="flex flex-1 flex-wrap justify-end gap-2">
                        <Input className="h-9 w-full max-w-[220px] text-[12px]" placeholder="Cari nama/email/NIS" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
                        <select className="sd-input h-9 w-auto px-3 text-[12px]" value={filters.role} onChange={(event) => setFilters({ ...filters, role: event.target.value })} aria-label="Filter peran">
                            <option value="">Semua peran</option>
                            <option value="student">Siswa</option>
                            <option value="counselor">Guru BK</option>
                            <option value="superadmin">Superadmin</option>
                        </select>
                        <select className="sd-input h-9 w-auto px-3 text-[12px]" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })} aria-label="Filter status">
                            <option value="">Semua status</option>
                            <option value="active">Aktif</option>
                            <option value="pending">Menunggu</option>
                            <option value="inactive">Nonaktif</option>
                            <option value="alumni">Alumni</option>
                        </select>
                    </div>
                </div>

                {importResult ? (
                    <div className="mx-4 mb-4 rounded-xl bg-[#f1f5f9] p-3 text-[12px] sm:mx-0">
                        <p className="font-semibold">Hasil impor {importResult.filename}</p>
                        <p>{importResult.success_rows} berhasil · {importResult.failed_rows} gagal · {importResult.total_rows} baris</p>
                        {importResult.errors?.length ? (
                            <ul className="mt-1 list-inside list-disc text-[#991b1b]">
                                {importResult.errors.slice(0, 5).map((error) => (
                                    <li key={error.row_number}>Baris {error.row_number}: {error.message}</li>
                                ))}
                            </ul>
                        ) : null}
                    </div>
                ) : null}

                {loading ? <div className="p-4"><Skeleton rows={6} /></div> : users.length === 0 ? (
                    <EmptyState title="Tidak ada akun" description="Belum ada akun yang cocok dengan filter." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="sd-table">
                            <thead><tr><th>Nama</th><th>NIS/NIP</th><th>Peran</th><th>Kelas</th><th>Status</th><th>Login terakhir</th><th>Aksi</th></tr></thead>
                            <tbody>
                                {users.map((user) => (
                                    <tr key={user.id}>
                                        <td>
                                            <p className="font-semibold">{user.name}</p>
                                            <p className="text-[11px] text-[#475569]">{user.email ?? '—'}</p>
                                        </td>
                                        <td className="tabular">{user.identity_number}</td>
                                        <td>{label('role', user.role)}</td>
                                        <td>{user.class?.name ?? '—'}</td>
                                        <td>
                                            <Badge tone={user.status === 'active' ? 'success' : user.status === 'pending' ? 'warning' : 'neutral'}>
                                                {label('status', user.status)}
                                            </Badge>
                                        </td>
                                        <td className="text-[11px] text-[#475569]">{relative(user.last_login_at)}</td>
                                        <td>
                                            <div className="flex items-center justify-end gap-1.5">
                                                <IconButton icon="key" label={`Reset kata sandi ${user.name}`} variant="primary" onClick={() => resetPassword(user)} />
                                                <IconButton icon="logout" label={`Putus sesi ${user.name}`} variant="warning" onClick={() => forceLogout(user)} />
                                                <IconButton
                                                    icon={user.status === 'active' ? 'close' : 'check'}
                                                    label={`${user.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'} ${user.name}`}
                                                    variant={user.status === 'active' ? 'danger' : 'success'}
                                                    onClick={() => changeStatus(user)}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            <Modal
                open={open}
                onClose={() => setOpen(false)}
                title="Tambah akun"
                footer={
                    <>
                        <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
                        <Button variant="primary" type="submit" form="user-form" disabled={busy}>{busy ? 'Menyimpan…' : 'Buat akun'}</Button>
                    </>
                }
            >
                <form id="user-form" onSubmit={create} className="space-y-3">
                    <Field label="Nama lengkap" required htmlFor="name">
                        <Input id="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="NIS/NIP" required htmlFor="identity">
                            <Input id="identity" value={form.identity_number} onChange={(event) => setForm({ ...form, identity_number: event.target.value })} required />
                        </Field>
                        <Field label="Peran" required htmlFor="role">
                            <Select id="role" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
                                <option value="student">Siswa</option>
                                <option value="counselor">Guru BK</option>
                                <option value="superadmin">Superadmin</option>
                            </Select>
                        </Field>
                    </div>
                    <Field label="Email" htmlFor="email" hint="Diperlukan untuk undangan aktivasi dan reset kata sandi.">
                        <Input id="email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
                    </Field>
                    {form.role === 'student' ? (
                        <Field label="Kelas" required htmlFor="class">
                            <Select id="class" value={form.class_id} onChange={(event) => setForm({ ...form, class_id: event.target.value })} required>
                                <option value="">Pilih kelas</option>
                                {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                            </Select>
                        </Field>
                    ) : null}
                    <label className="flex items-center gap-2 text-[12px]">
                        <input type="checkbox" checked={form.send_invitation} onChange={(event) => setForm({ ...form, send_invitation: event.target.checked })} className="h-[18px] w-[18px] accent-[#3f51b5]" />
                        Kirim undangan aktivasi
                    </label>
                </form>
            </Modal>
        </AppShell>
    );
}
