'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import { useAuth } from '@/lib/hooks/useAuth';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, accessToken } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user || !accessToken) {
      router.push('/login');
    }
  }, [user, accessToken, router]);

  if (!user || !accessToken) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar />
      <main style={{
        marginLeft: '240px',
        flex: 1,
        padding: '32px 36px',
        minHeight: '100vh',
        overflowY: 'auto',
        maxWidth: 'calc(100vw - 240px)',
      }}>
        {children}
      </main>
    </div>
  );
}
