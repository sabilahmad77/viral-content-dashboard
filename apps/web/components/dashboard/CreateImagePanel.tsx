'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { ImagePlus, X, Upload, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { jobsApi } from '@/lib/api';

interface CreateImagePanelProps {
  onJobCreated: (jobId: string) => void;
  templateName?: string;
  templateVersion?: number;
}

const SS_KEY_PREVIEW = 'createImage_imagePreview';
const SS_KEY_FILENAME = 'createImage_imageFileName';

export default function CreateImagePanel({ onJobCreated, templateName, templateVersion }: CreateImagePanelProps) {
  const { accessToken } = useAuth();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const restoredRef = useRef(false);

  // Restore uploaded image from sessionStorage on mount
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    try {
      const savedPreview = sessionStorage.getItem(SS_KEY_PREVIEW);
      const savedFileName = sessionStorage.getItem(SS_KEY_FILENAME);
      if (savedPreview && savedFileName) {
        setImagePreview(savedPreview);
        setImageFileName(savedFileName);
        const [header, b64] = savedPreview.split(',');
        const mime = header.replace('data:', '').replace(';base64', '');
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: mime });
        setImageFile(new File([blob], savedFileName, { type: mime }));
      }
    } catch { /* ignore */ }
  }, []);

  const onDrop = useCallback((accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;
    setImageFile(file);
    setImageFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImagePreview(dataUrl);
      try {
        sessionStorage.setItem(SS_KEY_PREVIEW, dataUrl);
        sessionStorage.setItem(SS_KEY_FILENAME, file.name);
      } catch { /* ignore */ }
    };
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/jpeg': [], 'image/png': [], 'image/webp': [] },
    maxSize: 10 * 1024 * 1024,
    multiple: false,
  });

  function removeImage() {
    setImageFile(null);
    setImagePreview(null);
    setImageFileName(null);
    try {
      sessionStorage.removeItem(SS_KEY_PREVIEW);
      sessionStorage.removeItem(SS_KEY_FILENAME);
    } catch { /* ignore */ }
  }

  async function handleGenerate() {
    if (!imageFile) return;
    setError('');
    setIsGenerating(true);
    try {
      const fd = new FormData();
      fd.append('newsInput', '');
      fd.append('mode', 'images');
      fd.append('baseImage', imageFile);
      const { jobId } = await jobsApi.create(accessToken!, fd);
      onJobCreated(jobId);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to create job');
    } finally {
      setIsGenerating(false);
    }
  }

  const canGenerate = imageFile !== null && !isGenerating;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{
            fontSize: '22px', fontWeight: 800, letterSpacing: '-0.5px',
            background: 'linear-gradient(135deg, #0891B2 0%, #22D3EE 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            marginBottom: '3px',
          }}>
            Create Image
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', letterSpacing: '0.01em' }}>
            Upload your base image — the system will generate 10 edited variations from it
          </p>
        </div>
        {templateName && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '6px 14px',
            background: 'rgba(8,145,178,0.1)', border: '1px solid rgba(34,211,238,0.3)',
            borderRadius: '999px', fontSize: '11px', color: '#22D3EE', fontWeight: 600,
            letterSpacing: '0.03em',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22D3EE', display: 'inline-block', boxShadow: '0 0 6px #22D3EE' }} />
            {templateName} <span style={{ opacity: 0.6 }}>v{templateVersion}</span>
          </div>
        )}
      </div>

      {/* Base image upload — full width */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{
          display: 'block', marginBottom: '10px',
          fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)',
          letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>
          Base Image
        </label>

        {imagePreview ? (
          <div style={{ position: 'relative' }}>
            <img
              src={imagePreview}
              alt="Base image"
              style={{
                width: '100%', maxHeight: '340px',
                objectFit: 'contain', objectPosition: 'center',
                background: 'rgba(0,0,0,0.3)',
                borderRadius: 'var(--radius-md)',
                border: '2px solid rgba(34,211,238,0.5)',
                boxShadow: '0 0 0 3px rgba(34,211,238,0.08)',
                display: 'block',
              }}
            />
            <button
              onClick={removeImage}
              style={{
                position: 'absolute', top: '12px', right: '12px',
                background: 'rgba(4,6,14,0.85)', backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '50%', width: '32px', height: '32px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#fff',
              }}
            >
              <X size={14} />
            </button>
            <div style={{
              marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              fontFamily: 'var(--font-mono)',
            }}>
              {imageFileName}
            </div>
          </div>
        ) : (
          <div
            {...getRootProps()}
            style={{
              height: '260px',
              border: `2px dashed ${isDragActive ? '#22D3EE' : 'var(--border)'}`,
              borderRadius: 'var(--radius-md)', cursor: 'pointer',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: '14px',
              background: isDragActive ? 'rgba(34,211,238,0.04)' : 'var(--surface-3)',
              transition: 'all 0.18s ease',
            }}
          >
            <input {...getInputProps()} />
            <div style={{
              width: 56, height: 56, borderRadius: '16px',
              background: isDragActive ? 'rgba(34,211,238,0.12)' : 'var(--surface-2)',
              border: `1px solid ${isDragActive ? 'rgba(34,211,238,0.5)' : 'var(--border)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.18s',
            }}>
              {isDragActive
                ? <Upload size={24} color="#22D3EE" />
                : <ImagePlus size={24} color="var(--text-muted)" />}
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: isDragActive ? '#22D3EE' : 'var(--text-secondary)', marginBottom: '4px' }}>
                {isDragActive ? 'Drop your image here' : 'Drag & drop or click to upload'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                JPEG, PNG, WebP · max 10 MB
              </div>
            </div>
          </div>
        )}
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
            ? 'linear-gradient(135deg, #0891B2 0%, #22D3EE 100%)'
            : 'var(--surface-3)',
          color: canGenerate ? '#fff' : 'var(--text-muted)',
          border: canGenerate ? 'none' : '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          fontSize: '14px', fontWeight: 700,
          cursor: canGenerate ? 'pointer' : 'not-allowed',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px',
          transition: 'all 0.2s ease',
          boxShadow: canGenerate ? '0 4px 20px rgba(34,211,238,0.35), inset 0 1px 0 rgba(255,255,255,0.15)' : 'none',
          letterSpacing: '0.02em',
        }}
        onMouseEnter={(e) => {
          if (canGenerate) {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 24px rgba(34,211,238,0.5), inset 0 1px 0 rgba(255,255,255,0.15)';
          }
        }}
        onMouseLeave={(e) => {
          if (canGenerate) {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 20px rgba(34,211,238,0.35), inset 0 1px 0 rgba(255,255,255,0.15)';
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
            <span style={{ marginLeft: '2px' }}>Generating images...</span>
          </div>
        ) : (
          <>
            <ImageIcon size={17} />
            Generate Image
          </>
        )}
      </button>

      {!imageFile && (
        <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '11px', color: 'var(--text-muted)' }}>
          Upload a base image to enable generation
        </div>
      )}
    </div>
  );
}
