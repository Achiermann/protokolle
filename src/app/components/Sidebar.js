"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardList,
  ListTodo,
  Repeat,
  Tag,
  Settings,
  LogOut,
  Archive,
  Menu,
  X,
} from "lucide-react";
import { useEntriesStore } from "../stores/useEntriesStore";
import { useAuthStore } from "../stores/useAuthStore";
import { useEntriesSync } from "../hooks/useEntriesSync";
import { useRealtimeSync } from "../hooks/useRealtimeSync";
import { createTodoCountRegex } from "../../lib/richText";
import "../../styles/sidebar.css";

export default function Sidebar({ activeApp = "p", activeView, onViewChange }) {
  // *** VARIABLES ***
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const entries = useEntriesStore((state) => state.entries);
  const workspace = useAuthStore((state) => state.workspace);
  const logout = useAuthStore((state) => state.logout);

  // Single source of truth for keeping the caches warm: the Sidebar is
  // mounted for the whole session, so one subscription here serves every view.
  // Realtime pings from other workspace members trigger instant refetches;
  // useEntriesSync keeps a slow fallback poll and the on-focus refetch.
  useEntriesSync();
  useRealtimeSync();

  const title = activeApp === "s" ? "stiftungen" : "protokolle";

  const todoCount = useMemo(() => {
    const regex = createTodoCountRegex();
    let count = 0;
    for (const entry of entries) {
      if (!entry.content) continue;
      const matches = entry.content.match(regex);
      if (matches) count += matches.length;
    }
    return count;
  }, [entries]);

  // *** FUNCTIONS/HANDLERS ***
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
        className={`sidebar ${activeApp === "s" ? "sidebar-stiftungen" : ""} ${isOpen ? "sidebar-open" : ""}`}
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
              className={`sidebar-button ${activeView === "todo" ? "active" : ""}`}
              onClick={() => handleViewChange("todo")}
            >
              <ListTodo size={20} />
              ToDo
              <span className="sidebar-button-todo-count">{todoCount}</span>
            </button>
          </nav>
        )}

        {activeApp === "s" && (
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
            onClick={() => router.push("/workspace")}
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
