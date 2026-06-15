import { create } from "zustand";

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
      const response = await fetch("/api/auth/session");
      if (!response.ok) throw new Error("Session fetch failed");
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
      await fetch("/api/auth/logout", { method: "POST" });
      set({ user: null, workspace: null, role: null });
      window.location.href = "/login";
    } catch (error) {
      // Force redirect even on error
      window.location.href = "/login";
    }
  },

  setWorkspace: (workspace) => set({ workspace }),

  setUserName: (name) =>
    set((state) => ({
      user: state.user ? { ...state.user, name } : state.user,
    })),

  signup: async ({ email, password, name }) => {
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || "Registrierung fehlgeschlagen");
    }
    return data;
  },

  login: async ({ email, password }) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error?.message || "Anmeldung fehlgeschlagen");
    }
    return true;
  },

  requestPasswordReset: async (email) => {
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error?.message || "Passwort-Reset fehlgeschlagen");
    }
    return true;
  },

  verifyOtp: async ({ email, token, type }) => {
    const response = await fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, token, type }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || "Code-Überprüfung fehlgeschlagen");
    }
    return data;
  },

  updatePassword: async (password) => {
    const response = await fetch("/api/auth/update-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error?.message || "Passwort-Update fehlgeschlagen");
    }
    return true;
  },

  updateProfile: async (name) => {
    const response = await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || "Aktualisierung fehlgeschlagen");
    }
    set((state) => ({
      user: state.user ? { ...state.user, name: data.name } : state.user,
    }));
    return data;
  },
}));
