'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi, User } from '../api';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccess: () => Promise<string | null>;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const data = await authApi.login(email, password);
          set({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken });
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async () => {
        const { accessToken, refreshToken } = get();
        if (accessToken && refreshToken) {
          await authApi.logout(accessToken, refreshToken).catch(() => {});
        }
        set({ user: null, accessToken: null, refreshToken: null });
      },

      refreshAccess: async () => {
        const { refreshToken } = get();
        if (!refreshToken) return null;
        try {
          const data = await authApi.refresh(refreshToken);
          set({ accessToken: data.accessToken, refreshToken: data.refreshToken });
          return data.accessToken;
        } catch {
          set({ user: null, accessToken: null, refreshToken: null });
          return null;
        }
      },
    }),
    {
      name: 'vcd-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
);
