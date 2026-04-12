'use client';
import { useState, useEffect } from 'react';
import CreatePanel from '@/components/dashboard/CreatePanel';
import ResultsGrid from '@/components/dashboard/ResultsGrid';
import { useJob } from '@/lib/hooks/useJob';
import { useAuth } from '@/lib/hooks/useAuth';
import { templatesApi } from '@/lib/api';
import useSWR from 'swr';
import { RefreshCw } from 'lucide-react';

const SS_CONTENT_JOB = 'dashboard_contentJobId';

function JobSection({ jobId }: { jobId: string | null }) {
  const { job } = useJob(jobId);
  if (!jobId) return null;
  if (!job) {
    return (
      <div style={{
        padding: '60px 0', textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: 'var(--accent-dim)', border: '1px solid var(--border-accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <RefreshCw size={22} color="var(--accent)" style={{ animation: 'spin 1.2s linear infinite' }} />
        </div>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
            Initializing generation...
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Your captions are being queued — this takes a few seconds
          </div>
        </div>
      </div>
    );
  }
  return <ResultsGrid job={job} onRegen={() => {}} hideVideo />;
}

export default function DashboardPage() {
  const { accessToken } = useAuth();
  const [jobId, setJobId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SS_CONTENT_JOB);
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
    try { sessionStorage.setItem(SS_CONTENT_JOB, newJobId); } catch { /* ignore */ }
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
          background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <CreatePanel
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
