'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useAuth } from '@/lib/hooks/useAuth';
import { templatesApi, ApiError } from '@/lib/api';
import { Save, Play, Zap, ArrowLeft, CheckCircle } from 'lucide-react';
import dynamic from 'next/dynamic';

const CodeMirror = dynamic(() => import('@uiw/react-codemirror'), { ssr: false });

type PreviewSlot = {
  type: string;
  label: string;
  systemPrompt?: string;
  userPrompt?: string;
  imagePrompt?: string;
};

function JsonEditor({
  title,
  subtitle,
  value,
  onChange,
  onSave,
  saving,
  error,
  saved,
}: {
  title: string;
  subtitle: string;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  saving: boolean;
  error: string;
  saved: boolean;
}) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>{subtitle}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {saved && (
            <span style={{ fontSize: '11px', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle size={11} /> Saved
            </span>
          )}
          {error && (
            <span style={{ fontSize: '11px', color: 'var(--danger)', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {error}
            </span>
          )}
          <button
            className="btn btn-primary"
            style={{ height: '30px', fontSize: '12px', padding: '0 12px' }}
            onClick={onSave}
            disabled={saving || !!error}
          >
            <Save size={12} /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Editor */}
      <CodeMirror
        value={value}
        onChange={onChange}
        height="340px"
        theme="dark"
      />
    </div>
  );
}

export default function TemplateEditorPage() {
  const params = useParams();
  const router = useRouter();
  const { accessToken } = useAuth();
  const id = params.id as string;

  const { data: template, mutate } = useSWR(
    accessToken && id ? ['template', id] : null,
    () => templatesApi.get(accessToken!, id)
  );

  // Caption JSON editor state
  const [captionJson, setCaptionJson] = useState('');
  const [captionError, setCaptionError] = useState('');
  const [captionSaving, setCaptionSaving] = useState(false);
  const [captionSaved, setCaptionSaved] = useState(false);

  // Image JSON editor state
  const [imageJson, setImageJson] = useState('');
  const [imageError, setImageError] = useState('');
  const [imageSaving, setImageSaving] = useState(false);
  const [imageSaved, setImageSaved] = useState(false);

  // Preview state
  const [previewInput, setPreviewInput] = useState('Apple announces new AI chip for iPhone 17 Pro');
  const [previewData, setPreviewData] = useState<PreviewSlot[]>([]);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    if (template) {
      setCaptionJson(JSON.stringify(template.captionPromptJson ?? {}, null, 2));
      setImageJson(JSON.stringify(template.imagePromptJson ?? {}, null, 2));
    }
  }, [template]);

  function validateJson(value: string): string {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
        return 'Must be a JSON object { ... }, not an array or primitive';
      }
      return '';
    } catch {
      return 'Invalid JSON — check for missing quotes, brackets, or commas';
    }
  }

  function handleCaptionChange(value: string) {
    setCaptionJson(value);
    setCaptionSaved(false);
    setCaptionError(validateJson(value));
  }

  function handleImageChange(value: string) {
    setImageJson(value);
    setImageSaved(false);
    setImageError(validateJson(value));
  }

  async function handleCaptionSave() {
    const err = validateJson(captionJson);
    if (err) { setCaptionError(err); return; }
    setCaptionSaving(true);
    try {
      await templatesApi.update(accessToken!, id, { captionPromptJson: captionJson });
      await mutate();
      setCaptionSaved(true);
      setTimeout(() => setCaptionSaved(false), 3000);
    } catch (e: unknown) {
      const msg = e instanceof ApiError ? e.message : 'Save failed';
      setCaptionError(msg);
    } finally {
      setCaptionSaving(false);
    }
  }

  async function handleImageSave() {
    const err = validateJson(imageJson);
    if (err) { setImageError(err); return; }
    setImageSaving(true);
    try {
      await templatesApi.update(accessToken!, id, { imagePromptJson: imageJson });
      await mutate();
      setImageSaved(true);
      setTimeout(() => setImageSaved(false), 3000);
    } catch (e: unknown) {
      const msg = e instanceof ApiError ? e.message : 'Save failed';
      setImageError(msg);
    } finally {
      setImageSaving(false);
    }
  }

  async function handleActivate() {
    await templatesApi.activate(accessToken!, id);
    mutate();
  }

  async function handlePreview() {
    if (!previewInput.trim()) return;
    setPreviewing(true);
    try {
      const data = await templatesApi.preview(accessToken!, id, previewInput);
      setPreviewData(data.renderedSlots as PreviewSlot[]);
    } catch (err) {
      console.error(err);
    } finally {
      setPreviewing(false);
    }
  }

  if (!template) {
    return <div style={{ padding: '40px', color: 'var(--text-muted)', fontSize: '13px' }}>Loading...</div>;
  }

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button className="btn btn-ghost" style={{ height: '32px' }} onClick={() => router.back()}>
          <ArrowLeft size={14} />
        </button>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 700 }}>{template.name}</h1>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            v{template.version} · {template.slug}
            {template.isActive && (
              <span style={{ marginLeft: '8px', color: 'var(--success)', fontWeight: 600 }}>● Active</span>
            )}
          </div>
        </div>
        {!template.isActive && (
          <button className="btn btn-ghost" style={{ height: '34px', marginLeft: 'auto' }} onClick={handleActivate}>
            <Zap size={13} /> Activate
          </button>
        )}
      </div>

      {/* Two JSON editors side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <JsonEditor
          title="Caption Prompt JSON"
          subtitle="Controls tone, style, length, forbidden words, and variation directions for all caption slots"
          value={captionJson}
          onChange={handleCaptionChange}
          onSave={handleCaptionSave}
          saving={captionSaving}
          error={captionError}
          saved={captionSaved}
        />
        <JsonEditor
          title="Image Prompt JSON"
          subtitle="Controls style, mood, color palette, composition, restrictions, and variation directions for all image slots"
          value={imageJson}
          onChange={handleImageChange}
          onSave={handleImageSave}
          saving={imageSaving}
          error={imageError}
          saved={imageSaved}
        />
      </div>

      {/* Supported keys hint */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px',
      }}>
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: '12px 16px',
          fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.8',
        }}>
          <span style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '11px' }}>Caption keys: </span>
          <code>tone</code>, <code>style</code>, <code>maxLength</code>, <code>format</code>,{' '}
          <code>language</code>, <code>platform</code>, <code>forbidden</code> (array),{' '}
          <code>required</code> (array), <code>variations</code> (array of {'{'}<code>angle</code>, <code>instruction</code>{'}'})
        </div>
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: '12px 16px',
          fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.8',
        }}>
          <span style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '11px' }}>Image keys: </span>
          <code>style</code>, <code>mood</code>, <code>colorPalette</code>, <code>composition</code>,{' '}
          <code>lighting</code>, <code>quality</code>, <code>aspectRatio</code>,{' '}
          <code>restrictions</code> (array), <code>required</code> (array),{' '}
          <code>baseImageBehavior</code>, <code>variations</code> (array of {'{'}<code>angle</code>, <code>instruction</code>{'}'})
        </div>
      </div>

      {/* Preview section */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', overflow: 'hidden',
      }}>
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Prompt Preview</span>
          <div style={{ flex: 1 }} />
          <input
            value={previewInput}
            onChange={(e) => setPreviewInput(e.target.value)}
            placeholder="Sample news input for preview..."
            style={{ width: '340px', height: '32px', padding: '0 10px', fontSize: '12px' }}
          />
          <button
            className="btn btn-ghost"
            style={{ height: '32px', fontSize: '12px' }}
            onClick={handlePreview}
            disabled={previewing}
          >
            <Play size={12} /> {previewing ? 'Generating...' : 'Preview Prompts'}
          </button>
        </div>

        <div style={{ padding: '16px', maxHeight: '480px', overflowY: 'auto' }}>
          {previewData.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', paddingTop: '32px' }}>
              Click &ldquo;Preview Prompts&rdquo; to see how your JSON rules will be applied to actual generation prompts
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {previewData.map((slot, i) => (
                <div key={i} style={{
                  padding: '12px', background: 'var(--surface-2)',
                  borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                }}>
                  <div style={{
                    fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase',
                    letterSpacing: '0.06em', marginBottom: '8px', fontWeight: 600,
                  }}>
                    {slot.type} · {slot.label}
                  </div>
                  {slot.systemPrompt && (
                    <div style={{ marginBottom: '6px' }}>
                      <div style={{ fontSize: '10px', color: 'var(--accent)', marginBottom: '3px', fontWeight: 600 }}>SYSTEM</div>
                      <pre style={{
                        fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.5',
                        fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        margin: 0, maxHeight: '120px', overflowY: 'auto',
                      }}>{slot.systemPrompt}</pre>
                    </div>
                  )}
                  {slot.userPrompt && (
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--success)', marginBottom: '3px', fontWeight: 600 }}>USER</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        {slot.userPrompt}
                      </div>
                    </div>
                  )}
                  {slot.imagePrompt && (
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--warning)', marginBottom: '3px', fontWeight: 600 }}>IMAGE PROMPT</div>
                      <pre style={{
                        fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.5',
                        fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        margin: 0, maxHeight: '120px', overflowY: 'auto',
                      }}>{slot.imagePrompt}</pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
