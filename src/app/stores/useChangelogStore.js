import { create } from "zustand";
import { pingWorkspaceChange } from "@/db/supabase-browser";

// Client source of truth for the changelog: Vorgänge (named strands of work
// under an optional Thema), their logs and the comments on those logs. Mirrors useProjectsStore: fetched
// from /api/changelog (scoped to the active workspace by cookie) and cached.
export const useChangelogStore = create((set, get) => ({
  // *** VARIABLES ***
  vorgaenge: [],
  logs: [],
  comments: [],
  loaded: false,
  loading: false,
  error: null,

  // *** FUNCTIONS/HANDLERS ***
  // Pass { silent: true } for background revalidation: updates data in place
  // without flipping `loading`, and keeps the cache on a failed background fetch.
  fetchChangelog: async ({ silent = false } = {}) => {
    if (!silent) set({ loading: true, error: null });
    try {
      const response = await fetch("/api/changelog");
      if (!response.ok) {
        throw new Error("Failed to fetch changelog");
      }
      const data = await response.json();
      set({
        vorgaenge: data.vorgaenge || [],
        logs: data.logs || [],
        comments: data.comments || [],
        loaded: true,
        loading: false,
      });
    } catch (error) {
      if (silent) return;
      set({ error: error.message, loading: false });
    }
  },

  // Spinner only on the first ever load; afterwards revalidate silently.
  ensureChangelog: () => {
    if (get().loaded) {
      return get().fetchChangelog({ silent: true });
    }
    return get().fetchChangelog();
  },

  // `log` carries `change`, `log_date` and either `vorgang_id` or
  // `new_vorgang: { name, topic }`; a Vorgang created on the way is cached too.
  addLog: async (log) => {
    set({ error: null });
    try {
      const response = await fetch("/api/changelog/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(log),
      });
      if (!response.ok) {
        throw new Error("Failed to create log");
      }
      const data = await response.json();
      set((state) => ({
        logs: [data.item, ...state.logs],
        vorgaenge: data.vorgang
          ? [...state.vorgaenge, data.vorgang]
          : state.vorgaenge,
      }));
      pingWorkspaceChange();
      return data.item;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  updateLog: async (id, updates) => {
    set({ error: null });
    try {
      const response = await fetch(`/api/changelog/logs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        throw new Error("Failed to update log");
      }
      const data = await response.json();
      set((state) => ({
        logs: state.logs.map((log) => (log.id === id ? data.item : log)),
        vorgaenge: data.vorgang
          ? [...state.vorgaenge, data.vorgang]
          : state.vorgaenge,
      }));
      pingWorkspaceChange();
      return data.item;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  deleteLog: async (id) => {
    set({ error: null });
    try {
      const response = await fetch(`/api/changelog/logs/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete log");
      }
      set((state) => ({
        logs: state.logs.filter((log) => log.id !== id),
        comments: state.comments.filter((comment) => comment.log_id !== id),
      }));
      pingWorkspaceChange();
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  updateVorgang: async (id, updates) => {
    set({ error: null });
    try {
      const response = await fetch(`/api/changelog/vorgaenge/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        throw new Error("Failed to update Vorgang");
      }
      const data = await response.json();
      set((state) => ({
        vorgaenge: state.vorgaenge.map((vorgang) =>
          vorgang.id === id ? data.item : vorgang,
        ),
      }));
      pingWorkspaceChange();
      return data.item;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  // Deleting a Vorgang removes its logs and their comments too (cascade in
  // the DB).
  deleteVorgang: async (id) => {
    set({ error: null });
    try {
      const response = await fetch(`/api/changelog/vorgaenge/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete Vorgang");
      }
      set((state) => {
        const removedLogIds = new Set(
          state.logs.filter((log) => log.vorgang_id === id).map((l) => l.id),
        );
        return {
          vorgaenge: state.vorgaenge.filter((vorgang) => vorgang.id !== id),
          logs: state.logs.filter((log) => !removedLogIds.has(log.id)),
          comments: state.comments.filter(
            (comment) => !removedLogIds.has(comment.log_id),
          ),
        };
      });
      pingWorkspaceChange();
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  addComment: async (logId, body) => {
    set({ error: null });
    try {
      const response = await fetch("/api/changelog/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ log_id: logId, body }),
      });
      if (!response.ok) {
        throw new Error("Failed to create comment");
      }
      const data = await response.json();
      set((state) => ({ comments: [...state.comments, data.item] }));
      pingWorkspaceChange();
      return data.item;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  // Only the author's own comments can be changed (enforced server-side).
  updateComment: async (id, body) => {
    set({ error: null });
    try {
      const response = await fetch(`/api/changelog/comments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!response.ok) {
        throw new Error("Failed to update comment");
      }
      const data = await response.json();
      set((state) => ({
        comments: state.comments.map((comment) =>
          comment.id === id ? data.item : comment,
        ),
      }));
      pingWorkspaceChange();
      return data.item;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  deleteComment: async (id) => {
    set({ error: null });
    try {
      const response = await fetch(`/api/changelog/comments/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete comment");
      }
      set((state) => ({
        comments: state.comments.filter((comment) => comment.id !== id),
      }));
      pingWorkspaceChange();
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },
}));
