import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  // *** VARIABLES ***
  user: null,
  workspace: null,
  loading: true,

  // *** FUNCTIONS/HANDLERS ***
  fetchSession: async () => {
    set({ loading: true });
    try {
      const response = await fetch('/api/auth/session');
      if (!response.ok) throw new Error('Session fetch failed');
      const data = await response.json();
      set({ user: data.user, workspace: data.workspace, loading: false });
    } catch (error) {
      set({ user: null, workspace: null, loading: false });
    }
  },

  logout: async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      set({ user: null, workspace: null });
      window.location.href = '/login';
    } catch (error) {
      // Force redirect even on error
      window.location.href = '/login';
    }
  },

  setWorkspace: (workspace) => set({ workspace }),
}));
