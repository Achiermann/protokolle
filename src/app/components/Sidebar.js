'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ListTodo,
  Tag,
  Folder,
  Settings,
  LogOut,
  Archive,
  Menu,
  X,
} from 'lucide-react';
import { useEntriesStore } from '../stores/useEntriesStore';
import { useAuthStore } from '../stores/useAuthStore';
import '../../styles/sidebar.css';

export default function Sidebar({ activeApp = 'p', activeView, onViewChange }) {
  // *** VARIABLES ***
  const [isOpen, setIsOpen] = useState(false);
  const entries = useEntriesStore((state) => state.entries);
  const fetchEntries = useEntriesStore((state) => state.fetchEntries);
  const workspace = useAuthStore((state) => state.workspace);
  const logout = useAuthStore((state) => state.logout);

  const title = activeApp === 's' ? 'stiftungen' : 'protokolle';

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

  const handleViewChange = (view) => {
    onViewChange(view);
    setIsOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className="sidebar-burger"
        aria-label={isOpen ? 'Menü schliessen' : 'Menü öffnen'}
        onClick={() => setIsOpen((v) => !v)}
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>
      <aside
        className={`sidebar ${activeApp === 's' ? 'sidebar-stiftungen' : ''} ${isOpen ? 'sidebar-open' : ''}`}
      >
        <h2 className="sidebar-title">{title}</h2>
        {workspace && (
          <span className="sidebar-workspace-name">{workspace.name}</span>
        )}

        {activeApp === 'p' && (
          <>
            <button
              className={`sidebar-button ${activeView === 'unbearbeitet' ? 'active' : ''}`}
              onClick={() => handleViewChange('unbearbeitet')}
            >
              Offene Traktanden
            </button>

            <button
              className={`sidebar-button ${activeView === 'list' ? 'active' : ''}`}
              onClick={() => handleViewChange('list')}
            >
              Alle Traktanden
            </button>

            <button
              className={`sidebar-button ${activeView === 'themen' ? 'active' : ''}`}
              onClick={() => handleViewChange('themen')}
            >
              <Tag size={20} />
              Themen
            </button>

            <button
              className={`sidebar-button ${activeView === 'projekte' ? 'active' : ''}`}
              onClick={() => handleViewChange('projekte')}
            >
              <Folder size={20} />
              Projekte
            </button>

            <button
              className={`sidebar-button ${activeView === 'todo' ? 'active' : ''}`}
              onClick={() => handleViewChange('todo')}
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
              onClick={() => handleViewChange('forderbereiche')}
            >
              Förderbereiche
            </button>

            <button
              className={`sidebar-button ${activeView === 'eingabefristen' ? 'active' : ''}`}
              onClick={() => handleViewChange('eingabefristen')}
            >
              Eingabefristen
            </button>
          </>
        )}

        <div className="sidebar-footer">
          {activeApp === 'p' && (
            <button
              className={`sidebar-button ${activeView === 'archiv' ? 'active' : ''}`}
              onClick={() => handleViewChange('archiv')}
            >
              <Archive size={20} />
              Archiv
            </button>
          )}

          <button
            className={`sidebar-button sidebar-einstellungen ${activeView === 'members' ? 'active' : ''}`}
            onClick={() => handleViewChange('members')}
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
    </>
  );
}
