"use client";

import { useState, useEffect } from "react";
import { isAdminRole, useAuthStore } from "../stores/useAuthStore";
import Sidebar from "./Sidebar";
import AppSwitcher from "./AppSwitcher";
import EntryList from "./EntryList";
import GroupedList from "./GroupedList";
import TodoList from "./TodoList";
import Timeline from "./Timeline";
import Settings from "./Settings";
import ArchiveList from "./ArchiveList";
import Changelog from "./Changelog";
import Forderbereiche from "./stiftungen/Forderbereiche";
import Eingabefristen from "./stiftungen/Eingabefristen";
import BookingProjects from "./booking/BookingProjects";
import BookingVenues from "./booking/BookingVenues";

const DEFAULT_VIEW = { p: "list", f: "forderbereiche", b: "projekte-public" };

// Non-admins only ever see Booking › Projekte (public) and their settings.
const MEMBER_VIEWS = ["projekte-public", "members"];

// `lockedApp` pins the wrapper to one app (the /booking PWA) and hides the
// app switcher.
export default function ClientWrapper({ lockedApp = null }) {
  // *** VARIABLES ***
  const [activeApp, setActiveApp] = useState(lockedApp || "p");
  const [activeView, setActiveView] = useState(DEFAULT_VIEW[lockedApp || "p"]);
  // One-shot deep link: the entry whose row the target view should open and
  // scroll to (set by the ToDo list's "Zum Traktandum" jump).
  const [focusEntryId, setFocusEntryId] = useState(null);
  const fetchSession = useAuthStore((state) => state.fetchSession);
  const loading = useAuthStore((state) => state.loading);
  const isAdmin = isAdminRole(useAuthStore((state) => state.role));

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

  // Jump to wherever the entry is actually listed: archived ones live in the
  // Archiv, entries with notes in Alle Traktanden, and the rest (a scheduled
  // traktandum that has no notes yet) in Offene Traktanden.
  const handleOpenEntry = (entry) => {
    setFocusEntryId(entry.id);
    if (entry.archived) setActiveView("archiv");
    else if (entry.content) setActiveView("list");
    else setActiveView("unbearbeitet");
  };

  if (loading) {
    return null;
  }

  const app = lockedApp || (isAdmin ? activeApp : "b");
  const view =
    isAdmin || MEMBER_VIEWS.includes(activeView)
      ? activeView
      : "projekte-public";

  return (
    <div className="layout-container">
      {isAdmin && !lockedApp && <AppSwitcher activeApp={app} onAppChange={handleAppChange} />}
      <Sidebar
        activeApp={app}
        activeView={view}
        isAdmin={isAdmin}
        onViewChange={handleViewChange}
      />
      <main className="main-content">
        {app === "p" && view === "unbearbeitet" && (
          <EntryList contentFilter="without" title="Offene Traktanden" />
        )}
        {app === "p" && view === "list" && (
          <EntryList
            contentFilter="with"
            title="Alle Traktanden"
            focusEntryId={focusEntryId}
          />
        )}
        {app === "p" && view === "themen" && (
          <GroupedList
            field="topic"
            title="Themen"
            emptyLabel="Noch keine Themen."
          />
        )}
        {app === "p" && view === "todo" && (
          <TodoList onOpenEntry={handleOpenEntry} />
        )}
        {app === "p" && view === "timeline" && (
          <Timeline onOpenEntry={handleOpenEntry} />
        )}
        {app === "p" && view === "changelog" && <Changelog />}
        {app === "p" && view === "archiv" && (
          <ArchiveList focusEntryId={focusEntryId} />
        )}

        {app === "f" && view === "forderbereiche" && <Forderbereiche />}
        {app === "f" && view === "eingabefristen" && <Eingabefristen />}

        {/* One element for both modes, so switching Intern ↔ Public keeps
            the selected project and show. */}
        {app === "b" && view.startsWith("projekte-") && (
          <BookingProjects
            mode={view === "projekte-intern" ? "intern" : "public"}
          />
        )}
        {app === "b" && view === "venues" && <BookingVenues />}

        {view === "members" && <Settings />}
      </main>
    </div>
  );
}
