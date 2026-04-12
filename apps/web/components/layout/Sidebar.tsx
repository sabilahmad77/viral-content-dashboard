'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Zap, PlusSquare, Clock, LayoutDashboard, Users,
  FileText, BarChart2, FileCode, LogOut, Image, Dumbbell, Crown, UserCircle2,
} from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';

const navItems = [
  { href: '/dashboard', label: 'Create Content', icon: PlusSquare },
  { href: '/dashboard/create-image', label: 'Create Image', icon: Image },
  { href: '/dashboard/create-gym', label: 'Create Gym Studio', icon: Dumbbell },
  { href: '/dashboard/jobs', label: 'Job History', icon: Clock },
];

const adminItems = [
  { href: '/admin', label: 'Admin Overview', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/templates', label: 'Templates', icon: FileText },
  { href: '/admin/usage', label: 'Usage', icon: BarChart2 },
  { href: '/admin/logs', label: 'System Logs', icon: FileCode },
];

function NavLink({
  href, label, icon: Icon, active, variant,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  active: boolean;
  variant?: 'gold';
}) {
  const isGold = variant === 'gold';
  const activeColor = isGold ? 'var(--gold)' : 'var(--accent-2)';
  const activeDim = isGold ? 'var(--gold-dim)' : 'var(--accent-dim)';
  const activeBorder = isGold ? 'var(--border-gold)' : 'var(--border-accent)';

  return (
    <Link
      href={href}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '9px 12px', marginBottom: '2px',
        borderRadius: 'var(--radius-sm)',
        textDecoration: 'none',
        fontSize: '13px',
        fontWeight: active ? 600 : 400,
        color: active ? activeColor : 'var(--text-secondary)',
        background: active ? activeDim : 'transparent',
        border: active ? `1px solid ${activeBorder}` : '1px solid transparent',
        transition: 'all 0.16s ease',
        letterSpacing: '0.01em',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-primary)';
          (e.currentTarget as HTMLAnchorElement).style.background = 'var(--surface-hover)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-secondary)';
          (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
        }
      }}
    >
      <Icon size={15} />
      {label}
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'SUPER_ADMIN';

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  return (
    <aside style={{
      width: '240px',
      minHeight: '100vh',
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      position: 'fixed', left: 0, top: 0, bottom: 0,
      zIndex: 50,
    }}>
      {/* Logo */}
      <div style={{
        padding: '20px 20px 18px',
        borderBottom: '1px solid var(--border)',
      }}>
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '11px', textDecoration: 'none' }}>
          {/* Icon mark */}
          <div style={{
            width: 34, height: 34,
            background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
            borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(99,102,241,0.5)',
          }}>
            <Zap size={18} color="#fff" fill="#fff" />
          </div>
          {/* Wordmark */}
          <div>
            <div style={{
              fontWeight: 800, fontSize: '15px', letterSpacing: '-0.4px',
              background: 'linear-gradient(135deg, var(--accent-2) 0%, var(--cyan) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              lineHeight: 1.1,
            }}>
              ViralDash
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px', letterSpacing: '0.05em' }}>
              CONTENT PLATFORM
            </div>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav style={{ padding: '14px 10px', flex: 1, overflowY: 'auto' }}>
        {/* Content Tools section */}
        <div style={{
          padding: '4px 12px 8px',
          fontSize: '10px', fontWeight: 700,
          color: 'var(--text-muted)', letterSpacing: '0.09em',
          textTransform: 'uppercase',
        }}>
          Content Tools
        </div>

        <div style={{ marginBottom: '8px' }}>
          {navItems.map((item) => {
            const active = pathname === item.href
              || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} active={active} />
            );
          })}
        </div>

        {/* Admin section */}
        {isAdmin && (
          <>
            <div style={{
              padding: '10px 12px 8px',
              fontSize: '10px', fontWeight: 700,
              color: 'var(--text-muted)', letterSpacing: '0.09em',
              textTransform: 'uppercase',
            }}>
              Admin
            </div>
            {adminItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} active={active} variant="gold" />
              );
            })}
          </>
        )}
      </nav>

      {/* User footer */}
      <div style={{ padding: '14px 12px', borderTop: '1px solid var(--border)' }}>
        {/* User row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          {/* Avatar */}
          <div style={{
            width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
            background: isAdmin
              ? 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(251,191,36,0.1))'
              : 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(34,211,238,0.1))',
            border: `1.5px solid ${isAdmin ? 'rgba(245,158,11,0.5)' : 'rgba(99,102,241,0.5)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '13px', fontWeight: 700,
            color: isAdmin ? 'var(--gold)' : 'var(--accent-2)',
            boxShadow: isAdmin ? 'var(--shadow-gold)' : 'var(--shadow-accent)',
          }}>
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div style={{
              fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {user?.name}
            </div>
            <div style={{
              fontSize: '11px', color: 'var(--text-muted)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {user?.email}
            </div>
          </div>
        </div>

        {/* Role badge */}
        <div style={{ marginBottom: '10px' }}>
          {isAdmin ? (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '4px 10px', borderRadius: '999px',
              background: 'var(--gold-dim)',
              border: '1px solid var(--border-gold)',
              fontSize: '11px', fontWeight: 700, color: 'var(--gold)',
              letterSpacing: '0.04em',
            }}>
              <Crown size={10} />
              Super Admin
            </div>
          ) : (
            <div className="user-role-badge" style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '4px 10px', borderRadius: '999px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)',
            }}>
              <UserCircle2 size={10} />
              User
            </div>
          )}
        </div>

        {/* Sign out */}
        <button
          onClick={handleLogout}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
            padding: '7px 10px', background: 'none', border: 'none',
            color: 'var(--text-muted)', cursor: 'pointer',
            borderRadius: 'var(--radius-sm)',
            fontSize: '12px', fontWeight: 500, transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--danger)';
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--danger-dim)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
            (e.currentTarget as HTMLButtonElement).style.background = 'none';
          }}
        >
          <LogOut size={13} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
