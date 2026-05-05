import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  // *** VARIABLES ***
  user: null,
  workspace: null,
  role: null,
  loading: true,

  // *** FUNCTIONS/HANDLERS ***
  fetchSession: async () => {
    set({ loading: true });
    try {
      const response = await fetch('/api/auth/session');
      if (!response.ok) throw new Error('Session fetch failed');
      const data = await response.json();
      set({
        user: data.user,
        workspace: data.workspace,
        role: data.role,
        loading: false,
      });
    } catch (error) {
      set({ user: null, workspace: null, role: null, loading: false });
    }
  },

  logout: async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      set({ user: null, workspace: null, role: null });
      window.location.href = '/login';
    } catch (error) {
      // Force redirect even on error
      window.location.href = '/login';
    }
  },

  setWorkspace: (workspace) => set({ workspace }),

  setUserName: (name) =>
    set((state) => ({ user: state.user ? { ...state.user, name } : state.user })),
}));
