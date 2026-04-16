'use client';

import { useEffect } from 'react';
import { useTodosStore } from '../stores/useTodosStore';
import '../../styles/todo-list.css';

export default function TodoList() {
  // *** VARIABLES ***
  const todos = useTodosStore((state) => state.todos);
  const loading = useTodosStore((state) => state.loading);
  const fetchTodos = useTodosStore((state) => state.fetchTodos);

  // *** FUNCTIONS/HANDLERS ***
  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  return (
    <div className="todo-list">
      <div className="todo-list-header">
        <h2>ToDo</h2>
      </div>

      {loading && <p>ToDos werden geladen...</p>}

      {!loading && todos.length === 0 && (
        <div className="todo-list-empty">
          <p>Noch keine ToDos.</p>
        </div>
      )}

      {!loading && todos.length > 0 && (
        <table className="todo-list-table">
          <thead>
            <tr>
              <th>ToDo</th>
              <th>Thema / Projekt</th>
              <th>Datum</th>
            </tr>
          </thead>
          <tbody>
            {todos.map((todo) => (
              <tr key={todo.id}>
                <td>
                  <div className="todo-list-item-title">{todo.title}</div>
                </td>
                <td>
                  <div className="todo-list-item-todo">
                    {todo.topic || todo.project || '-'}
                  </div>
                </td>
                <td>
                  <div className="todo-list-item-date">
                    {formatDate(todo.date_created)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
