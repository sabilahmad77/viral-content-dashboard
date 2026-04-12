'use client';
import { Dumbbell } from 'lucide-react';

export default function CreateGymPage() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', textAlign: 'center', gap: '20px',
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: '20px',
        background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.15) 100%)',
        border: '1px solid rgba(139,92,246,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Dumbbell size={32} color="var(--accent-2)" />
      </div>
      <div>
        <h1 style={{
          fontSize: '24px', fontWeight: 800, letterSpacing: '-0.5px',
          color: 'var(--text-primary)', marginBottom: '8px',
        }}>
          Create Gym Studio
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', maxWidth: '380px', lineHeight: '1.6' }}>
          Gym content generation is coming soon. This section will let you create fitness-focused captions, images, and content tailored for gym and wellness audiences.
        </p>
      </div>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: '6px 16px', borderRadius: '999px',
        background: 'var(--accent-dim)', border: '1px solid var(--border-accent)',
        fontSize: '12px', fontWeight: 600, color: 'var(--accent-2)',
      }}>
        Coming Soon
      </div>
    </div>
  );
}
