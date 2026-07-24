"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "../stores/useAuthStore";
import Sidebar from "./Sidebar";
import AppSwitcher from "./AppSwitcher";
import EntryList from "./EntryList";
import GroupedList from "./GroupedList";
import TodoList from "./TodoList";
import Settings from "./Settings";
import ArchiveList from "./ArchiveList";
import Forderbereiche from "./stiftungen/Forderbereiche";
import Eingabefristen from "./stiftungen/Eingabefristen";

const DEFAULT_VIEW = { p: "list", s: "forderbereiche" };

export default function ClientWrapper() {
  // *** VARIABLES ***
  const [activeApp, setActiveApp] = useState("p");
  const [activeView, setActiveView] = useState(DEFAULT_VIEW.p);
  // One-shot deep link: the entry whose row the target view should open and
  // scroll to (set by the ToDo list's "Zum Traktandum" jump).
  const [focusEntryId, setFocusEntryId] = useState(null);
  const fetchSession = useAuthStore((state) => state.fetchSession);
  const loading = useAuthStore((state) => state.loading);

  // *** FUNCTIONS/HANDLERS ***
  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const handleViewChange = (view) => {
    setFocusEntryId(null);
    setActiveView(view);
  };

  const handleAppChange = (app) => {
    setFocusEntryId(null);
    setActiveApp(app);
    setActiveView(DEFAULT_VIEW[app]);
  };

  // Archived parents live in the Archiv view, everything else in Alle
  // Traktanden.
  const handleOpenEntry = (entry) => {
    setFocusEntryId(entry.id);
    setActiveView(entry.archived ? "archiv" : "list");
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
        {activeApp === "p" && activeView === "unbearbeitet" && (
          <EntryList contentFilter="without" title="Offene Traktanden" />
        )}
        {activeApp === "p" && activeView === "list" && (
          <EntryList
            contentFilter="with"
            title="Alle Traktanden"
            focusEntryId={focusEntryId}
          />
        )}
        {activeApp === "p" && activeView === "themen" && (
          <GroupedList
            field="topic"
            title="Themen"
            emptyLabel="Noch keine Themen."
          />
        )}
        {activeApp === "p" && activeView === "todo" && (
          <TodoList onOpenEntry={handleOpenEntry} />
        )}
        {activeApp === "p" && activeView === "archiv" && (
          <ArchiveList focusEntryId={focusEntryId} />
        )}

        {activeApp === "s" && activeView === "forderbereiche" && (
          <Forderbereiche />
        )}
        {activeApp === "s" && activeView === "eingabefristen" && (
          <Eingabefristen />
        )}

        {activeView === "members" && <Settings />}
      </main>
    </div>
  );
}
