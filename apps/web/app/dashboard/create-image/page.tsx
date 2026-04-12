'use client';
import { useState, useEffect } from 'react';
import CreateImagePanel from '@/components/dashboard/CreateImagePanel';
import ResultsGrid from '@/components/dashboard/ResultsGrid';
import { useJob } from '@/lib/hooks/useJob';
import { useAuth } from '@/lib/hooks/useAuth';
import { templatesApi } from '@/lib/api';
import useSWR from 'swr';
import { RefreshCw } from 'lucide-react';

const SS_IMAGE_JOB = 'createImage_jobId';

function JobSection({ jobId }: { jobId: string | null }) {
  const { job, mutate, pollExpired } = useJob(jobId);
  if (!jobId) return null;

  if (!job) {
    return (
      <div style={{
        padding: '60px 0', textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <RefreshCw size={22} color="#22D3EE" style={{ animation: 'spin 1.2s linear infinite' }} />
        </div>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
            Queuing image editing job...
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Connecting to API — this takes a few seconds
          </div>
        </div>
      </div>
    );
  }

  // Req 38-39: If polling expired, show a clear non-blocking message
  if (pollExpired) {
    const done = job.outputSlots.filter((s) => s.status === 'DONE').length;
    const total = job.outputSlots.length;
    return (
      <div>
        <div style={{
          padding: '14px 18px', marginBottom: '20px',
          background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.25)',
          borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <span style={{ fontSize: '16px' }}>⚠️</span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(251,146,60,0.9)', marginBottom: '2px' }}>
              Generation is taking longer than expected ({done}/{total} done)
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              The backend is still running. Check Job History for final results, or
              <button
                style={{ marginLeft: 6, background: 'none', border: 'none', color: '#22D3EE', cursor: 'pointer', fontSize: '12px', padding: 0 }}
                onClick={() => mutate()}
              >refresh now</button>.
            </div>
          </div>
        </div>
        <ResultsGrid job={job} onRegen={() => mutate()} hideVideo />
      </div>
    );
  }

  return <ResultsGrid job={job} onRegen={() => mutate()} hideVideo />;
}

export default function CreateImagePage() {
  const { accessToken } = useAuth();
  const [jobId, setJobId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SS_IMAGE_JOB);
      if (saved) setJobId(saved);
    } catch { /* ignore */ }
  }, []);

  const { data: templates } = useSWR(
    accessToken ? 'templates-active' : null,
    () => templatesApi.list(accessToken!)
  );
  const activeTemplate = templates?.find((t) => t.isActive);

  function handleJobCreated(newJobId: string) {
    setJobId(newJobId);
    try { sessionStorage.setItem(SS_IMAGE_JOB, newJobId); } catch { /* ignore */ }
  }

  return (
    <div>
      <div style={{
        background: 'linear-gradient(160deg, var(--surface-2) 0%, var(--surface-3) 100%)',
        border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
        padding: '32px', marginBottom: '16px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(34,211,238,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <CreateImagePanel
          onJobCreated={handleJobCreated}
          templateName={activeTemplate?.name}
          templateVersion={activeTemplate?.version}
        />
      </div>

      {jobId && (
        <div style={{
          background: 'linear-gradient(160deg, var(--surface-2) 0%, var(--surface-3) 100%)',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
          padding: '28px 32px',
        }}>
          <JobSection jobId={jobId} />
        </div>
      )}
    </div>
  );
}
