"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarRange,
  ClipboardList,
  Inbox,
  ListTodo,
  Repeat,
  Tag,
  Settings,
  LogOut,
  Archive,
  History,
  Menu,
  X,
  FolderKanban,
  MapPin,
} from "lucide-react";
import { useEntriesStore } from "../stores/useEntriesStore";
import { useAuthStore } from "../stores/useAuthStore";
import { useChangelogStore, getUnseen } from "../stores/useChangelogStore";
import { useEntriesSync } from "../hooks/useEntriesSync";
import { useRealtimeSync } from "../hooks/useRealtimeSync";
import { parseTodoMarkers } from "../../lib/richText";
import { BOOKING_PATH, isBookingPath, withNext } from "../../lib/returnTo";
import "../../styles/sidebar.css";

export default function Sidebar({
  activeApp = "p",
  activeView,
  isAdmin = false,
  onViewChange,
}) {
  // *** VARIABLES ***
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const entries = useEntriesStore((state) => state.entries);
  const workspace = useAuthStore((state) => state.workspace);
  const logout = useAuthStore((state) => state.logout);
  const userId = useAuthStore((state) => state.user?.id);
  const changelogComments = useChangelogStore((state) => state.comments);
  const seenSince = useChangelogStore((state) => state.seenSince);
  const seenIds = useChangelogStore((state) => state.seenIds);
  const unreadIds = useChangelogStore((state) => state.unreadIds);

  // Single source of truth for keeping the caches warm: the Sidebar is
  // mounted for the whole session, so one subscription here serves every view.
  // Realtime pings from other workspace members trigger instant refetches;
  // useEntriesSync keeps a slow fallback poll and the on-focus refetch.
  useEntriesSync();
  useRealtimeSync();

  const TITLES = { p: "protokolle", f: "finanzen", b: "booking" };
  const title = TITLES[activeApp] || TITLES.p;

  // Open marker-todos across all entries; a multi-member marker counts once
  // per member, matching the rows it spawns in the ToDo table.
  const todoCount = useMemo(() => {
    let count = 0;
    for (const entry of entries) {
      if (!entry.content) continue;
      count += parseTodoMarkers(entry.content).filter((t) => !t.done).length;
    }
    return count;
  }, [entries]);

  // Unread comments, for the Changelog badge.
  const unseenChangelogCount = useMemo(() => {
    return getUnseen(
      { comments: changelogComments, seenSince, seenIds, unreadIds },
      userId,
    ).length;
  }, [changelogComments, seenSince, seenIds, unreadIds, userId]);

  // *** FUNCTIONS/HANDLERS ***
  // The badge needs the changelog from the start, not only once it's opened.
  useEffect(() => {
    if (workspace) useChangelogStore.getState().ensureChangelog();
  }, [workspace]);

  const handleViewChange = (view) => {
    onViewChange(view);
    setIsOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className="sidebar-burger"
        aria-label={isOpen ? "Menü schliessen" : "Menü öffnen"}
        onClick={() => setIsOpen((v) => !v)}
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>
      <aside
        className={`sidebar ${activeApp === "f" ? "sidebar-finanzen" : ""} ${activeApp === "b" ? "sidebar-booking" : ""} ${isOpen ? "sidebar-open" : ""}`}
      >
        <h2 className="sidebar-title">{title}</h2>
        {workspace && (
          <span className="sidebar-workspace-name">{workspace.name}</span>
        )}

        {activeApp === "p" && (
          <nav className="sidebar-nav">
            <button
              className={`sidebar-button ${activeView === "unbearbeitet" ? "active" : ""}`}
              onClick={() => handleViewChange("unbearbeitet")}
            >
              <Inbox size={20} />
              Offene Traktanden
            </button>

            <button
              className={`sidebar-button ${activeView === "list" ? "active" : ""}`}
              onClick={() => handleViewChange("list")}
            >
              <ClipboardList size={20} />
              Alle Traktanden
            </button>

            <button
              className={`sidebar-button ${activeView === "themen" ? "active" : ""}`}
              onClick={() => handleViewChange("themen")}
            >
              <Tag size={20} />
              Themen
            </button>

            <button
              className={`sidebar-button ${activeView === "timeline" ? "active" : ""}`}
              onClick={() => handleViewChange("timeline")}
            >
              <CalendarRange size={20} />
              Timeline
            </button>

            <button
              className={`sidebar-button ${activeView === "changelog" ? "active" : ""}`}
              onClick={() => handleViewChange("changelog")}
            >
              <History size={20} />
              Changelog
              {unseenChangelogCount > 0 && (
                <span className="sidebar-button-todo-count">
                  {unseenChangelogCount}
                </span>
              )}
            </button>

            <button
              className={`sidebar-button ${activeView === "todo" ? "active" : ""}`}
              onClick={() => handleViewChange("todo")}
            >
              <ListTodo size={20} />
              ToDo
              <span className="sidebar-button-todo-count">{todoCount}</span>
            </button>
          </nav>
        )}

        {activeApp === "f" && (
          <nav className="sidebar-nav">
            <button
              className={`sidebar-button ${activeView === "forderbereiche" ? "active" : ""}`}
              onClick={() => handleViewChange("forderbereiche")}
            >
              Förderbereiche
            </button>

            <button
              className={`sidebar-button ${activeView === "eingabefristen" ? "active" : ""}`}
              onClick={() => handleViewChange("eingabefristen")}
            >
              Eingabefristen
            </button>
          </nav>
        )}

        {activeApp === "b" && (
          <nav className="sidebar-nav">
            <button
              className={`sidebar-button ${activeView.startsWith("projekte-") ? "active" : ""}`}
              onClick={() => handleViewChange("projekte-public")}
            >
              <FolderKanban size={20} />
              Projekte
            </button>

            {/* Admins: the shared (public) and the editable (intern) sheet. */}
            {isAdmin && activeView.startsWith("projekte-") && (
              <div className="sidebar-subnav">
                <button
                  className={`sidebar-button sidebar-subbutton ${activeView === "projekte-public" ? "active" : ""}`}
                  onClick={() => handleViewChange("projekte-public")}
                >
                  Public
                </button>
                <button
                  className={`sidebar-button sidebar-subbutton ${activeView === "projekte-intern" ? "active" : ""}`}
                  onClick={() => handleViewChange("projekte-intern")}
                >
                  Intern
                </button>
              </div>
            )}

            {isAdmin && (
              <button
                className={`sidebar-button ${activeView === "venues" ? "active" : ""}`}
                onClick={() => handleViewChange("venues")}
              >
                <MapPin size={20} />
                Venues
              </button>
            )}
          </nav>
        )}
        <div className="sidebar-footer">
          {activeApp === "p" && (
            <button
              className={`sidebar-button ${activeView === "archiv" ? "active" : ""}`}
              onClick={() => handleViewChange("archiv")}
            >
              <Archive size={20} />
              Archiv
            </button>
          )}

          <button
            className={`sidebar-button ${activeView === "members" ? "active" : ""}`}
            onClick={() => handleViewChange("members")}
          >
            <Settings size={20} />
            Einstellungen
          </button>

          <button
            className="sidebar-button"
            onClick={() =>
              router.push(
                withNext("/workspace", isBookingPath(pathname) ? BOOKING_PATH : null),
              )
            }
          >
            <Repeat size={20} />
            Workspace
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
