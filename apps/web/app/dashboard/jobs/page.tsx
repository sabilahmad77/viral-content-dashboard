'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useAuth } from '@/lib/hooks/useAuth';
import { jobsApi, Job } from '@/lib/api';
import { ChevronLeft, ChevronRight } from 'lucide-react';

function StatusBadge({ status }: { status: Job['status'] }) {
  const map = {
    DONE: 'badge-done',
    FAILED: 'badge-failed',
    PROCESSING: 'badge-processing',
    QUEUED: 'badge-queued',
  };
  return <span className={`badge ${map[status]}`}>{status}</span>;
}

export default function JobsPage() {
  const { accessToken } = useAuth();
  const router = useRouter();
  const [page, setPage] = useState(1);

  const { data } = useSWR(
    accessToken ? ['jobs', page] : null,
    () => jobsApi.list(accessToken!, page),
    { refreshInterval: 5000 }
  );

  const jobs = data?.jobs ?? [];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700 }}>Job History</h1>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          {data?.total ?? 0} total jobs
        </div>
      </div>

      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Date', 'News excerpt', 'Captions', 'Images', 'Videos', 'Status'].map((h) => (
                <th key={h} style={{
                  padding: '12px 16px', textAlign: 'left',
                  fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em',
                  textTransform: 'uppercase', color: 'var(--text-muted)',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No jobs yet. Create your first content above.
                </td>
              </tr>
            ) : jobs.map((job) => {
              const caps = job.outputSlots.filter((s) => s.slotType === 'caption').length;
              const imgs = job.outputSlots.filter((s) => s.slotType === 'image').length;
              const vids = job.outputSlots.filter((s) => s.slotType === 'video').length;
              return (
                <tr
                  key={job.id}
                  onClick={() => router.push(`/dashboard/jobs/${job.id}`)}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                >
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {new Date(job.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-primary)', maxWidth: '320px' }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {job.newsInput.slice(0, 80)}{job.newsInput.length > 80 ? '...' : ''}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center' }}>{caps}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center' }}>{imgs}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center' }}>{vids}</td>
                  <td style={{ padding: '12px 16px' }}><StatusBadge status={job.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginTop: '20px' }}>
          <button
            className="btn btn-ghost"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{ height: '32px' }}
          >
            <ChevronLeft size={14} /> Prev
          </button>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Page {data.page} of {data.pages}
          </span>
          <button
            className="btn btn-ghost"
            onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
            disabled={page === data.pages}
            style={{ height: '32px' }}
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
