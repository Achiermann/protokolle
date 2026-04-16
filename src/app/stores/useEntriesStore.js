import { create } from 'zustand';

export const useEntriesStore = create((set, get) => ({
  // *** VARIABLES ***
  entries: [],
  loading: false,
  error: null,

  // *** FUNCTIONS/HANDLERS ***
  fetchEntries: async () => {
    set({ loading: true, error: null });
    try {
      const response = await fetch('/api/entries');
      if (!response.ok) {
        throw new Error('Failed to fetch entries');
      }
      const data = await response.json();
      set({ entries: data.items || [], loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  addEntry: async (entry) => {
    set({ loading: true, error: null });
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
        loading: false,
      }));
      return data.item;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  updateEntry: async (id, updates) => {
    set({ loading: true, error: null });
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
        loading: false,
      }));
      return data.item;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  deleteEntry: async (id) => {
    set({ loading: true, error: null });
    try {
      const response = await fetch(`/api/entries/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete entry');
      }
      set((state) => ({
        entries: state.entries.filter((entry) => entry.id !== id),
        loading: false,
      }));
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
}));
