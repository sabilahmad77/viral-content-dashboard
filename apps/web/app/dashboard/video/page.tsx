'use client';
import { useState, useEffect } from 'react';
import { Film, Wand2, Code2, Play, Download, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { videosApi, jobsApi, Job } from '@/lib/api';

// ─── Predefined JSON configs ────────────────────────────────────────────────
const DYNAMIC_CONFIG = {
  mode: 'dynamic',
  model: 'kling',
  duration: 5,
  style: 'cinematic',
  scenes: [
    { description: 'Opening aerial shot establishing the scene', duration: 1.5, camera: 'aerial-wide', effect: 'slow_zoom_in' },
    { description: 'Main action sequence with dramatic lighting', duration: 2.0, camera: 'tracking', effect: 'dramatic_light' },
    { description: 'Closing impact/reaction shot', duration: 1.5, camera: 'close-up', effect: 'fade_out' },
  ],
  colorGrade: 'high_contrast',
  audio: 'news_broadcast_ambient',
  aspectRatio: '9:16',
};

const PROMPT_CONFIG = {
  mode: 'prompt',
  model: 'kling',
  prompt: 'Create a cinematic 5-second news video clip about: {topic}. Dramatic camera movement, broadcast quality lighting, professional news aesthetics.',
  duration: 5,
  style: 'broadcast',
  aspectRatio: '16:9',
  effects: ['dramatic_lighting', 'camera_motion'],
  quality: '1080p',
};

// ─── Video result card ───────────────────────────────────────────────────────
function VideoResult({ job }: { job: Job }) {
  const { accessToken } = useAuth();
  const videoSlot = job.outputSlots.find((s) => s.slotType === 'video');
  if (!videoSlot) return null;

  async function handleDownload() {
    if (!videoSlot?.outputUrl) return;
    const a = document.createElement('a');
    a.href = videoSlot.outputUrl;
    a.download = `video-${job.id}.mp4`;
    a.click();
  }

  if (videoSlot.status === 'PENDING' || videoSlot.status === 'PROCESSING' || job.status === 'QUEUED' || job.status === 'PROCESSING') {
    return (
      <div style={{
        borderRadius: 'var(--radius-md)', height: '280px',
        background: 'var(--surface-2)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'var(--accent-dim)', border: '1px solid var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <RefreshCw size={22} color="var(--accent)" style={{ animation: 'spin 1s linear infinite' }} />
        </div>
        <div>
          <div style={{ fontSize: '14px', color: 'var(--text-primary)', textAlign: 'center', marginBottom: '4px' }}>Generating video...</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>This may take up to 90 seconds</div>
        </div>
        <div style={{
          padding: '4px 12px', borderRadius: '999px',
          background: 'var(--accent-dim)', border: '1px solid var(--accent)',
          fontSize: '11px', color: 'var(--accent)',
        }}>
          {job.status}
        </div>
      </div>
    );
  }

  if (videoSlot.status === 'FAILED' || job.status === 'FAILED') {
    return (
      <div style={{
        borderRadius: 'var(--radius-md)', height: '200px',
        background: 'var(--surface-2)', border: '1px solid rgba(220,38,38,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px',
      }}>
        <div style={{ color: 'var(--danger)', fontSize: '14px' }}>Video generation failed</div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {job.errorMsg || 'Check that your Kling API key is configured'}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
      <video
        src={videoSlot.outputUrl}
        autoPlay muted loop controls
        style={{ width: '100%', maxHeight: '400px', display: 'block' }}
      />
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          5s · Kling AI · {new Date(job.createdAt).toLocaleTimeString()}
        </div>
        <button className="btn btn-ghost" style={{ height: '30px', fontSize: '12px' }} onClick={handleDownload}>
          <Download size={13} /> Download
        </button>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function VideoStudioPage() {
  const { accessToken } = useAuth();
  const [mode, setMode] = useState<'prompt' | 'config'>('prompt');

  // Prompt mode state
  const [promptText, setPromptText] = useState('');

  // Config mode state
  const [selectedConfig, setSelectedConfig] = useState<'dynamic' | 'prompt-based'>('dynamic');
  const [configJson, setConfigJson] = useState(JSON.stringify(DYNAMIC_CONFIG, null, 2));
  const [topic, setTopic] = useState('');
  const [configJsonError, setConfigJsonError] = useState('');
  const [showConfigEditor, setShowConfigEditor] = useState(false);

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [history, setHistory] = useState<Job[]>([]);

  // Poll active job
  useEffect(() => {
    if (!currentJobId || !accessToken) return;
    if (currentJob?.status === 'DONE' || currentJob?.status === 'FAILED') return;

    const interval = setInterval(async () => {
      try {
        const job = await jobsApi.get(accessToken, currentJobId);
        setCurrentJob(job);
        if (job.status === 'DONE' || job.status === 'FAILED') {
          clearInterval(interval);
          setHistory((prev) => [job, ...prev.filter((j) => j.id !== job.id)]);
        }
      } catch {
        clearInterval(interval);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [currentJobId, currentJob?.status, accessToken]);

  function handleSelectConfig(type: 'dynamic' | 'prompt-based') {
    setSelectedConfig(type);
    setConfigJson(JSON.stringify(type === 'dynamic' ? DYNAMIC_CONFIG : PROMPT_CONFIG, null, 2));
    setConfigJsonError('');
  }

  async function handleGenerate() {
    if (!accessToken) return;
    setError('');
    setGenerating(true);

    try {
      let result: { jobId: string; estimatedSeconds: number };

      if (mode === 'prompt') {
        if (!promptText.trim()) { setError('Please enter a video prompt.'); setGenerating(false); return; }
        result = await videosApi.generate(accessToken, { mode: 'prompt', prompt: promptText.trim() });
      } else {
        let parsedConfig: Record<string, unknown>;
        try {
          parsedConfig = JSON.parse(configJson);
        } catch {
          setConfigJsonError('Invalid JSON — please fix the config before generating.');
          setGenerating(false);
          return;
        }
        result = await videosApi.generate(accessToken, {
          mode: 'config',
          config: parsedConfig,
          topic: topic.trim() || undefined,
        });
      }

      setCurrentJobId(result.jobId);
      setCurrentJob(null);

      // Fetch initial job state
      const job = await jobsApi.get(accessToken, result.jobId);
      setCurrentJob(job);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  const canGenerate = mode === 'prompt' ? promptText.trim().length > 0 : true;

  return (
    <div style={{ maxWidth: '860px' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
          <div style={{
            width: 36, height: 36, borderRadius: '10px',
            background: 'var(--accent-dim)', border: '1px solid var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Film size={18} color="var(--accent)" />
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
            Video Studio
          </h1>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginLeft: '48px' }}>
          Generate AI videos using a custom prompt or a structured JSON configuration.
        </p>
      </div>

      {/* Mode toggle */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '28px', marginBottom: '16px',
      }}>
        <div style={{
          display: 'flex', gap: '4px', marginBottom: '24px',
          background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)',
          padding: '4px', width: 'fit-content',
        }}>
          <button
            onClick={() => setMode('prompt')}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '7px 16px', borderRadius: 'var(--radius-sm)',
              border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
              background: mode === 'prompt' ? 'var(--accent)' : 'transparent',
              color: mode === 'prompt' ? '#000' : 'var(--text-secondary)',
              transition: 'all 0.15s',
            }}
          >
            <Wand2 size={14} />
            Prompt Mode
          </button>
          <button
            onClick={() => setMode('config')}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '7px 16px', borderRadius: 'var(--radius-sm)',
              border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
              background: mode === 'config' ? 'var(--accent)' : 'transparent',
              color: mode === 'config' ? '#000' : 'var(--text-secondary)',
              transition: 'all 0.15s',
            }}
          >
            <Code2 size={14} />
            Config Mode
          </button>
        </div>

        {/* Prompt mode */}
        {mode === 'prompt' && (
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Video Prompt
            </label>
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Describe the video you want to generate... e.g. 'A dramatic 5-second news clip showing a breaking news story about climate change. Cinematic quality, broadcast standard, urgent atmosphere.'"
              rows={5}
              style={{
                width: '100%', background: 'var(--surface-2)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)', fontSize: '14px', lineHeight: '1.6',
                padding: '12px 14px', resize: 'vertical', outline: 'none',
                fontFamily: 'inherit', boxSizing: 'border-box',
              }}
            />
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', textAlign: 'right' }}>
              {promptText.length}/2000
            </div>
          </div>
        )}

        {/* Config mode */}
        {mode === 'config' && (
          <div>
            {/* Config preset selector */}
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Select Config Preset
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
              <button
                onClick={() => handleSelectConfig('dynamic')}
                style={{
                  padding: '14px 16px', borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'left',
                  background: selectedConfig === 'dynamic' ? 'var(--accent-dim)' : 'var(--surface-2)',
                  border: `1px solid ${selectedConfig === 'dynamic' ? 'var(--accent)' : 'var(--border)'}`,
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 600, color: selectedConfig === 'dynamic' ? 'var(--accent)' : 'var(--text-primary)', marginBottom: '4px' }}>
                  Dynamic Config
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Scene-by-scene structure with camera movements, effects, and timing control.
                </div>
              </button>
              <button
                onClick={() => handleSelectConfig('prompt-based')}
                style={{
                  padding: '14px 16px', borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'left',
                  background: selectedConfig === 'prompt-based' ? 'var(--accent-dim)' : 'var(--surface-2)',
                  border: `1px solid ${selectedConfig === 'prompt-based' ? 'var(--accent)' : 'var(--border)'}`,
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 600, color: selectedConfig === 'prompt-based' ? 'var(--accent)' : 'var(--text-primary)', marginBottom: '4px' }}>
                  Prompt Template Config
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Template-based with {'{topic}'} placeholder — swap the topic per request.
                </div>
              </button>
            </div>

            {/* Topic input */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Topic / Subject <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: '11px' }}>(replaces {'{topic}'} in config)</span>
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. breaking news about economy, climate summit, tech announcement..."
                style={{
                  width: '100%', background: 'var(--surface-2)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)', fontSize: '13px',
                  padding: '10px 14px', outline: 'none',
                  fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* JSON editor toggle */}
            <button
              onClick={() => setShowConfigEditor((v) => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '12px', color: 'var(--text-muted)', padding: 0, marginBottom: showConfigEditor ? '10px' : 0,
              }}
            >
              <Code2 size={13} />
              {showConfigEditor ? 'Hide' : 'View / Edit'} JSON config
              {showConfigEditor ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            {showConfigEditor && (
              <div>
                <textarea
                  value={configJson}
                  onChange={(e) => { setConfigJson(e.target.value); setConfigJsonError(''); }}
                  rows={14}
                  spellCheck={false}
                  style={{
                    width: '100%', background: '#0d1117',
                    border: `1px solid ${configJsonError ? 'rgba(220,38,38,0.5)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-md)',
                    color: '#e6edf3', fontSize: '12px', lineHeight: '1.6',
                    padding: '12px 14px', resize: 'vertical', outline: 'none',
                    fontFamily: 'var(--font-mono)', boxSizing: 'border-box',
                  }}
                />
                {configJsonError && (
                  <div style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '4px' }}>{configJsonError}</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', fontSize: '13px', color: 'var(--danger)' }}>
            {error}
          </div>
        )}

        {/* Generate button */}
        <div style={{ marginTop: '20px' }}>
          <button
            onClick={handleGenerate}
            disabled={generating || !canGenerate}
            className="btn btn-primary"
            style={{ height: '40px', padding: '0 24px', fontSize: '14px', fontWeight: 600 }}
          >
            {generating ? (
              <><RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> Queuing...</>
            ) : (
              <><Play size={15} fill="currentColor" /> Generate Video</>
            )}
          </button>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '12px' }}>
            ~90s · Powered by Kling AI
          </span>
        </div>
      </div>

      {/* Current generation result */}
      {currentJob && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: '24px', marginBottom: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Latest Generation
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {currentJob.newsInput.slice(0, 60)}{currentJob.newsInput.length > 60 ? '...' : ''}
            </span>
          </div>
          <VideoResult job={currentJob} />
        </div>
      )}

      {/* Generation history */}
      {history.length > 1 && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: '24px',
        }}>
          <h3 style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>
            Previous Videos ({history.length - 1})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {history.slice(1).map((job) => (
              <div key={job.id}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', fontFamily: 'var(--font-mono)' }}>
                  {job.newsInput.slice(0, 80)}{job.newsInput.length > 80 ? '...' : ''}
                </div>
                <VideoResult job={job} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
