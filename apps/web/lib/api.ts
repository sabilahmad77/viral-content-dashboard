// Use relative URLs so requests go through the Next.js proxy route (app/api/[...path]).
// The proxy forwards to the backend using the server-side API_URL env var.
// This means the backend URL never gets baked into the JS bundle.
const API_URL = '';

interface RequestOptions extends RequestInit {
  token?: string;
  _retry?: boolean;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, _retry, ...init } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    // Bypass localtunnel reminder page for tunnel-hosted backends
    'bypass-tunnel-reminder': '1',
    ...(init.headers as Record<string, string>),
  };

  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Unknown error' }));

    // Auto-refresh on 401 (expired token), then retry once
    if (res.status === 401 && !_retry) {
      try {
        // Dynamically import to avoid circular dependency
        const { useAuth } = await import('./hooks/useAuth');
        const newToken = await useAuth.getState().refreshAccess();
        if (newToken) {
          return request<T>(path, { ...options, token: newToken, _retry: true });
        }
        // Refresh failed — redirect to login
        if (typeof window !== 'undefined') window.location.href = '/login';
      } catch {
        if (typeof window !== 'undefined') window.location.href = '/login';
      }
    }

    throw new ApiError(body.error || `HTTP ${res.status}`, res.status);
  }

  return res.json();
}

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    request<{ accessToken: string; refreshToken: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  refresh: (refreshToken: string) =>
    request<{ accessToken: string; refreshToken: string }>('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),
  logout: (token: string, refreshToken: string) =>
    request('/api/auth/logout', {
      method: 'POST',
      token,
      body: JSON.stringify({ refreshToken }),
    }),
  me: (token: string) => request<User>('/api/auth/me', { token }),
};

// Jobs
export const jobsApi = {
  create: async (token: string, formData: FormData): Promise<{ jobId: string; slotCount: number; estimatedSeconds: number }> => {
    const doFetch = async (t: string) =>
      fetch(`${API_URL}/api/jobs`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}` },
        body: formData,
      });

    let res = await doFetch(token);

    // Auto-refresh on 401 then retry once
    if (res.status === 401) {
      const { useAuth } = await import('./hooks/useAuth');
      const newToken = await useAuth.getState().refreshAccess();
      if (newToken) {
        res = await doFetch(newToken);
      } else {
        if (typeof window !== 'undefined') window.location.href = '/login';
        throw new ApiError('Session expired', 401);
      }
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new ApiError(body.error || `HTTP ${res.status}`, res.status);
    }
    return res.json();
  },
  list: (token: string, page = 1) =>
    request<JobListResponse>(`/api/jobs?page=${page}`, { token }),
  get: (token: string, id: string) => request<Job>(`/api/jobs/${id}`, { token }),
  status: (token: string, id: string) => request<JobStatus>(`/api/jobs/${id}/status`, { token }),
};

// Outputs
export const outputsApi = {
  regen: (token: string, jobId: string, slotId: string) =>
    request(`/api/jobs/${jobId}/slots/${slotId}/regen`, { method: 'POST', token }),
  download: (token: string, slotId: string) =>
    request<{ url: string; expiresIn: number }>(`/api/outputs/${slotId}/download`, { token }),
};

// Templates
export const templatesApi = {
  list: (token: string) => request<PromptTemplate[]>('/api/templates', { token }),
  get: (token: string, id: string) => request<PromptTemplate>(`/api/templates/${id}`, { token }),
  create: (token: string, data: Partial<PromptTemplate>) =>
    request<PromptTemplate>('/api/templates', { method: 'POST', token, body: JSON.stringify(data) }),
  update: (token: string, id: string, data: Record<string, unknown>) =>
    request<PromptTemplate>(`/api/templates/${id}`, { method: 'PUT', token, body: JSON.stringify(data) }),
  activate: (token: string, id: string) =>
    request(`/api/templates/${id}/activate`, { method: 'POST', token }),
  preview: (token: string, id: string, newsInput: string) =>
    request<{ renderedSlots: unknown[] }>(`/api/templates/${id}/preview`, {
      method: 'POST', token, body: JSON.stringify({ newsInput }),
    }),
  delete: (token: string, id: string) =>
    request(`/api/templates/${id}`, { method: 'DELETE', token }),
};

// Users
export const usersApi = {
  list: (token: string, page = 1) =>
    request<UserListResponse>(`/api/users?page=${page}`, { token }),
  create: (token: string, data: { email: string; password: string; name: string; role: string }) =>
    request<User>('/api/users', { method: 'POST', token, body: JSON.stringify(data) }),
  update: (token: string, id: string, data: Partial<User & { password: string }>) =>
    request<User>(`/api/users/${id}`, { method: 'PUT', token, body: JSON.stringify(data) }),
  deactivate: (token: string, id: string) =>
    request(`/api/users/${id}/deactivate`, { method: 'PATCH', token }),
};

// Videos
export const videosApi = {
  generate: (
    token: string,
    data: { mode: 'prompt' | 'config'; prompt?: string; topic?: string; config?: Record<string, unknown> }
  ) =>
    request<{ jobId: string; estimatedSeconds: number }>('/api/videos/generate', {
      method: 'POST',
      token,
      body: JSON.stringify(data),
    }),
};

// Admin
export const adminApi = {
  usage: (token: string) => request<UsageData>('/api/admin/usage', { token }),
  logs: (token: string) => request<Job[]>('/api/admin/logs', { token }),
  jobs: (token: string, page = 1) =>
    request<JobListResponse>(`/api/admin/jobs?page=${page}`, { token }),
};

// Types
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'USER';
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
}

export interface OutputSlot {
  id: string;
  jobId: string;
  slotType: 'caption' | 'image' | 'video';
  slotIndex: number;
  status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
  outputText?: string;
  outputUrl?: string;
  promptSnapshot: Record<string, unknown>;
  modelUsed?: string;
  regenCount: number;
  regenHistory: unknown[];
  createdAt: string;
  updatedAt: string;
}

export interface Job {
  id: string;
  userId: string;
  templateId: string;
  templateVersion: number;
  newsInput: string;
  baseImageUrl?: string;
  status: 'QUEUED' | 'PROCESSING' | 'DONE' | 'FAILED';
  createdAt: string;
  completedAt?: string;
  errorMsg?: string;
  user?: { id: string; name: string; email: string };
  template?: { id: string; name: string; version: number };
  outputSlots: OutputSlot[];
}

export interface JobStatus {
  id: string;
  status: 'QUEUED' | 'PROCESSING' | 'DONE' | 'FAILED';
  outputSlots: Array<{ id: string; slotType: string; slotIndex: number; status: string }>;
}

export interface JobListResponse {
  jobs: Job[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface UserListResponse {
  users: User[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface PromptTemplate {
  id: string;
  name: string;
  slug: string;
  version: number;
  isActive: boolean;
  slots: unknown[];
  // TXT instruction fields — primary source of truth for generation
  contentInstructions: string;
  imageInstructions: string;
  videoInstructions: string;
  // Legacy JSON fields (kept for backward compatibility)
  captionPromptJson: Record<string, unknown>;
  imagePromptJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface UsageData {
  todayJobs: number;
  totalApiCalls: number;
  estimatedCost: number;
  errorRate: number;
  activeUsers: number;
  slotsByModel: Array<{ modelUsed: string | null; _count: { _all: number } }>;
  period: { start: string; end: string };
}
