'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import Sidebar from './Sidebar';
import AppSwitcher from './AppSwitcher';
import EntryList from './EntryList';
import GroupedList from './GroupedList';
import TodoList from './TodoList';
import MembersList from './MembersList';
import Forderbereiche from './stiftungen/Forderbereiche';
import Eingabefristen from './stiftungen/Eingabefristen';

const DEFAULT_VIEW = { p: 'list', s: 'forderbereiche' };

export default function ClientWrapper() {
  // *** VARIABLES ***
  const [activeApp, setActiveApp] = useState('p');
  const [activeView, setActiveView] = useState(DEFAULT_VIEW.p);
  const fetchSession = useAuthStore((state) => state.fetchSession);
  const loading = useAuthStore((state) => state.loading);

  // *** FUNCTIONS/HANDLERS ***
  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const handleViewChange = (view) => {
    setActiveView(view);
  };

  const handleAppChange = (app) => {
    setActiveApp(app);
    setActiveView(DEFAULT_VIEW[app]);
  };

  if (loading) {
    return null;
  }

  return (
    <div className="layout-container">
      <AppSwitcher activeApp={activeApp} onAppChange={handleAppChange} />
      <Sidebar
        activeApp={activeApp}
        activeView={activeView}
        onViewChange={handleViewChange}
      />
      <main className="main-content">
        {activeApp === 'p' && activeView === 'unbearbeitet' && (
          <EntryList contentFilter="without" title="Offene Traktanden" />
        )}
        {activeApp === 'p' && activeView === 'list' && (
          <EntryList contentFilter="with" title="Alle Traktanden" />
        )}
        {activeApp === 'p' && activeView === 'themen' && (
          <GroupedList
            field="topic"
            title="Themen"
            emptyLabel="Noch keine Themen."
          />
        )}
        {activeApp === 'p' && activeView === 'projekte' && (
          <GroupedList
            field="project"
            title="Projekte"
            emptyLabel="Noch keine Projekte."
          />
        )}
        {activeApp === 'p' && activeView === 'todo' && <TodoList />}

        {activeApp === 's' && activeView === 'forderbereiche' && <Forderbereiche />}
        {activeApp === 's' && activeView === 'eingabefristen' && <Eingabefristen />}

        {activeView === 'members' && <MembersList />}
      </main>
    </div>
  );
}
