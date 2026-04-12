'use client';
import { useState } from 'react';
import { Copy, Check, RefreshCw, Download, X, Play, Sparkles, Image as ImageIcon, FileText } from 'lucide-react';
import { Job, OutputSlot, outputsApi } from '@/lib/api';
import { useAuth } from '@/lib/hooks/useAuth';

interface ResultsGridProps {
  job: Job;
  onRegen: (slotId: string) => void;
  hideVideo?: boolean;
}

// ── Accent colors cycling through caption slots ──────────────────────────────
const ACCENT_COLORS = [
  { color: '#6366F1', dim: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.25)' },
  { color: '#22D3EE', dim: 'rgba(34,211,238,0.1)', border: 'rgba(34,211,238,0.22)' },
  { color: '#A78BFA', dim: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.25)' },
  { color: '#34D399', dim: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.22)' },
  { color: '#F472B6', dim: 'rgba(244,114,182,0.1)', border: 'rgba(244,114,182,0.22)' },
  { color: '#FBBF24', dim: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.22)' },
  { color: '#818CF8', dim: 'rgba(129,140,248,0.12)', border: 'rgba(129,140,248,0.25)' },
  { color: '#2DD4BF', dim: 'rgba(45,212,191,0.1)', border: 'rgba(45,212,191,0.22)' },
  { color: '#FB923C', dim: 'rgba(251,146,60,0.1)', border: 'rgba(251,146,60,0.22)' },
  { color: '#E879F9', dim: 'rgba(232,121,249,0.1)', border: 'rgba(232,121,249,0.22)' },
];

