'use client';

import { useEffect } from 'react';
import { ListTodo, Tag, Folder, Users, LogOut } from 'lucide-react';
import { useTodosStore } from '../stores/useTodosStore';
import { useAuthStore } from '../stores/useAuthStore';
import '../../styles/sidebar.css';

export default function Sidebar({ activeView, onViewChange }) {
  // *** VARIABLES ***
  const todos = useTodosStore((state) => state.todos);
  const fetchTodos = useTodosStore((state) => state.fetchTodos);
  const todoCount = todos.length;
  const workspace = useAuthStore((state) => state.workspace);
  const logout = useAuthStore((state) => state.logout);

  // *** FUNCTIONS/HANDLERS ***
  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  return (
    <aside className="sidebar">
      <h2 className="sidebar-title">Protokoll App</h2>
      {workspace && (
        <span className="sidebar-workspace-name">{workspace.name}</span>
      )}

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

      <button
        className={`sidebar-button ${activeView === 'members' ? 'active' : ''}`}
        onClick={() => onViewChange('members')}
      >
        <Users size={20} />
        Mitglieder
      </button>

      <div className="sidebar-footer">
        <button className="sidebar-button sidebar-logout" onClick={logout}>
          <LogOut size={20} />
          Abmelden
        </button>
      </div>
    </aside>
  );
}
