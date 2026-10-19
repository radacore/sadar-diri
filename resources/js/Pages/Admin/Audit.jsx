import { useCallback, useEffect, useState } from 'react';
import { Badge, Card, CardTitle, EmptyState, Input, Skeleton, useToast } from '../../Components/UI';
import AppShell from '../../Layouts/AppShell';
import { api } from '../../lib/api';
import { formatDate, label } from '../../lib/format';

export default function Audit() {
    const toast = useToast();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ action: '', from: '', to: '' });

    const load = useCallback(async () => {
        try {
            const query = new URLSearchParams();
            Object.entries(filters).forEach(([key, value]) => value && query.set(key, value));
            const response = await api.get(`/api/admin/audit-logs?${query.toString()}`);
            setLogs(response.data ?? []);
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

    return (
        <AppShell title="Audit log" subtitle="Jejak aksi sensitif dan akses data pribadi (append-only)">
            <Card className="p-0 sm:p-6">
                <div className="flex flex-wrap items-center gap-2 p-4 sm:p-0 sm:pb-4">
                    <CardTitle>Log</CardTitle>
                    <div className="flex flex-1 flex-wrap justify-end gap-2">
                        <Input className="h-9 w-full max-w-[220px] text-[12px]" placeholder="Filter aksi (mis. journal.viewed)" value={filters.action} onChange={(event) => setFilters({ ...filters, action: event.target.value })} />
                        <Input className="h-9 w-auto text-[12px]" type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} aria-label="Dari tanggal" />
                        <Input className="h-9 w-auto text-[12px]" type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} aria-label="Sampai tanggal" />
                    </div>
                </div>

                {loading ? <div className="p-4"><Skeleton rows={6} /></div> : logs.length === 0 ? (
                    <EmptyState title="Tidak ada log" description="Belum ada aktivitas yang cocok dengan filter." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="sd-table">
                            <thead><tr><th>Waktu</th><th>Aktor</th><th>Aksi</th><th>Entitas</th><th>Subjek</th><th>Alasan</th><th>IP</th></tr></thead>
                            <tbody>
                                {logs.map((log) => (
                                    <tr key={log.id}>
                                        <td className="tabular whitespace-nowrap text-[11px]">{formatDate(log.created_at, true)}</td>
                                        <td>{log.actor ? `${log.actor.name} (${label('role', log.actor.role)})` : 'Sistem'}</td>
                                        <td><Badge tone={log.action.includes('denied') ? 'danger' : log.action.includes('viewed') ? 'warning' : 'info'}>{log.action}</Badge></td>
                                        <td className="text-[11px] text-[#475569]">{log.entity_type ?? '—'}{log.entity_id ? ` #${log.entity_id}` : ''}</td>
                                        <td>{log.subject_user?.name ?? '—'}</td>
                                        <td className="text-[11px] text-[#475569]">{log.reason ?? '—'}</td>
                                        <td className="tabular text-[11px]">{log.ip_address ?? '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </AppShell>
    );
}