function CaptionCard({ slot, index, onRegen }: { slot: OutputSlot; index: number; onRegen: () => void }) {
  const [copied, setCopied] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const accent = ACCENT_COLORS[index % ACCENT_COLORS.length];

  async function handleCopy() {
    if (slot.outputText) {
      await navigator.clipboard.writeText(slot.outputText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  }

  async function handleRegen() {
    setRegenLoading(true);
    onRegen();
    setTimeout(() => setRegenLoading(false), 3000);
  }

  const shortLabel = `Caption ${index + 1}`;

  // ── PENDING / PROCESSING ─────────────────────────────────────────────────
  if (slot.status === 'PENDING' || slot.status === 'PROCESSING') {
    return (
      <div style={{
        background: 'var(--surface-2)',
        border: `1px solid ${accent.border}`,
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        minHeight: '160px',
      }}>
        <div style={{
          height: '2px',
          background: `linear-gradient(90deg, ${accent.color}, transparent)`,
          animation: 'shimmer 1.4s ease-in-out infinite',
          backgroundSize: '200% 100%',
        }} />
        <div style={{ padding: '14px 16px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '2px 8px', borderRadius: '999px',
            background: accent.dim, border: `1px solid ${accent.border}`,
            fontSize: '10px', fontWeight: 700, letterSpacing: '0.07em',
            textTransform: 'uppercase', color: accent.color, marginBottom: '14px',
          }}>
            <span className="pulse" style={{ width: 5, height: 5, borderRadius: '50%', background: accent.color, display: 'inline-block' }} />
            {shortLabel}
          </div>
          <div className="skeleton" style={{ height: '11px', width: '85%', borderRadius: 4, marginBottom: '8px' }} />
          <div className="skeleton" style={{ height: '11px', width: '70%', borderRadius: 4, marginBottom: '8px' }} />
          <div className="skeleton" style={{ height: '11px', width: '55%', borderRadius: 4 }} />
        </div>
      </div>
    );
  }

  // ── FAILED ───────────────────────────────────────────────────────────────
  if (slot.status === 'FAILED') {
    return (
      <div style={{
        background: 'var(--surface-2)',
        border: '1px solid rgba(244,63,94,0.25)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        minHeight: '160px',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '12px',
        padding: '24px 16px',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(244,63,94,0.12)',
          border: '1px solid rgba(244,63,94,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <X size={16} color="var(--danger)" />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--danger)', marginBottom: '3px' }}>Generation failed</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{shortLabel}</div>
        </div>
        <button
          className="btn btn-ghost"
          style={{ height: '32px', fontSize: '12px', padding: '0 14px' }}
          onClick={handleRegen}
          disabled={regenLoading}
        >
          <RefreshCw size={12} style={{ animation: regenLoading ? 'spin 1s linear infinite' : 'none' }} />
          {regenLoading ? 'Retrying...' : 'Retry'}
        </button>
      </div>
    );
  }

  // ── DONE ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      background: 'var(--surface-2)',
      border: `1px solid var(--border)`,
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = accent.border;
        (e.currentTarget as HTMLDivElement).style.boxShadow = `var(--shadow-md), 0 0 0 1px ${accent.border}`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
      }}
    >
      {/* Top accent line */}
      <div style={{ height: '2px', background: `linear-gradient(90deg, ${accent.color}, transparent)` }} />

      {/* Label */}
      <div style={{ padding: '12px 16px 0' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          padding: '2px 8px', borderRadius: '999px',
          background: accent.dim, border: `1px solid ${accent.border}`,
          fontSize: '10px', fontWeight: 700, letterSpacing: '0.07em',
          textTransform: 'uppercase', color: accent.color,
        }}>
          {shortLabel}
        </span>
      </div>

      {/* Content */}
      <div style={{
        padding: '12px 16px',
        fontSize: '13.5px', lineHeight: '1.75', color: 'var(--text-primary)',
        flex: 1, fontWeight: 400, letterSpacing: '0.01em',
      }}>
        {slot.outputText}
      </div>

      {/* Action bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px 12px',
        borderTop: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {slot.outputText?.length ?? 0} chars
        </span>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={handleCopy}
            className="btn btn-ghost"
            style={{ height: '30px', fontSize: '12px', padding: '0 12px' }}
          >
            {copied
              ? <><Check size={12} style={{ color: 'var(--success)' }} /> Copied</>
              : <><Copy size={12} /> Copy</>
            }
          </button>
          <button
            onClick={handleRegen}
            disabled={regenLoading}
            className="btn btn-ghost"
            style={{ height: '30px', fontSize: '12px', padding: '0 12px' }}
          >
            <RefreshCw size={12} style={{ animation: regenLoading ? 'spin 1s linear infinite' : 'none', color: accent.color }} />
            Recreate
          </button>
        </div>
      </div>
    </div>
  );
}

function ImageCard({ slot, index, jobId, onRegen }: { slot: OutputSlot; index: number; jobId: string; onRegen: () => void }) {
  const { accessToken } = useAuth();
  const [lightbox, setLightbox] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const accent = ACCENT_COLORS[index % ACCENT_COLORS.length];

  async function handleDownload() {
    try {
      const { url } = await outputsApi.download(accessToken!, slot.id);
      const a = document.createElement('a');
      a.href = url;
      a.download = `image-${slot.id}.jpg`;
      a.click();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleRegen() {
    setRegenLoading(true);
    onRegen();
    setTimeout(() => setRegenLoading(false), 5000);
  }

  const snap = slot.promptSnapshot as { label?: string };
  const label = snap.label ?? `Image ${index + 1}`;
  const shortLabel = label.replace(/^Image \d+ — /, '').replace(/^Image \d+$/, `Slot ${index + 1}`);

  // ── PENDING / PROCESSING ─────────────────────────────────────────────────
  if (slot.status === 'PENDING' || slot.status === 'PROCESSING') {
    // Show contextual step label based on status
    const stepLabel = slot.status === 'PENDING' ? 'Queued — waiting turn' : 'Editing base image...';
    const stepSub = slot.status === 'PROCESSING'
      ? 'Validating quality & compositing overlay'
      : 'Sequential processing — will start shortly';
    return (
      <div style={{
        borderRadius: 'var(--radius-md)', aspectRatio: '1/1', overflow: 'hidden',
        background: 'var(--surface-2)', border: `1px solid ${accent.border}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px',
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%',
          background: accent.dim, border: `1px solid ${accent.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <RefreshCw size={18} color={accent.color} style={{ animation: 'spin 1.2s linear infinite' }} />
        </div>
        <div style={{ textAlign: 'center', padding: '0 12px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: accent.color, marginBottom: '4px' }}>
            {stepLabel}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
            {stepSub}
          </div>
        </div>
        {/* Progress pulse bar */}
        <div style={{ width: '70%', height: '2px', background: 'var(--border)', borderRadius: 1, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 1,
            background: `linear-gradient(90deg, ${accent.color}, transparent)`,
            animation: 'shimmer 1.6s ease-in-out infinite',
            backgroundSize: '200% 100%',
          }} />
        </div>
      </div>
    );
  }

  // ── FAILED ───────────────────────────────────────────────────────────────
  if (slot.status === 'FAILED') {
    return (
      <div style={{
        borderRadius: 'var(--radius-md)', aspectRatio: '1/1',
        background: 'var(--surface-2)', border: '1px solid rgba(244,63,94,0.2)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px',
        padding: '16px',
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: '50%',
          background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.22)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <X size={16} color="var(--danger)" />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--danger)', marginBottom: '2px' }}>
            Edit failed
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px' }}>{shortLabel}</div>
          <div style={{ fontSize: '10px', color: 'rgba(251,146,60,0.7)' }}>
            Retried 4×. Click Retry to try again.
          </div>
        </div>
        <button
          className="btn btn-ghost"
          style={{ height: '26px', fontSize: '11px', padding: '0 12px' }}
          onClick={handleRegen}
          disabled={regenLoading}
        >
          <RefreshCw size={11} style={{ animation: regenLoading ? 'spin 1s linear infinite' : 'none' }} />
          {regenLoading ? 'Retrying...' : 'Retry'}
        </button>
      </div>
    );
  }

  // ── DONE ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div style={{
        borderRadius: 'var(--radius-md)', overflow: 'hidden',
        border: '1px solid var(--border)',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
      }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = accent.border;
          (e.currentTarget as HTMLDivElement).style.boxShadow = `var(--shadow-lg), 0 0 0 1px ${accent.border}`;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)';
          (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
        }}
      >
        {/* Image */}
        <div style={{ position: 'relative', aspectRatio: '1/1', cursor: 'zoom-in', overflow: 'hidden' }}>
          <img
            src={slot.outputUrl}
            alt={`Generated image ${slot.slotIndex}`}
            onClick={() => setLightbox(true)}
            style={{
              width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.04)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          />
          {/* Label chip */}
          {shortLabel && (
            <div style={{
              position: 'absolute', top: '10px', left: '10px',
              background: 'rgba(4,6,14,0.82)', backdropFilter: 'blur(6px)',
              borderRadius: '6px', padding: '3px 8px',
              fontSize: '10px', fontWeight: 600, color: accent.color,
              letterSpacing: '0.05em', textTransform: 'uppercase',
              border: `1px solid ${accent.border}`,
            }}>
              {shortLabel}
            </div>
          )}
        </div>

        {/* Action bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px',
          padding: '9px 10px',
          background: 'var(--surface-3)',
          borderTop: '1px solid var(--border)',
        }}>
          <button
            className="btn btn-ghost"
            style={{ height: '28px', fontSize: '11px', padding: '0 10px' }}
            onClick={handleDownload}
          >
            <Download size={11} /> Save
          </button>
          <button
            className="btn btn-ghost"
            style={{ height: '28px', fontSize: '11px', padding: '0 10px' }}
            onClick={handleRegen}
            disabled={regenLoading}
          >
            <RefreshCw size={11} style={{ animation: regenLoading ? 'spin 1s linear infinite' : 'none' }} />
            {regenLoading ? 'Regenerating...' : 'Recreate'}
          </button>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(4,6,14,0.95)', backdropFilter: 'blur(12px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
          }}
        >
          <button
            onClick={() => setLightbox(false)}
            style={{
              position: 'absolute', top: '20px', right: '20px',
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '50%', width: '40px', height: '40px',
              cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(8px)', transition: 'background 0.15s',
            }}
          >
            <X size={18} />
          </button>
          <img
            src={slot.outputUrl}
            alt="Full size"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
            }}
          />
        </div>
      )}
    </>
  );
}

function VideoCard({ slot, onRegen }: { slot: OutputSlot; onRegen: () => void }) {
  const { accessToken } = useAuth();
  const [regenLoading, setRegenLoading] = useState(false);

  async function handleDownload() {
    try {
      const { url } = await outputsApi.download(accessToken!, slot.id);
      const a = document.createElement('a');
      a.href = url;
      a.download = `video-${slot.id}.mp4`;
      a.click();
    } catch (err) {
      console.error(err);
    }
  }

  if (slot.status === 'PENDING' || slot.status === 'PROCESSING') {
    return (
      <div style={{
        borderRadius: 'var(--radius-md)', height: '300px',
        background: 'var(--surface-2)', border: '1px solid var(--border-accent)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'var(--accent-dim)', border: '1px solid var(--border-accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Play size={24} color="var(--accent)" />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Generating video...
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>This may take up to 90 seconds</div>
        </div>
      </div>
    );
  }

  if (slot.status === 'FAILED') {
    return (
      <div style={{
        borderRadius: 'var(--radius-md)', height: '300px',
        background: 'var(--surface-2)', border: '1px solid rgba(244,63,94,0.2)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px',
      }}>
        <div style={{ color: 'var(--danger)', fontSize: '14px', fontWeight: 600 }}>Video generation failed</div>
        <button
          className="btn btn-ghost"
          style={{ height: '32px' }}
          onClick={() => { setRegenLoading(true); onRegen(); }}
          disabled={regenLoading}
        >
          <RefreshCw size={13} style={{ animation: regenLoading ? 'spin 1s linear infinite' : 'none' }} />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--surface-2)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)', overflow: 'hidden',
    }}>
      <video src={slot.outputUrl} autoPlay muted loop controls
        style={{ width: '100%', maxHeight: '400px', display: 'block' }}
      />
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>5s · {slot.modelUsed ?? 'Kling AI'}</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-ghost" style={{ height: '32px', fontSize: '12px' }} onClick={handleDownload}>
            <Download size={13} /> Download
          </button>
          <button
            className="btn btn-ghost"
            style={{ height: '32px', fontSize: '12px' }}
            onClick={() => { setRegenLoading(true); onRegen(); }}
            disabled={regenLoading}
          >
            <RefreshCw size={13} style={{ animation: regenLoading ? 'spin 1s linear infinite' : 'none' }} />
            Recreate
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ icon, label, count, done }: { icon: React.ReactNode; label: string; count: number; done: number }) {
  const allDone = done === count;
  const pct = count > 0 ? Math.round((done / count) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
      <div style={{
        width: 30, height: 30, borderRadius: '8px',
        background: 'linear-gradient(135deg, var(--accent-dim), rgba(34,211,238,0.08))',
        border: '1px solid var(--border-accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.01em' }}>
          {label}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
          {done}/{count} complete
          {allDone && <span style={{ color: 'var(--success)', marginLeft: '6px' }}>✓ Done</span>}
        </div>
      </div>
      {/* Progress bar */}
      <div style={{ flex: 1, height: '3px', background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 2,
          width: `${pct}%`,
          background: allDone
            ? 'var(--success)'
            : 'linear-gradient(90deg, var(--accent), var(--cyan))',
          transition: 'width 0.4s ease',
        }} />
      </div>
    </div>
  );
}

