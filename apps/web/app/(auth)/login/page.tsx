'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Zap, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: unknown) {
      setError((err as Error).message || 'Invalid credentials');
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Background ambient glows */}
      <div style={{
        position: 'absolute', top: '20%', left: '30%',
        width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '15%', right: '25%',
        width: 350, height: 350, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(34,211,238,0.05) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: '420px', padding: '0 20px', position: 'relative', zIndex: 1 }}>
        {/* Logo mark */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '13px',
            marginBottom: '12px',
          }}>
            <div style={{
              width: 46, height: 46,
              background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
              borderRadius: '14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(99,102,241,0.5)',
            }}>
              <Zap size={24} color="#fff" fill="#fff" />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{
                fontSize: '20px', fontWeight: 800, letterSpacing: '-0.5px',
                background: 'linear-gradient(135deg, var(--accent-2) 0%, var(--cyan) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                lineHeight: 1.1,
              }}>
                ViralDash
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.06em', marginTop: '2px' }}>
                CONTENT PLATFORM
              </div>
            </div>
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            Sign in to your workspace
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: 'linear-gradient(160deg, var(--surface-2) 0%, var(--surface-3) 100%)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '40px',
          boxShadow: 'var(--shadow-lg)',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Top glow line */}
          <div style={{
            position: 'absolute', top: 0, left: '20%', right: '20%',
            height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.5), transparent)',
          }} />

          <h1 style={{
            fontSize: '16px', fontWeight: 700, marginBottom: '26px',
            color: 'var(--text-primary)', letterSpacing: '-0.2px',
          }}>
            Welcome back
          </h1>

          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{
                display: 'block', marginBottom: '7px',
                fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)',
                letterSpacing: '0.04em', textTransform: 'uppercase',
              }}>
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
                style={{
                  width: '100%', height: '44px', padding: '0 14px',
                  fontSize: '14px',
                }}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: '28px' }}>
              <label style={{
                display: 'block', marginBottom: '7px',
                fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)',
                letterSpacing: '0.04em', textTransform: 'uppercase',
              }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  style={{
                    width: '100%', height: '44px', padding: '0 44px 0 14px',
                    fontSize: '14px',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: '13px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', padding: '4px',
                    display: 'flex', alignItems: 'center',
                    transition: 'color 0.15s',
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%', height: '46px',
                background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                color: '#fff', border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontSize: '14px', fontWeight: 700, cursor: isLoading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                boxShadow: isLoading ? 'none' : '0 4px 16px rgba(99,102,241,0.45)',
                opacity: isLoading ? 0.7 : 1,
                transition: 'all 0.2s ease',
                letterSpacing: '0.02em',
              }}
            >
              {isLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {[0, 0.18, 0.36].map((delay, i) => (
                    <span key={i} className="pulse" style={{
                      display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
                      background: '#fff', animationDelay: `${delay}s`,
                    }} />
                  ))}
                </div>
              ) : (
                <>
                  <Sparkles size={16} />
                  Sign In
                </>
              )}
            </button>

            {error && (
              <div style={{
                marginTop: '14px', padding: '11px 14px',
                background: 'var(--danger-dim)', border: '1px solid rgba(244,63,94,0.3)',
                borderRadius: 'var(--radius-sm)', color: 'var(--danger)', fontSize: '13px',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <span>⚠</span> {error}
              </div>
            )}
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '22px', color: 'var(--text-muted)', fontSize: '12px' }}>
          Invite-only platform · Contact your administrator
        </p>
      </div>
    </div>
  );
}
