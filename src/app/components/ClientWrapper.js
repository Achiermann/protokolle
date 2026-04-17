'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import Sidebar from './Sidebar';
import EntryList from './EntryList';
import GroupedList from './GroupedList';
import TodoList from './TodoList';
import MembersList from './MembersList';

export default function ClientWrapper() {
  // *** VARIABLES ***
  const [activeView, setActiveView] = useState('list');
  const fetchSession = useAuthStore((state) => state.fetchSession);
  const loading = useAuthStore((state) => state.loading);

  // *** FUNCTIONS/HANDLERS ***
  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const handleViewChange = (view) => {
    setActiveView(view);
  };

  if (loading) {
    return null;
  }

  return (
    <div className="layout-container">
      <Sidebar activeView={activeView} onViewChange={handleViewChange} />
      <main className="main-content">
        {activeView === 'unbearbeitet' && (
          <EntryList contentFilter="without" title="Offene Traktanden" />
        )}
        {activeView === 'list' && <EntryList contentFilter="with" title="Alle Traktanden" />}
        {activeView === 'themen' && (
          <GroupedList
            field="topic"
            title="Themen"
            emptyLabel="Noch keine Themen."
          />
        )}
        {activeView === 'projekte' && (
          <GroupedList
            field="project"
            title="Projekte"
            emptyLabel="Noch keine Projekte."
          />
        )}
        {activeView === 'todo' && <TodoList />}
        {activeView === 'members' && <MembersList />}
      </main>
    </div>
  );
}
