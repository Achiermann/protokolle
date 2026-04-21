'use client';

import { useEffect, useMemo } from 'react';
import { ListTodo, Tag, Folder, Settings, LogOut } from 'lucide-react';
import { useEntriesStore } from '../stores/useEntriesStore';
import { useAuthStore } from '../stores/useAuthStore';
import '../../styles/sidebar.css';

export default function Sidebar({ activeApp = 'p', activeView, onViewChange }) {
  // *** VARIABLES ***
  const entries = useEntriesStore((state) => state.entries);
  const fetchEntries = useEntriesStore((state) => state.fetchEntries);
  const workspace = useAuthStore((state) => state.workspace);
  const logout = useAuthStore((state) => state.logout);

  const title = activeApp === 's' ? '_stiftungen' : '_protokolle';

  const todoCount = useMemo(() => {
    const regex = /\/todo@\S+[ \t]+[^\n]+/g;
    let count = 0;
    for (const entry of entries) {
      if (!entry.content) continue;
      const matches = entry.content.match(regex);
      if (matches) count += matches.length;
    }
    return count;
  }, [entries]);

  // *** FUNCTIONS/HANDLERS ***
  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  return (
    <aside className="sidebar">
      <h2 className="sidebar-title">{title}</h2>
      {workspace && (
        <span className="sidebar-workspace-name">{workspace.name}</span>
      )}

      {activeApp === 'p' && (
        <>
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
        </>
      )}

      {activeApp === 's' && (
        <>
          <button
            className={`sidebar-button ${activeView === 'forderbereiche' ? 'active' : ''}`}
            onClick={() => onViewChange('forderbereiche')}
          >
            Förderbereiche
          </button>

          <button
            className={`sidebar-button ${activeView === 'eingabefristen' ? 'active' : ''}`}
            onClick={() => onViewChange('eingabefristen')}
          >
            Eingabefristen
          </button>
        </>
      )}

      <div className="sidebar-footer">
        <button
          className={`sidebar-button sidebar-einstellungen ${activeView === 'members' ? 'active' : ''}`}
          onClick={() => onViewChange('members')}
        >
          <Settings size={20} />
          Einstellungen
        </button>

        <button className="sidebar-button sidebar-logout" onClick={logout}>
          <LogOut size={20} />
          Abmelden
        </button>
      </div>
    </aside>
  );
}
