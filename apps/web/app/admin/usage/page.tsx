'use client';
import useSWR from 'swr';
import { useAuth } from '@/lib/hooks/useAuth';
import { adminApi } from '@/lib/api';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const COST_MAP: Record<string, number> = {
  openai: 0.005,
  anthropic: 0.004,
  flux: 0.05,
  ideogram: 0.04,
  kling: 0.15,
  runway: 0.2,
};

export default function UsagePage() {
  const { accessToken } = useAuth();
  const { data: usage } = useSWR(
    accessToken ? 'admin-usage-page' : null,
    () => adminApi.usage(accessToken!),
    { refreshInterval: 30000 }
  );

  const chartData = usage?.slotsByModel?.map((row) => ({
    service: row.modelUsed ?? 'unknown',
    calls: row._count._all,
    cost: parseFloat(((COST_MAP[row.modelUsed ?? ''] ?? 0.01) * row._count._all).toFixed(2)),
  })) ?? [];

  const totalCost = chartData.reduce((sum, r) => sum + r.cost, 0);

  return (
    <div>
      <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '28px' }}>Usage Dashboard</h1>

      {/* Metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
        {[
          { label: 'API Calls (Month)', value: usage?.totalApiCalls?.toString() ?? '—' },
          { label: 'Est. Cost (Month)', value: usage ? `$${totalCost.toFixed(2)}` : '—' },
          { label: 'Avg Cost / Job', value: usage && usage.todayJobs > 0 ? `$${(totalCost / Math.max(1, usage.totalApiCalls / 16)).toFixed(3)}` : '—' },
          { label: 'Error Rate', value: usage ? `${usage.errorRate}%` : '—' },
        ].map((m) => (
          <div key={m.label} style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', padding: '20px 24px',
          }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{m.label}</div>
            <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--accent)' }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* API Calls chart */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '20px' }}>API Calls by Service</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="service" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
            <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="calls" fill="var(--accent)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Cost breakdown table */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 600 }}>Cost Breakdown by Service</h2>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Service', 'Calls', 'Rate / Call', 'Total Cost', '% of Budget'].map((h) => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chartData.map((row) => (
              <tr key={row.service} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{row.service}</td>
                <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>{row.calls.toLocaleString()}</td>
                <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  ${(COST_MAP[row.service] ?? 0.01).toFixed(3)}
                </td>
                <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                  ${row.cost.toFixed(2)}
                </td>
                <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>
                  {totalCost > 0 ? ((row.cost / totalCost) * 100).toFixed(1) : 0}%
                </td>
              </tr>
            ))}
            <tr style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
              <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600 }}>Total</td>
              <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 500 }}>{chartData.reduce((s, r) => s + r.calls, 0).toLocaleString()}</td>
              <td />
              <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--accent)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                ${totalCost.toFixed(2)}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
