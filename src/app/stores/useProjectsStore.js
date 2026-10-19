import { create } from "zustand";
import { pingWorkspaceChange } from "@/db/supabase-browser";

// Client source of truth for workspace projects: named spans of time drawn as
// bars across the top of the timeline. Mirrors useEventsStore: fetched from
// /api/projects (scoped to the active workspace by cookie) and cached here.
export const useProjectsStore = create((set, get) => ({
  // *** VARIABLES ***
  projects: [],
  loaded: false,
  loading: false,
  error: null,

  // *** FUNCTIONS/HANDLERS ***
  // Pass { silent: true } for background revalidation: updates data in place
  // without flipping `loading`, and keeps the cache on a failed background fetch.
  fetchProjects: async ({ silent = false } = {}) => {
    if (!silent) set({ loading: true, error: null });
    try {
      const response = await fetch("/api/projects");
      if (!response.ok) {
        throw new Error("Failed to fetch projects");
      }
      const data = await response.json();
      set({ projects: data.items || [], loaded: true, loading: false });
    } catch (error) {
      if (silent) return;
      set({ error: error.message, loading: false });
    }
  },

  // Spinner only on the first ever load; afterwards revalidate silently.
  ensureProjects: () => {
    if (get().loaded) {
      return get().fetchProjects({ silent: true });
    }
    return get().fetchProjects();
  },

  // Clear the cache when switching workspace (projects are scoped per workspace).
  resetProjects: () =>
    set({ projects: [], loaded: false, loading: false, error: null }),

  addProject: async (project) => {
    set({ error: null });
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(project),
      });
      if (!response.ok) {
        throw new Error("Failed to create project");
      }
      const data = await response.json();
      set((state) => ({ projects: [data.item, ...state.projects] }));
      pingWorkspaceChange();
      return data.item;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  updateProject: async (id, updates) => {
    set({ error: null });
    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        throw new Error("Failed to update project");
      }
      const data = await response.json();
      set((state) => ({
        projects: state.projects.map((project) =>
          project.id === id ? data.item : project,
        ),
      }));
      pingWorkspaceChange();
      return data.item;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  deleteProject: async (id) => {
    set({ error: null });
    try {
      const response = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error("Failed to delete project");
      }
      set((state) => ({
        projects: state.projects.filter((project) => project.id !== id),
      }));
      pingWorkspaceChange();
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },
}));
