"use client";

import { useMemo, useState } from "react";
import { useEntriesStore } from "../stores/useEntriesStore";
import { useWorkspacesStore } from "../stores/useWorkspacesStore";
import { Pencil, Archive } from "lucide-react";
import toast from "react-hot-toast";
import RichTextEditor from "./RichTextEditor";
import { sanitizeHtml, decorateTodos } from "../../lib/richText";
import "../../styles/entry-list.css";

export default function GroupedList({ field, title, emptyLabel }) {
  // *** VARIABLES ***
  const entries = useEntriesStore((state) => state.entries);
  const loading = useEntriesStore((state) => state.loading);
  const updateEntry = useEntriesStore((state) => state.updateEntry);
  const members = useWorkspacesStore((state) => state.members);
  const fetchMembers = useWorkspacesStore((state) => state.fetchMembers);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState("");

  // *** FUNCTIONS/HANDLERS ***
  const getTopicColorClass = (value) => {
    if (!value) return "";
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = (hash * 31 + value.charCodeAt(i)) | 0;
    }
    return `entry-list-item-topic-c${Math.abs(hash) % 10}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("de-DE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const groups = useMemo(() => {
    const map = new Map();
    for (const entry of entries) {
      if (!entry.content) continue;
      if (entry.archived) continue;
      const value = entry[field];
      if (!value) continue;
      if (!map.has(value)) map.set(value, []);
      map.get(value).push(entry);
    }
    return Array.from(map.entries())
      .map(([name, items]) => ({ name, items }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [entries, field]);

  const selectedEntries = useMemo(() => {
    if (!selectedGroup) return [];
    return entries
      .filter((e) => e.content && !e.archived && e[field] === selectedGroup)
      .sort(
        (a, b) =>
          new Date(b.date_created).getTime() -
          new Date(a.date_created).getTime(),
      );
  }, [entries, field, selectedGroup]);

  const handleRowClick = (name) => {
    setSelectedGroup(selectedGroup === name ? null : name);
  };

  const handleClosePanel = () => {
    setSelectedGroup(null);
    setEditingId(null);
  };

  const handleEditClick = (entry) => {
    setEditingId(entry.id);
    setEditDraft(entry.content || "");
  };

  const handleSaveEdit = async (id) => {
    try {
      await updateEntry(id, { content: editDraft });
      setEditingId(null);
      toast.success("Inhalt aktualisiert");
    } catch (error) {
      toast.error("Inhalt konnte nicht aktualisiert werden");
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const loadMembers = async () => {
    try {
      await fetchMembers();
    } catch (error) {
      toast.error("Mitglieder konnten nicht geladen werden");
    }
  };

  const handleArchiveGroup = async (name) => {
    const toArchive = entries.filter((e) => !e.archived && e[field] === name);
    if (toArchive.length === 0) return;
    if (
      !confirm(`Alle ${toArchive.length} Traktanden in "${name}" archivieren?`)
    ) {
      return;
    }
    try {
      await Promise.all(
        toArchive.map((e) => updateEntry(e.id, { archived: true })),
      );
      if (selectedGroup === name) setSelectedGroup(null);
      toast.success("Traktanden archiviert");
    } catch (error) {
      toast.error("Archivieren fehlgeschlagen");
    }
  };

  return (
    <div className="entry-list">
      <div className="entry-list-header">
        <h2>{title}</h2>
      </div>
      {selectedGroup && (
        <div className="entry-list-detail-panel">
          <div className="entry-list-detail-panel-header">
            <h3 className="entry-list-detail-panel-title">{selectedGroup}</h3>
            <button
              type="button"
              className="secondary entry-list-detail-panel-close"
              onClick={handleClosePanel}
            >
              ✕
            </button>
          </div>

          <div className="entry-list-detail-panel-content">
            <span className="entry-list-detail-panel-meta-label">
              Traktanden
            </span>
            {selectedEntries.length === 0 ? (
              <p className="entry-list-detail-panel-content-empty">
                Noch keine Traktanden.
              </p>
            ) : (
              <div className="grouped-list-traktanden">
                {selectedEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className={
                      "grouped-list-traktanden-section " +
                      (entry.item_title === "posteingang" ? `posteingang` : ``)
                    }
                  >
                    <div className="grouped-list-traktanden-section-header">
                      <strong className="grouped-list-traktanden-title">
                        {entry.item_title}
                        {entry.created_by_name && (
                          <span className="entry-list-item-creator">
                            {" - "}
                            {entry.created_by_name}
                          </span>
                        )}
                      </strong>
                      <span className="grouped-list-traktanden-date">
                        {formatDate(entry.date_created)}
                      </span>
                    </div>
                    {editingId === entry.id ? (
                      <>
                        <RichTextEditor
                          value={editDraft}
                          onChange={setEditDraft}
                          members={members}
                          onRequestMembers={loadMembers}
                          placeholder="Sitzungsnotizen hier schreiben... Text markieren und B/I/U oder + ToDo klicken."
                        />
                        <div className="entry-list-detail-panel-content-actions">
                          <button
                            type="button"
                            className="primary"
                            onClick={() => handleSaveEdit(entry.id)}
                          >
                            Speichern
                          </button>
                          <button
                            type="button"
                            className="secondary"
                            onClick={handleCancelEdit}
                          >
                            Abbrechen
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        {entry.content && (
                          <div
                            className="grouped-list-traktanden-content"
                            dangerouslySetInnerHTML={{
                              __html: decorateTodos(
                                sanitizeHtml(entry.content),
                              ),
                            }}
                          />
                        )}
                        <button
                          type="button"
                          className="secondary edit-hover-button"
                          onClick={() => handleEditClick(entry)}
                        >
                          <Pencil size={16} />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {loading && <p>Wird geladen...</p>}

      {!loading && groups.length === 0 && (
        <div className="entry-list-empty">
          <p>{emptyLabel}</p>
        </div>
      )}

      {!loading && groups.length > 0 && (
        <table className="entry-list-table">
          <thead>
            <tr>
              <th className="table-header-cell">{title}</th>
              <th className="table-header-cell">Anzahl</th>
              <th className="table-header-cell">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <tr
                key={group.name}
                className={
                  selectedGroup === group.name
                    ? "entry-list-table-row entry-list-table-row-selected"
                    : "entry-list-table-row"
                }
                onClick={() => handleRowClick(group.name)}
              >
                <td>
                  <div
                    className={
                      "entry-list-item-topic " + getTopicColorClass(group.name)
                    }
                  >
                    {group.name}
                  </div>
                </td>
                <td>
                  <div className="entry-list-item-date">
                    {group.items.length}
                  </div>
                </td>
                <td>
                  <div className="entry-list-item-actions">
                    <button
                      type="button"
                      className="secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleArchiveGroup(group.name);
                      }}
                    >
                      <Archive size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
