'use client';
import useSWR from 'swr';
import { useAuth } from '@/lib/hooks/useAuth';
import { adminApi, jobsApi } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)', padding: '20px 24px',
    }}>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </div>
      <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.5px' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{sub}</div>}
    </div>
  );
}

export default function AdminOverviewPage() {
  const { accessToken } = useAuth();

  const { data: usage } = useSWR(
    accessToken ? 'admin-usage' : null,
    () => adminApi.usage(accessToken!),
    { refreshInterval: 30000 }
  );

  const { data: recentJobs } = useSWR(
    accessToken ? 'admin-logs' : null,
    () => adminApi.logs(accessToken!)
  );

  const chartData = usage?.slotsByModel?.map((row) => ({
    name: row.modelUsed ?? 'unknown',
    calls: row._count._all,
  })) ?? [];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700 }}>Admin Dashboard</h1>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </span>
      </div>

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
        <MetricCard label="Jobs Today" value={usage?.todayJobs?.toString() ?? '—'} />
        <MetricCard label="API Calls (Month)" value={usage?.totalApiCalls?.toString() ?? '—'} />
        <MetricCard label="Est. Cost" value={usage ? `$${usage.estimatedCost.toFixed(2)}` : '—'} sub="this month" />
        <MetricCard label="Active Users" value={usage?.activeUsers?.toString() ?? '—'} />
      </div>

      {/* Chart */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '24px', marginBottom: '28px',
      }}>
        <h2 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '20px' }}>API Calls by Service (This Month)</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
            <Tooltip
              contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
              cursor={{ fill: 'var(--accent-dim)' }}
            />
            <Bar dataKey="calls" fill="var(--accent)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Recent jobs table */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 600 }}>Recent Jobs</h2>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['User', 'News excerpt', 'Slots', 'Status', 'Date'].map((h) => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(recentJobs ?? []).slice(0, 10).map((job) => (
              <tr key={job.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {job.user?.name ?? '—'}
                </td>
                <td style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--text-primary)', maxWidth: '280px' }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {job.newsInput.slice(0, 60)}...
                  </div>
                </td>
                <td style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>
                  {job.outputSlots?.length ?? 0}
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <span className={`badge badge-${job.status.toLowerCase()}`}>{job.status}</span>
                </td>
                <td style={{ padding: '10px 16px', fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {new Date(job.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
