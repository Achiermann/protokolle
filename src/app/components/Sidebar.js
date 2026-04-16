'use client';

import { useEffect } from 'react';
import { Plus, ListTodo, Tag, Folder } from 'lucide-react';
import { useTodosStore } from '../stores/useTodosStore';
import '../../styles/sidebar.css';

export default function Sidebar({ activeView, onViewChange }) {
  // *** VARIABLES ***
  const todos = useTodosStore((state) => state.todos);
  const fetchTodos = useTodosStore((state) => state.fetchTodos);
  const todoCount = todos.length;

  // *** FUNCTIONS/HANDLERS ***
  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  return (
    <aside className="sidebar">
      <h2 className="sidebar-title">Protokoll App</h2>

      <button
        className={`sidebar-button ${activeView === 'unbearbeitet' ? 'active' : ''}`}
        onClick={() => onViewChange('unbearbeitet')}
      >
        Offene Traktanden
      </button>

      <button
        className={`sidebar-button ${activeView === 'list' ? 'active' : ''}`}
        onClick={() => onViewChange('list')}
      >
        Alle Traktanden
      </button>

      <button
        className={`sidebar-button ${activeView === 'create' ? 'active' : ''}`}
        onClick={() => onViewChange('create')}
      >
        <Plus size={20} />
        Neues Traktandum
      </button>

      <button
        className={`sidebar-button ${activeView === 'themen' ? 'active' : ''}`}
        onClick={() => onViewChange('themen')}
      >
        <Tag size={20} />
        Themen
      </button>

      <button
        className={`sidebar-button ${activeView === 'projekte' ? 'active' : ''}`}
        onClick={() => onViewChange('projekte')}
      >
        <Folder size={20} />
        Projekte
      </button>

      <button
        className={`sidebar-button ${activeView === 'todo' ? 'active' : ''}`}
        onClick={() => onViewChange('todo')}
      >
        <ListTodo size={20} />
        ToDo
        <span className="sidebar-button-todo-count">{todoCount}</span>
      </button>
    </aside>
  );
}
