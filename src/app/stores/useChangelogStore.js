import { create } from "zustand";
import { pingWorkspaceChange } from "@/db/supabase-browser";

// Comments the user hasn't seen yet: written by someone else, after the
// user's `seenSince` baseline, and not in `seenIds`.
export const getUnseen = (state, userId) => {
  if (!userId || !state.seenSince) return [];
  const since = Date.parse(state.seenSince);
  return state.comments.filter(
    (comment) =>
      comment.created_by !== userId &&
      Date.parse(comment.created_at) > since &&
      !state.seenIds.has(comment.id),
  );
};

// Client source of truth for the changelog: Vorgänge (named strands of work
// under an optional Thema) and the comments on them. Mirrors
// useProjectsStore: fetched from /api/changelog (scoped to the active
// workspace by cookie) and cached here.
export const useChangelogStore = create((set, get) => ({
  // *** VARIABLES ***
  vorgaenge: [],
  comments: [],
  // Per-user seen state (see getUnseen).
  seenSince: null,
  seenIds: new Set(),
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
      // Union with local ids so a markSeen still in flight doesn't flicker.
      set((state) => ({
        vorgaenge: data.vorgaenge || [],
        comments: data.comments || [],
        seenSince: data.seen?.since ?? null,
        seenIds: new Set([...state.seenIds, ...(data.seen?.ids || [])]),
        loaded: true,
        loading: false,
      }));
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

  // `vorgang` carries `name`, `topic` and an optional first `comment`.
  addVorgang: async (vorgang) => {
    set({ error: null });
    try {
      const response = await fetch("/api/changelog/vorgaenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vorgang),
      });
      if (!response.ok) {
        throw new Error("Failed to create Vorgang");
      }
      const data = await response.json();
      set((state) => ({
        vorgaenge: [...state.vorgaenge, data.item],
        comments: data.comment
          ? [...state.comments, data.comment]
          : state.comments,
      }));
      pingWorkspaceChange();
      return data.item;
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

  // Deleting a Vorgang removes its comments too (cascade in the DB).
  deleteVorgang: async (id) => {
    set({ error: null });
    try {
      const response = await fetch(`/api/changelog/vorgaenge/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete Vorgang");
      }
      set((state) => ({
        vorgaenge: state.vorgaenge.filter((vorgang) => vorgang.id !== id),
        comments: state.comments.filter((comment) => comment.vorgang_id !== id),
      }));
      pingWorkspaceChange();
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  // `comment` carries `body` and either `vorgang_id` or
  // `new_vorgang: { name, topic }`; a Vorgang created on the way is cached too.
  addComment: async (comment) => {
    set({ error: null });
    try {
      const response = await fetch("/api/changelog/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(comment),
      });
      if (!response.ok) {
        throw new Error("Failed to create comment");
      }
      const data = await response.json();
      set((state) => ({
        comments: [...state.comments, data.item],
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

  // Optimistic: the ids count as seen locally right away. Personal state, so
  // no workspace ping.
  markSeen: async (ids) => {
    const fresh = ids.filter((id) => !get().seenIds.has(id));
    if (fresh.length === 0) return;
    set((state) => ({ seenIds: new Set([...state.seenIds, ...fresh]) }));
    try {
      const response = await fetch("/api/changelog/seen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: fresh }),
      });
      if (!response.ok) {
        throw new Error("Failed to mark as seen");
      }
    } catch (error) {
      set({ error: error.message });
    }
  },
}));
