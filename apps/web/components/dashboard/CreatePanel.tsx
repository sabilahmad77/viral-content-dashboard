'use client';
import { useState, useEffect, useRef } from 'react';
import { FileText } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { jobsApi } from '@/lib/api';

interface CreatePanelProps {
  onJobCreated: (jobId: string) => void;
  templateName?: string;
  templateVersion?: number;
}

const SS_KEY_TEXT = 'createContent_newsInput';

export default function CreatePanel({ onJobCreated, templateName, templateVersion }: CreatePanelProps) {
  const { accessToken } = useAuth();
  const [newsInput, setNewsInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const restoredRef = useRef(false);

  // Restore from sessionStorage on mount
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    try {
      const saved = sessionStorage.getItem(SS_KEY_TEXT);
      if (saved) setNewsInput(saved);
    } catch { /* ignore */ }
  }, []);

  // Persist text on change
  useEffect(() => {
    try { sessionStorage.setItem(SS_KEY_TEXT, newsInput); } catch { /* ignore */ }
  }, [newsInput]);

  async function handleGenerate() {
    if (!newsInput.trim()) return;
    setError('');
    setIsGenerating(true);
    try {
      const fd = new FormData();
      fd.append('newsInput', newsInput.trim());
      fd.append('mode', 'content');
      const { jobId } = await jobsApi.create(accessToken!, fd);
      onJobCreated(jobId);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to create job');
    } finally {
      setIsGenerating(false);
    }
  }

  const charCount = newsInput.length;
  const tooLong = charCount > 2000;
  const canGenerate = newsInput.trim().length > 0 && !tooLong && !isGenerating;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{
            fontSize: '22px', fontWeight: 800, letterSpacing: '-0.5px',
            background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            marginBottom: '3px',
          }}>
            Create Content
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', letterSpacing: '0.01em' }}>
            Generate 10 captions sequentially via GPT-4o &amp; Gemini
          </p>
        </div>
        {templateName && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '6px 14px',
            background: 'var(--accent-dim)', border: '1px solid var(--border-accent)',
            borderRadius: '999px', fontSize: '11px', color: 'var(--accent-2)', fontWeight: 600,
            letterSpacing: '0.03em',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', boxShadow: '0 0 6px var(--accent)' }} />
            {templateName} <span style={{ opacity: 0.6 }}>v{templateVersion}</span>
          </div>
        )}
      </div>

      {/* Textarea */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{
          display: 'block', marginBottom: '8px',
          fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)',
          letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>
          News Topic or Article
        </label>
        <div style={{ position: 'relative' }}>
          <textarea
            value={newsInput}
            onChange={(e) => setNewsInput(e.target.value)}
            placeholder="Paste your news text, headline, or topic here..."
            style={{
              width: '100%', minHeight: '140px', padding: '16px',
              background: 'var(--surface-3)',
              border: `1px solid ${tooLong ? 'var(--danger)' : newsInput.length > 0 ? 'var(--border-accent)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
              fontSize: '14px', lineHeight: '1.7', resize: 'vertical',
              fontFamily: 'var(--font-sans)', transition: 'border-color 0.18s ease',
              boxShadow: newsInput.length > 0 ? '0 0 0 3px rgba(99,102,241,0.08)' : 'none',
            }}
          />
          <div style={{
            position: 'absolute', bottom: '12px', right: '14px',
            fontSize: '11px', fontFamily: 'var(--font-mono)',
            color: tooLong ? 'var(--danger)' : charCount > 1500 ? 'var(--warning)' : 'var(--text-muted)',
          }}>
            {charCount.toLocaleString()}/2,000
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '12px 16px', marginBottom: '16px',
          background: 'var(--danger-dim)', border: '1px solid rgba(244,63,94,0.3)',
          borderRadius: 'var(--radius-sm)', color: 'var(--danger)', fontSize: '13px',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <span style={{ fontSize: '16px' }}>⚠</span> {error}
        </div>
      )}

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={!canGenerate}
        style={{
          width: '100%', height: '52px',
          background: canGenerate
            ? 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)'
            : 'var(--surface-3)',
          color: canGenerate ? '#fff' : 'var(--text-muted)',
          border: canGenerate ? 'none' : '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          fontSize: '14px', fontWeight: 700, cursor: canGenerate ? 'pointer' : 'not-allowed',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px',
          transition: 'all 0.2s ease',
          boxShadow: canGenerate ? '0 4px 20px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.15)' : 'none',
          letterSpacing: '0.02em',
        }}
        onMouseEnter={(e) => {
          if (canGenerate) {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 24px rgba(99,102,241,0.5), inset 0 1px 0 rgba(255,255,255,0.15)';
          }
        }}
        onMouseLeave={(e) => {
          if (canGenerate) {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 20px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.15)';
          }
        }}
      >
        {isGenerating ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {[0, 0.18, 0.36].map((delay, i) => (
              <span key={i} className="pulse" style={{
                display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
                background: '#fff', animationDelay: `${delay}s`,
              }} />
            ))}
            <span style={{ marginLeft: '2px' }}>Generating captions...</span>
          </div>
        ) : (
          <>
            <FileText size={17} />
            Generate 10 Captions
          </>
        )}
      </button>
    </div>
  );
}
