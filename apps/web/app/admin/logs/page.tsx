'use client';
import useSWR from 'swr';
import { useAuth } from '@/lib/hooks/useAuth';
import { adminApi } from '@/lib/api';

export default function LogsPage() {
  const { accessToken } = useAuth();
  const { data: jobs } = useSWR(
    accessToken ? 'admin-logs-page' : null,
    () => adminApi.logs(accessToken!),
    { refreshInterval: 10000 }
  );

  return (
    <div>
      <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '24px' }}>System Logs</h1>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Time', 'User', 'Job ID', 'Slots', 'Status', 'Duration'].map((h) => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(jobs ?? []).map((job) => {
              const duration = job.completedAt
                ? ((new Date(job.completedAt).getTime() - new Date(job.createdAt).getTime()) / 1000).toFixed(1) + 's'
                : '—';
              return (
                <tr key={job.id} style={{ borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)' }}>
                  <td style={{ padding: '10px 16px', fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(job.createdAt).toLocaleString()}
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {job.user?.email ?? '—'}
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    {job.id.slice(0, 8)}...
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                    {job.outputSlots?.length ?? 0}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <span className={`badge badge-${job.status.toLowerCase()}`}>{job.status}</span>
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>{duration}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
