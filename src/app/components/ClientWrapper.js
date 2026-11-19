"use client";

import { useState, useEffect } from "react";
import { BOOKING_PATH } from "@/lib/returnTo";
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

// The URL reflects the app: `/` = Protokolle, `/?app=f` = Finanzen,
// `/booking` = Booking (also the start page of the Booking PWA).
const appUrl = (app) =>
  app === "b" ? BOOKING_PATH : app === "f" ? "/?app=f" : "/";

export default function ClientWrapper({ initialApp = "p" }) {
  // *** VARIABLES ***
  const [activeApp, setActiveApp] = useState(initialApp);
  const [activeView, setActiveView] = useState(DEFAULT_VIEW[initialApp]);
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

  // Members only have Booking, so send them to its URL.
  useEffect(() => {
    // Full load (see handleAppChange) so the Booking manifest is the one read.
    if (!loading && !isAdmin && initialApp !== "b")
      window.location.replace(BOOKING_PATH);
  }, [loading, isAdmin, initialApp]);

  const handleViewChange = (view) => {
    setFocusEntryId(null);
    setActiveView(view);
  };

  const handleAppChange = (app) => {
    // Booking lives on its own route; switching to or from it is a full page
    // load, so the browser reads that route's manifest from the start. After
    // a client-side switch, Safari/Chrome keep the manifest of the first page
    // and "Add to Home Screen" would install Protokolle instead of Booking.
    if ((app === "b") !== (initialApp === "b")) {
      window.location.assign(appUrl(app));
      return;
    }
    // p ↔ f stay on `/`: just update the URL so a reload keeps the app.
    window.history.replaceState(null, "", appUrl(app));
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

  const app = isAdmin ? activeApp : "b";
  const view =
    isAdmin || MEMBER_VIEWS.includes(activeView)
      ? activeView
      : "projekte-public";

  return (
    <div className="layout-container">
      {isAdmin && <AppSwitcher activeApp={app} onAppChange={handleAppChange} />}
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
