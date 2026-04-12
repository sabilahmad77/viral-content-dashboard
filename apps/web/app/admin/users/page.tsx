'use client';
import { useState } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/lib/hooks/useAuth';
import { usersApi, User } from '@/lib/api';
import { Plus, Edit2, UserX, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface UserFormData {
  name: string;
  email: string;
  password: string;
  role: 'SUPER_ADMIN' | 'USER';
}

function UserPanel({
  user,
  onClose,
  onSaved,
}: {
  user?: User;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { accessToken } = useAuth();
  const [form, setForm] = useState<UserFormData>({
    name: user?.name ?? '',
    email: user?.email ?? '',
    password: '',
    role: user?.role ?? 'USER',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    setError('');
    setSaving(true);
    try {
      if (user) {
        const payload: Record<string, unknown> = { name: form.name, email: form.email, role: form.role };
        if (form.password) payload.password = form.password;
        await usersApi.update(accessToken!, user.id, payload as Parameters<typeof usersApi.update>[2]);
      } else {
        await usersApi.create(accessToken!, { name: form.name, email: form.email, password: form.password, role: form.role });
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      display: 'flex', justifyContent: 'flex-end',
    }}>
      <div onClick={onClose} style={{ flex: 1, background: 'rgba(0,0,0,0.5)' }} />
      <div style={{
        width: '360px', background: 'var(--surface)', borderLeft: '1px solid var(--border)',
        padding: '24px', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600 }}>{user ? 'Edit User' : 'Create User'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={16} />
          </button>
        </div>

        {[
          { label: 'Full Name', key: 'name', type: 'text', placeholder: 'Jane Doe' },
          { label: 'Email', key: 'email', type: 'email', placeholder: 'jane@example.com' },
          { label: user ? 'New Password (leave blank to keep)' : 'Password', key: 'password', type: 'password', placeholder: '••••••••' },
        ].map(({ label, key, type, placeholder }) => (
          <div key={key} style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>{label}</label>
            <input
              type={type}
              value={form[key as keyof UserFormData]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              placeholder={placeholder}
              style={{ width: '100%', height: '38px', padding: '0 12px' }}
            />
          </div>
        ))}

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>Role</label>
          <select
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as 'SUPER_ADMIN' | 'USER' }))}
            style={{ width: '100%', height: '38px', padding: '0 12px' }}
          >
            <option value="USER">User</option>
            <option value="SUPER_ADMIN">Super Admin</option>
          </select>
        </div>

        {error && (
          <div style={{ marginBottom: '16px', padding: '10px', background: 'var(--danger-dim)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 'var(--radius-sm)', color: 'var(--danger)', fontSize: '13px' }}>
            {error}
          </div>
        )}

        <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : user ? 'Save Changes' : 'Create User'}
        </button>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const { accessToken, user: currentUser } = useAuth();
  const [page, setPage] = useState(1);
  const [panel, setPanel] = useState<{ open: boolean; user?: User }>({ open: false });

  const { data, mutate } = useSWR(
    accessToken ? ['users', page] : null,
    () => usersApi.list(accessToken!, page)
  );

  async function handleDeactivate(u: User) {
    if (!confirm(`Deactivate ${u.name}?`)) return;
    await usersApi.deactivate(accessToken!, u.id);
    mutate();
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700 }}>Users</h1>
        <button className="btn btn-primary" onClick={() => setPanel({ open: true })}>
          <Plus size={14} /> Create User
        </button>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Name', 'Email', 'Role', 'Status', 'Last Login', 'Actions'].map((h) => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data?.users ?? []).map((u) => (
              <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>{u.name}</td>
                <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>{u.email}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 600,
                    background: u.role === 'SUPER_ADMIN' ? 'var(--gold-dim)' : 'rgba(71,85,105,0.2)',
                    color: u.role === 'SUPER_ADMIN' ? 'var(--gold)' : 'var(--text-secondary)',
                  }}>
                    {u.role === 'SUPER_ADMIN' ? 'Admin' : 'User'}
                  </span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span className={`badge ${u.isActive ? 'badge-done' : 'badge-failed'}`}>
                    {u.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never'}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      className="btn btn-ghost"
                      style={{ height: '28px', fontSize: '12px', padding: '0 10px' }}
                      onClick={() => setPanel({ open: true, user: u })}
                    >
                      <Edit2 size={12} /> Edit
                    </button>
                    {u.id !== currentUser?.id && u.isActive && (
                      <button
                        className="btn btn-danger"
                        style={{ height: '28px', fontSize: '12px', padding: '0 10px' }}
                        onClick={() => handleDeactivate(u)}
                      >
                        <UserX size={12} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginTop: '20px' }}>
          <button className="btn btn-ghost" style={{ height: '32px' }} onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft size={14} /> Prev
          </button>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Page {data.page} of {data.pages}</span>
          <button className="btn btn-ghost" style={{ height: '32px' }} onClick={() => setPage((p) => Math.min(data.pages, p + 1))} disabled={page === data.pages}>
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}

      {panel.open && (
        <UserPanel
          user={panel.user}
          onClose={() => setPanel({ open: false })}
          onSaved={() => mutate()}
        />
      )}
    </div>
  );
}
