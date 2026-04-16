'use client';

import { useState } from 'react';
import Sidebar from './Sidebar';
import EntryForm from './EntryForm';
import EntryList from './EntryList';
import GroupedList from './GroupedList';
import TodoList from './TodoList';

export default function ClientWrapper() {
  // *** VARIABLES ***
  const [activeView, setActiveView] = useState('list');

  // *** FUNCTIONS/HANDLERS ***
  const handleViewChange = (view) => {
    setActiveView(view);
  };

  return (
    <div className="layout-container">
      <Sidebar activeView={activeView} onViewChange={handleViewChange} />
      <main className="main-content">
        {activeView === 'unbearbeitet' && (
          <EntryList contentFilter="without" title="Offene Traktanden" />
        )}
        {activeView === 'list' && <EntryList contentFilter="with" title="Alle Traktanden" />}
        {activeView === 'create' && (
          <EntryForm onCancel={() => setActiveView('list')} />
        )}
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
      </main>
    </div>
  );
}