export default function ResultsGrid({ job, onRegen, hideVideo = false }: ResultsGridProps) {
  const { accessToken } = useAuth();

  const captions = job.outputSlots.filter((s) => s.slotType === 'caption').sort((a, b) => a.slotIndex - b.slotIndex);
  const images = job.outputSlots.filter((s) => s.slotType === 'image').sort((a, b) => a.slotIndex - b.slotIndex);
  const videos = job.outputSlots.filter((s) => s.slotType === 'video').sort((a, b) => a.slotIndex - b.slotIndex);

  const captionsDone = captions.filter((s) => s.status === 'DONE').length;
  const imagesDone = images.filter((s) => s.status === 'DONE').length;
  const totalDone = job.outputSlots.filter((s) => s.status === 'DONE').length;
  const totalSlots = job.outputSlots.length;

  const elapsed = job.completedAt
    ? ((new Date(job.completedAt).getTime() - new Date(job.createdAt).getTime()) / 1000).toFixed(1)
    : null;

  async function handleRegen(slotId: string) {
    try {
      await outputsApi.regen(accessToken!, job.id, slotId);
      onRegen(slotId);
    } catch (err) {
      console.error('Regen failed:', err);
    }
  }

  return (
    <div style={{ marginTop: '28px' }} className="fade-up">
      {/* Results meta bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '28px', padding: '16px 20px',
        background: 'linear-gradient(135deg, var(--surface-2) 0%, var(--surface-3) 100%)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
      }}>
        <div>
          <div style={{
            fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
            marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <Sparkles size={12} color="var(--accent-2)" />
            &ldquo;{job.newsInput.slice(0, 90)}{job.newsInput.length > 90 ? '...' : ''}&rdquo;
          </div>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            {elapsed && (
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                ⚡ {elapsed}s
              </span>
            )}
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{captions.length} captions</span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{images.length} images</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: '22px', fontWeight: 800,
            background: job.status === 'DONE'
              ? 'linear-gradient(135deg, #10B981, #34D399)'
              : 'linear-gradient(135deg, var(--accent), var(--cyan))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            {totalDone}/{totalSlots}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {job.status === 'DONE' ? 'All complete' : job.status === 'FAILED' ? 'Partially failed' : 'Generating...'}
          </div>
        </div>
      </div>

      {/* Captions */}
      {captions.length > 0 && (
        <section style={{ marginBottom: '36px' }}>
          <SectionHeader
            icon={<FileText size={14} color="var(--accent-2)" />}
            label="Captions"
            count={captions.length}
            done={captionsDone}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {captions.map((slot, i) => (
              <CaptionCard key={slot.id} slot={slot} index={i} onRegen={() => handleRegen(slot.id)} />
            ))}
          </div>
        </section>
      )}

      {/* Images */}
      {images.length > 0 && (
        <section style={{ marginBottom: '36px' }}>
          <SectionHeader
            icon={<ImageIcon size={14} color="var(--cyan)" />}
            label="Images"
            count={images.length}
            done={imagesDone}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '12px' }}>
            {images.map((slot, i) => (
              <ImageCard key={slot.id} slot={slot} index={i} jobId={job.id} onRegen={() => handleRegen(slot.id)} />
            ))}
          </div>
        </section>
      )}

      {/* Videos */}
      {!hideVideo && videos.length > 0 && (
        <section>
          <SectionHeader
            icon={<Play size={14} color="var(--gold)" />}
            label="Video"
            count={videos.length}
            done={videos.filter((s) => s.status === 'DONE').length}
          />
          {videos.map((slot) => (
            <VideoCard key={slot.id} slot={slot} onRegen={() => handleRegen(slot.id)} />
          ))}
        </section>
      )}
    </div>
  );
}
