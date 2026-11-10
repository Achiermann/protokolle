"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { pingWorkspaceChange } from "@/db/supabase-browser";
import { useEntriesStore } from "../stores/useEntriesStore";
import { useTodosStore } from "../stores/useTodosStore";
import { useChangelogStore } from "../stores/useChangelogStore";
import "../../styles/topics-list.css";

// Settings section: every Thema of the workspace, renameable inline. Click a
// name to edit; Enter or blur saves, Esc cancels. Renaming onto an existing
// Thema merges the two after a confirm.
export default function TopicsList() {
  // *** VARIABLES ***
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // topic currently being edited
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  // Esc and Enter both end editing, which also fires blur — this guard keeps
  // that trailing blur from saving a second time (or saving after a cancel).
  const doneRef = useRef(false);

  // *** FUNCTIONS/HANDLERS ***
  useEffect(() => {
    fetch("/api/topics")
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => setTopics(data.items || []))
      .catch(() => toast.error("Themen konnten nicht geladen werden"))
      .finally(() => setLoading(false));
  }, []);

  const startEdit = (topic) => {
    if (saving) return;
    doneRef.current = false;
    setEditing(topic);
    setDraft(topic);
  };

  const cancel = () => {
    doneRef.current = true;
    setEditing(null);
  };

  const save = async () => {
    if (doneRef.current) return;
    doneRef.current = true;
    const from = editing;
    const to = draft.trim();
    if (!to || to === from) {
      if (!to) toast.error("Name darf nicht leer sein");
      setEditing(null);
      return;
    }
    const existing = topics.find((t) => t !== from && t === to);
    if (
      existing &&
      !confirm(
        `Das Thema «${to}» existiert bereits. Sollen «${from}» und «${to}» zusammengeführt werden?`,
      )
    ) {
      setEditing(null);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/topics", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Fehler");
      setTopics(data.items || []);
      toast.success(existing ? "Themen zusammengeführt" : "Thema umbenannt");
      // Refresh cached lists so other views show the new name right away.
      useEntriesStore.getState().fetchEntries({ silent: true });
      useTodosStore.getState().fetchTodos({ silent: true });
      useChangelogStore.getState().fetchChangelog({ silent: true });
      pingWorkspaceChange();
    } catch (error) {
      toast.error(error.message || "Thema konnte nicht umbenannt werden");
    } finally {
      setSaving(false);
      setEditing(null);
    }
  };

  return (
    <section className="settings-section">
      <h3 className="settings-section-title">Themen</h3>
      {loading ? (
        <p className="topics-list-empty">Laden...</p>
      ) : topics.length === 0 ? (
        <p className="topics-list-empty">Noch keine Themen vorhanden.</p>
      ) : (
        <ul className="topics-list">
          {topics.map((topic) => (
            <li key={topic} className="topics-list-item">
              {editing === topic ? (
                <input
                  className="topics-list-input"
                  type="text"
                  value={draft}
                  autoFocus
                  disabled={saving}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={save}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      save();
                    } else if (e.key === "Escape") {
                      cancel();
                    }
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="topics-list-name"
                  onClick={() => startEdit(topic)}
                  title="Klicken zum Umbenennen"
                >
                  {topic}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
