import { create } from "zustand";

// Client source of truth for todos. Mirrors useEntriesStore: todos are fetched
// from /api/todos (scoped to the active workspace by cookie) and cached here.
// The table is authoritative for `done` and `comment`; entry notes only seed
// new todos via the /todo marker, parsed server-side on entry save.
export const useTodosStore = create((set, get) => ({
  // *** VARIABLES ***
  todos: [],
  loaded: false,
  loading: false,
  error: null,

  // *** FUNCTIONS/HANDLERS ***
  // Pass { silent: true } for background revalidation: updates data in place
  // without flipping `loading`, and keeps the cache on a failed background fetch.
  fetchTodos: async ({ silent = false } = {}) => {
    if (!silent) set({ loading: true, error: null });
    try {
      const response = await fetch("/api/todos");
      if (!response.ok) {
        throw new Error("Failed to fetch todos");
      }
      const data = await response.json();
      set({ todos: data.items || [], loaded: true, loading: false });
    } catch (error) {
      if (silent) return;
      set({ error: error.message, loading: false });
    }
  },

  // Spinner only on the first ever load; afterwards revalidate silently.
  ensureTodos: () => {
    if (get().loaded) {
      return get().fetchTodos({ silent: true });
    }
    return get().fetchTodos();
  },

  // Clear the cache when switching workspace (todos are scoped per workspace).
  resetTodos: () =>
    set({ todos: [], loaded: false, loading: false, error: null }),

  // Create a standalone todo (no linked traktandum).
  addTodo: async (todo) => {
    set({ error: null });
    try {
      const response = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(todo),
      });
      if (!response.ok) {
        throw new Error("Failed to create todo");
      }
      const data = await response.json();
      set((state) => ({ todos: [data.item, ...state.todos] }));
      return data.item;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  deleteTodo: async (id) => {
    set({ error: null });
    try {
      const response = await fetch(`/api/todos/${id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error("Failed to delete todo");
      }
      set((state) => ({
        todos: state.todos.filter((todo) => todo.id !== id),
      }));
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  // Update done / comment. The row is returned shaped (with topic/entry_title).
  updateTodo: async (id, updates) => {
    set({ error: null });
    try {
      const response = await fetch(`/api/todos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        throw new Error("Failed to update todo");
      }
      const data = await response.json();
      set((state) => ({
        todos: state.todos.map((todo) => (todo.id === id ? data.item : todo)),
      }));
      return data.item;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },
}));
