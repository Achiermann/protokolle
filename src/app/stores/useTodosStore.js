import { create } from 'zustand';

export const useTodosStore = create((set) => ({
  // *** VARIABLES ***
  todos: [],
  loading: false,
  error: null,

  // *** FUNCTIONS/HANDLERS ***
  fetchTodos: async () => {
    set({ loading: true, error: null });
    try {
      const response = await fetch('/api/todos');
      if (!response.ok) {
        throw new Error('Failed to fetch todos');
      }
      const data = await response.json();
      set({ todos: data.items || [], loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  addTodo: async (todo) => {
    set({ loading: true, error: null });
    try {
      const response = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(todo),
      });
      if (!response.ok) {
        throw new Error('Failed to create todo');
      }
      const data = await response.json();
      set((state) => ({
        todos: [data.item, ...state.todos],
        loading: false,
      }));
      return data.item;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
}));
