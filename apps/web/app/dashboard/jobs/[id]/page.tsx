'use client';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, FileText } from 'lucide-react';
import { useJob } from '@/lib/hooks/useJob';
import ResultsGrid from '@/components/dashboard/ResultsGrid';

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;
  const { job, mutate } = useJob(jobId);

  if (!job) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: '12px' }}>
        <div className="skeleton" style={{ width: 200, height: 20, borderRadius: 4 }} />
        <div className="skeleton" style={{ width: 300, height: 14, borderRadius: 4 }} />
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => router.back()}
        className="btn btn-ghost"
        style={{ marginBottom: '20px', height: '32px', fontSize: '13px' }}
      >
        <ArrowLeft size={14} /> Back
      </button>

      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '24px', marginBottom: '16px',
      }}>
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
            <Calendar size={13} />
            {new Date(job.createdAt).toLocaleString()}
          </div>
          {job.template && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
              <FileText size={13} />
              {job.template.name} v{job.templateVersion}
            </div>
          )}
        </div>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6', background: 'var(--surface-2)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
          {job.newsInput}
        </p>
      </div>

      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '28px',
      }}>
        <ResultsGrid job={job} onRegen={() => setTimeout(() => mutate(), 3000)} />
      </div>
    </div>
  );
}
