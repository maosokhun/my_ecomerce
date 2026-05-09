import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types';
import { authApi } from '@/lib/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAuthChecked: boolean;

  login: (identifier: string, password: string) => Promise<void>;
  loginWithFacebook: (accessToken: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  register: (name: string, email: string | undefined, phone: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
  fetchUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,
      isAuthChecked: false,

      login: async (identifier, password) => {
        set({ isLoading: true });
        try {
          const { data } = await authApi.login({ identifier, password });
          const { user, token } = data.data;
          localStorage.setItem('token', token);
          set({ user, token, isAuthenticated: true, isLoading: false, isAuthChecked: true });
          try {
            const me = await authApi.getMe();
            if (me.data?.data) set({ user: me.data.data });
          } catch {
            /* keep login payload */
          }
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      loginWithFacebook: async (accessToken) => {
        set({ isLoading: true });
        try {
          const { data } = await authApi.facebookLogin(accessToken);
          const { user, token } = data.data;
          localStorage.setItem('token', token);
          set({ user, token, isAuthenticated: true, isLoading: false, isAuthChecked: true });
          try {
            const me = await authApi.getMe();
            if (me.data?.data) set({ user: me.data.data });
          } catch {
            /* keep login payload */
          }
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      loginWithGoogle: async (credential) => {
        set({ isLoading: true });
        try {
          const { data } = await authApi.googleLogin(credential);
          const { user, token } = data.data;
          localStorage.setItem('token', token);
          set({ user, token, isAuthenticated: true, isLoading: false, isAuthChecked: true });
          try {
            const me = await authApi.getMe();
            if (me.data?.data) set({ user: me.data.data });
          } catch {
            /* keep login payload */
          }
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      register: async (name, email, phone, password) => {
        set({ isLoading: true });
        try {
          const { data } = await authApi.register({ name, email, phone, password });
          const { user, token } = data.data;
          localStorage.setItem('token', token);
          set({ user, token, isAuthenticated: true, isLoading: false, isAuthChecked: true });
          try {
            const me = await authApi.getMe();
            if (me.data?.data) set({ user: me.data.data });
          } catch {
            /* keep register payload */
          }
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: () => {
        localStorage.removeItem('token');
        set({ user: null, token: null, isAuthenticated: false, isAuthChecked: true });
      },

      updateUser: (userData) => {
        const current = get().user;
        if (current) {
          set({ user: { ...current, ...userData } });
        }
      },

      fetchUser: async () => {
        const token = localStorage.getItem('token');
        if (!token) {
          set({ isAuthenticated: false, isAuthChecked: true });
          return;
        }
        try {
          const { data } = await authApi.getMe();
          set({ user: data.data, token, isAuthenticated: true, isAuthChecked: true });
        } catch (error: unknown) {
          const status = (error as { response?: { status?: number } })?.response?.status;
          if (status === 401) {
            localStorage.removeItem('token');
            set({ user: null, token: null, isAuthenticated: false, isAuthChecked: true });
            return;
          }
          // Keep current auth state on transient/network failures
          // so users are not kicked out unexpectedly.
          set({ isAuthChecked: true });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Once rehydrated, even if empty, we consider initial hydration done.
          useAuthStore.setState({ isAuthChecked: true });
        }
      },
    }
  )
);
