'use client';
import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/lib/hooks/useAuth';
import { templatesApi, ApiError, PromptTemplate } from '@/lib/api';
import { Save, CheckCircle, FileText, Image, Film } from 'lucide-react';

type TemplateType = 'content' | 'image' | 'video';

const TEMPLATE_CONFIG: Record<TemplateType, {
  label: string;
  icon: React.ReactNode;
  field: keyof PromptTemplate;
  accentColor: string;
  borderColor: string;
  description: string;
  placeholder: string;
}> = {
  content: {
    label: 'Content Template',
    icon: <FileText size={18} />,
    field: 'contentInstructions',
    accentColor: '#8B5CF6',
    borderColor: 'rgba(139,92,246,0.4)',
    description: 'Instructions for caption generation. This text is used verbatim as the system prompt for all caption slots. Write your rules in plain text — tone, style, format, restrictions, etc.',
    placeholder: `Example:
You are a viral social media content writer.
Write punchy, engaging captions for news content.
Tone: bold, direct, conversational
Format: short paragraphs, no hashtags in the main caption
Max length: 280 characters
Language: English
Always start with the most shocking or emotional fact.
Never use generic phrases like "breaking news" or "you won't believe this".`,
  },
  image: {
    label: 'Image Template',
    icon: <Image size={18} />,
    field: 'imageInstructions',
    accentColor: '#22D3EE',
    borderColor: 'rgba(34,211,238,0.4)',
    description: 'Instructions for image generation. When a base image is uploaded, every output must be derived from it — no new scenes. This text controls exactly what edits are applied.',
    placeholder: `Example:
Edit the uploaded base image.
Do not generate a completely new or unrelated image.
Preserve all original subjects, people, objects, and background.
Apply only these changes:
- Remove any text overlays, logos, or watermarks
- Enhance the lighting to be more dramatic
- Increase color saturation slightly
- Keep the composition and framing identical to the original
Return exactly one finished edited image.`,
  },
  video: {
    label: 'Video Template',
    icon: <Film size={18} />,
    field: 'videoInstructions',
    accentColor: '#F59E0B',
    borderColor: 'rgba(245,158,11,0.4)',
    description: 'Instructions for video generation via Kling AI. Describe the motion style, camera movement, mood, and duration.',
    placeholder: `Example:
Create a dynamic, cinematic news video clip.
Style: dramatic camera movement, broadcast quality
Duration: 5 seconds
Motion: slow push-in, subtle camera shake
Mood: urgent and high-energy
Do not add text overlays.`,
  },
};

function InstructionEditor({
  type,
  template,
  onSaved,
}: {
  type: TemplateType;
  template: PromptTemplate;
  onSaved: () => void;
}) {
  const { accessToken } = useAuth();
  const config = TEMPLATE_CONFIG[type];
  const fieldValue = (template[config.field] as string) ?? '';

  const [value, setValue] = useState(fieldValue);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const hasChanges = value !== fieldValue;

  // Sync when template reloads
  const prevField = useRef(fieldValue);
  useEffect(() => {
    if (fieldValue !== prevField.current) {
      prevField.current = fieldValue;
      setValue(fieldValue);
    }
  }, [fieldValue]);

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await templatesApi.update(accessToken!, template.id, { [config.field]: value });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${hasChanges ? config.borderColor : 'var(--border)'}`,
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      transition: 'border-color 0.2s ease',
    }}>
      {/* Card header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px',
        background: `linear-gradient(135deg, ${config.accentColor}08 0%, transparent 100%)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1 }}>
          <div style={{
            width: 38, height: 38, borderRadius: '10px', flexShrink: 0,
            background: `${config.accentColor}18`,
            border: `1px solid ${config.borderColor}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: config.accentColor,
          }}>
            {config.icon}
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '3px' }}>
              {config.label}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5', maxWidth: '520px' }}>
              {config.description}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {saved && (
            <span style={{ fontSize: '11px', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
              <CheckCircle size={11} /> Saved
            </span>
          )}
          {error && (
            <span style={{ fontSize: '11px', color: 'var(--danger)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {error}
            </span>
          )}
          <button
            className="btn btn-primary"
            style={{
              height: '32px', fontSize: '12px', padding: '0 14px',
              background: hasChanges ? `linear-gradient(135deg, ${config.accentColor} 0%, ${config.accentColor}CC 100%)` : undefined,
              boxShadow: hasChanges ? `0 2px 12px ${config.accentColor}40` : undefined,
              opacity: saving ? 0.7 : 1,
            }}
            onClick={handleSave}
            disabled={saving || !hasChanges}
          >
            <Save size={12} /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Text editor */}
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={config.placeholder}
        spellCheck={false}
        style={{
          width: '100%', minHeight: '260px', padding: '16px 20px',
          background: 'transparent',
          border: 'none', outline: 'none',
          color: 'var(--text-primary)', fontSize: '13px',
          lineHeight: '1.7', resize: 'vertical',
          fontFamily: 'var(--font-mono)',
          boxSizing: 'border-box',
        }}
      />

      {/* Footer with char count */}
      <div style={{
        padding: '8px 20px',
        borderTop: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {value.trim() ? `${value.length.toLocaleString()} characters` : 'Empty — generation will use default slot prompts'}
        </span>
        {hasChanges && (
          <span style={{ fontSize: '11px', color: config.accentColor, fontWeight: 600 }}>
            Unsaved changes
          </span>
        )}
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const { accessToken } = useAuth();
  const { data: templates, mutate } = useSWR(
    accessToken ? 'admin-templates' : null,
    () => templatesApi.list(accessToken!)
  );

  const activeTemplate = templates?.find((t) => t.isActive);

  if (!templates) {
    return <div style={{ padding: '40px', color: 'var(--text-muted)', fontSize: '13px' }}>Loading...</div>;
  }

  if (!activeTemplate) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
        No active template found. Contact an admin.
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>Templates</h1>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '3px 10px', borderRadius: '999px',
            background: 'var(--accent-dim)', border: '1px solid var(--border-accent)',
            fontSize: '11px', fontWeight: 600, color: 'var(--accent-2)',
          }}>
            {activeTemplate.name} · v{activeTemplate.version}
          </div>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Write plain-text instructions for each generation type. These are used verbatim — no JSON, no formatting required.
        </p>
      </div>

      {/* Three instruction editors */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {(['content', 'image', 'video'] as TemplateType[]).map((type) => (
          <InstructionEditor
            key={type}
            type={type}
            template={activeTemplate}
            onSaved={() => mutate()}
          />
        ))}
      </div>
    </div>
  );
}
