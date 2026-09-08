import { create } from "zustand";
import { pingWorkspaceChange } from "@/db/supabase-browser";

// Client source of truth for workspace events ("Ziele"): scheduled goals that
// belong to the workspace as a whole, not to a member or an entry. Mirrors
// useTodosStore: fetched from /api/events (scoped to the active workspace by
// cookie) and cached here; shown on the timeline.
export const useEventsStore = create((set, get) => ({
  // *** VARIABLES ***
  events: [],
  loaded: false,
  loading: false,
  error: null,

  // *** FUNCTIONS/HANDLERS ***
  // Pass { silent: true } for background revalidation: updates data in place
  // without flipping `loading`, and keeps the cache on a failed background fetch.
  fetchEvents: async ({ silent = false } = {}) => {
    if (!silent) set({ loading: true, error: null });
    try {
      const response = await fetch("/api/events");
      if (!response.ok) {
        throw new Error("Failed to fetch events");
      }
      const data = await response.json();
      set({ events: data.items || [], loaded: true, loading: false });
    } catch (error) {
      if (silent) return;
      set({ error: error.message, loading: false });
    }
  },

  // Spinner only on the first ever load; afterwards revalidate silently.
  ensureEvents: () => {
    if (get().loaded) {
      return get().fetchEvents({ silent: true });
    }
    return get().fetchEvents();
  },

  // Clear the cache when switching workspace (events are scoped per workspace).
  resetEvents: () =>
    set({ events: [], loaded: false, loading: false, error: null }),

  addEvent: async (event) => {
    set({ error: null });
    try {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
      });
      if (!response.ok) {
        throw new Error("Failed to create event");
      }
      const data = await response.json();
      set((state) => ({ events: [data.item, ...state.events] }));
      pingWorkspaceChange();
      return data.item;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  updateEvent: async (id, updates) => {
    set({ error: null });
    try {
      const response = await fetch(`/api/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        throw new Error("Failed to update event");
      }
      const data = await response.json();
      set((state) => ({
        events: state.events.map((event) =>
          event.id === id ? data.item : event,
        ),
      }));
      pingWorkspaceChange();
      return data.item;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  deleteEvent: async (id) => {
    set({ error: null });
    try {
      const response = await fetch(`/api/events/${id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error("Failed to delete event");
      }
      set((state) => ({
        events: state.events.filter((event) => event.id !== id),
      }));
      pingWorkspaceChange();
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },
}));
