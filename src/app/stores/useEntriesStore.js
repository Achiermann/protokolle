import { create } from 'zustand';

export const useEntriesStore = create((set, get) => ({
  // *** VARIABLES ***
  entries: [],
  loaded: false, // whether entries have been fetched at least once this session
  loading: false, // true only during the very first (foreground) load
  error: null,

  // *** FUNCTIONS/HANDLERS ***
  // Fetch entries from the API. Pass { silent: true } for background
  // revalidation (polling / focus / cache hits): it updates the data in place
  // without flipping `loading`, so the list never flickers, and a failed
  // background fetch keeps the cached data on screen.
  fetchEntries: async ({ silent = false } = {}) => {
    if (!silent) set({ loading: true, error: null });
    try {
      const response = await fetch('/api/entries');
      if (!response.ok) {
        throw new Error('Failed to fetch entries');
      }
      const data = await response.json();
      set({ entries: data.items || [], loaded: true, loading: false });
    } catch (error) {
      if (silent) return; // keep the cached entries visible on a background failure
      set({ error: error.message, loading: false });
    }
  },

  // Called by views on mount. Shows the spinner only on the first ever load;
  // afterwards it returns the cached entries instantly and revalidates silently.
  ensureEntries: () => {
    if (get().loaded) {
      return get().fetchEntries({ silent: true });
    }
    return get().fetchEntries();
  },

  // Clear the cache so the next view forces a fresh foreground load.
  // Used when switching workspace (entries are scoped per workspace).
  resetEntries: () => set({ entries: [], loaded: false, loading: false, error: null }),

  addEntry: async (entry) => {
    set({ error: null });
    try {
      const response = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
      if (!response.ok) {
        throw new Error('Failed to create entry');
      }
      const data = await response.json();
      set((state) => ({
        entries: [...state.entries, data.item],
      }));
      return data.item;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  updateEntry: async (id, updates) => {
    set({ error: null });
    try {
      const response = await fetch(`/api/entries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        throw new Error('Failed to update entry');
      }
      const data = await response.json();
      set((state) => ({
        entries: state.entries.map((entry) =>
          entry.id === id ? data.item : entry
        ),
      }));
      return data.item;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  deleteEntry: async (id) => {
    set({ error: null });
    try {
      const response = await fetch(`/api/entries/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete entry');
      }
      set((state) => ({
        entries: state.entries.filter((entry) => entry.id !== id),
      }));
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },
}));
