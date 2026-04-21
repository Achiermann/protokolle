"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { useEntriesStore } from "../stores/useEntriesStore";
import toast from "react-hot-toast";
import {
  Pencil,
  MailPlus,
  MailMinus,
  Trash,
  Plus,
  Circle,
  Square,
  Triangle,
  Diamond,
  Hexagon,
  Octagon,
  Pentagon,
  Star,
  Heart,
  Shield,
} from "lucide-react";

const SHAPE_ICONS = [
  Circle,
  Square,
  Triangle,
  Diamond,
  Hexagon,
  Octagon,
  Pentagon,
  Star,
  Heart,
  Shield,
];
import EntryForm from "./EntryForm";
import "../../styles/entry-list.css";
import "../../styles/filters.css";

export default function EntryList({
  contentFilter,
  title = "Alle Traktanden",
}) {
  // *** VARIABLES ***
  const entries = useEntriesStore((state) => state.entries);
  const loading = useEntriesStore((state) => state.loading);
  const fetchEntries = useEntriesStore((state) => state.fetchEntries);
  const deleteEntry = useEntriesStore((state) => state.deleteEntry);
  const updateEntry = useEntriesStore((state) => state.updateEntry);

  const [members, setMembers] = useState([]);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [todoInsertPos, setTodoInsertPos] = useState(null);
  const [filterTopicProject, setFilterTopicProject] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [selectedId, setSelectedId] = useState(null);
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [contentDraft, setContentDraft] = useState("");
  const contentTextareaRef = useRef(null);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);

  // *** FUNCTIONS/HANDLERS ***
  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const selectedEntry = useMemo(
    () => entries.find((e) => e.id === selectedId) || null,
    [entries, selectedId],
  );

  const handleRowClick = (entry) => {
    if (selectedId === entry.id) {
      setSelectedId(null);
      setIsEditingContent(false);
    } else {
      setSelectedId(entry.id);
      setIsEditingContent(false);
      setContentDraft(entry.content || "");
    }
  };

  const handleEditContent = () => {
    setContentDraft(selectedEntry?.content || "");
    setIsEditingContent(true);
  };

  const handleSaveContent = async () => {
    try {
      await updateEntry(selectedId, { content: contentDraft });
      setIsEditingContent(false);
      toast.success("Inhalt aktualisiert");
    } catch (error) {
      toast.error("Inhalt konnte nicht aktualisiert werden");
    }
  };

  const wrapSelection = (before, after) => {
    const textarea = contentTextareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = contentDraft;
    const selected = value.slice(start, end);
    const next =
      value.slice(0, start) + before + selected + after + value.slice(end);
    setContentDraft(next);
    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + before.length + selected.length + after.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  const handleBold = () => wrapSelection("**", "**");
  const handleItalic = () => wrapSelection("*", "*");
  const handleUnderline = () => wrapSelection("__", "__");

  const loadMembers = async () => {
    try {
      const response = await fetch("/api/workspaces/members");
      if (!response.ok) throw new Error("fail");
      const data = await response.json();
      setMembers(data.items || []);
    } catch (error) {
      toast.error("Mitglieder konnten nicht geladen werden");
    }
  };

  const handleInsertTodo = async () => {
    const textarea = contentTextareaRef.current;
    if (!textarea) return;
    if (members.length === 0) await loadMembers();

    const pos = textarea.selectionStart;
    const prefix = "/todo";
    const next =
      contentDraft.slice(0, pos) + prefix + contentDraft.slice(pos);
    setContentDraft(next);
    setTodoInsertPos(pos);
    setShowMemberDropdown(true);
    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = pos + prefix.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  const handleSelectMember = (member) => {
    if (todoInsertPos === null) return;
    const rawName = member.name || member.email.split("@")[0];
    const nameTag = rawName.replace(/\s+/g, "_");
    const replacement = `/todo@${nameTag} `;
    const before = contentDraft.slice(0, todoInsertPos);
    const after = contentDraft.slice(todoInsertPos + "/todo".length);
    const nextContent = before + replacement + after;
    const cursor = todoInsertPos + replacement.length;
    setContentDraft(nextContent);
    setShowMemberDropdown(false);
    setTodoInsertPos(null);
    requestAnimationFrame(() => {
      const textarea = contentTextareaRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  const handleCancelMemberDropdown = () => {
    setShowMemberDropdown(false);
    setTodoInsertPos(null);
  };

  const handleCancelEdit = () => {
    setIsEditingContent(false);
    setContentDraft(selectedEntry?.content || "");
  };

  const handleClosePanel = () => {
    setSelectedId(null);
    setIsEditingContent(false);
  };

  const handleDelete = async (id) => {
    if (!confirm("Bist du sicher, dass du dieses Traktandum löschen willst?")) {
      return;
    }

    try {
      await deleteEntry(id);
      if (selectedId === id) setSelectedId(null);
      toast.success("Traktandum gelöscht");
    } catch (error) {
      toast.error("Traktandum konnte nicht gelöscht werden");
    }
  };

  const handleSendToPosteingang = async (id) => {
    try {
      await updateEntry(id, { in_posteingang: true });
      toast.success("In Posteingang verschoben");
    } catch (error) {
      toast.error("Verschieben fehlgeschlagen");
    }
  };

  const handleRemoveFromPosteingang = async (id) => {
    try {
      await updateEntry(id, { in_posteingang: false });
      toast.success("Aus Posteingang entfernt");
    } catch (error) {
      toast.error("Entfernen fehlgeschlagen");
    }
  };

  const isInPosteingang = (entry) => {
    return entry.in_posteingang || entry.topic === "posteingang";
  };

  const handleClearFilters = () => {
    setFilterTopicProject("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setSortBy("date");
    setSortDir("desc");
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortDir(column === "date" ? "desc" : "asc");
    }
  };

  const getSortValue = (entry, column) => {
    if (column === "title") return (entry.item_title || "").toLowerCase();
    if (column === "topic")
      return (entry.topic || entry.project || "").toLowerCase();
    return new Date(entry.date_created).getTime();
  };

  const sortIndicator = (column) => {
    if (sortBy !== column) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  };

  const renderTopicIcon = (topic) => {
    if (!topic) return null;
    let hash = 0;
    for (let i = 0; i < topic.length; i++) {
      hash = (hash * 31 + topic.charCodeAt(i)) | 0;
    }
    const Icon = SHAPE_ICONS[Math.abs(hash) % SHAPE_ICONS.length];
    return <Icon size={16} className="entry-list-item-topic-icon" />;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("de-DE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const filteredAndSortedEntries = useMemo(() => {
    let result = [...entries];

    if (contentFilter === "with") {
      result = result.filter((entry) => entry.content);
    } else if (contentFilter === "without") {
      result = result.filter((entry) => !entry.content);
    }

    if (filterTopicProject) {
      const searchTerm = filterTopicProject.toLowerCase();
      result = result.filter(
        (entry) =>
          (entry.topic && entry.topic.toLowerCase().includes(searchTerm)) ||
          (entry.project && entry.project.toLowerCase().includes(searchTerm)),
      );
    }

    if (filterDateFrom) {
      const fromDate = new Date(filterDateFrom);
      result = result.filter(
        (entry) => new Date(entry.date_created) >= fromDate,
      );
    }

    if (filterDateTo) {
      const toDate = new Date(filterDateTo);
      toDate.setHours(23, 59, 59, 999);
      result = result.filter((entry) => new Date(entry.date_created) <= toDate);
    }

    result.sort((a, b) => {
      const valA = getSortValue(a, sortBy);
      const valB = getSortValue(b, sortBy);
      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [
    entries,
    contentFilter,
    filterTopicProject,
    filterDateFrom,
    filterDateTo,
    sortBy,
    sortDir,
  ]);

  const groupedEntries = useMemo(() => {
    if (contentFilter !== "without") return [];
    const posteingang = [];
    const map = new Map();
    for (const entry of filteredAndSortedEntries) {
      if (isInPosteingang(entry)) {
        posteingang.push(entry);
      } else {
        const group = entry.topic || entry.project || "ohne thema";
        if (!map.has(group)) map.set(group, []);
        map.get(group).push(entry);
      }
    }
    const groups = Array.from(map.entries()).map(([name, items]) => ({
      name,
      items,
    }));
    return [{ name: "posteingang", items: posteingang }, ...groups];
  }, [contentFilter, filteredAndSortedEntries]);

  const renderDetailPanel = () => {
    if (!selectedEntry) return null;
    return (
      <div className="entry-list-detail-panel">
        <div className="entry-list-detail-panel-top">
          <div className="entry-list-detail-panel-header">
            <h3 className="entry-list-detail-panel-title">
              {selectedEntry.item_title}
            </h3>
          </div>

          <div className="entry-list-detail-panel-meta">
            {selectedEntry.topic && (
              <span className="entry-list-detail-panel-meta-item">
                <span className="entry-list-detail-panel-meta-label">Thema</span>
                <span>{selectedEntry.topic}</span>
              </span>
            )}
            {selectedEntry.project && (
              <span className="entry-list-detail-panel-meta-item">
                <span className="entry-list-detail-panel-meta-label">
                  Projekt
                </span>
                <span>{selectedEntry.project}</span>
              </span>
            )}
            <span className="entry-list-detail-panel-meta-item">
              <span className="entry-list-detail-panel-meta-label">Datum</span>
              <span>{formatDate(selectedEntry.date_created)}</span>
            </span>
          </div>
          <button
            type="button"
            className="secondary entry-list-detail-panel-close"
            onClick={handleClosePanel}
          >
            ✕
          </button>
        </div>

        <div className="entry-list-detail-panel-content">
          <div className="entry-list-detail-panel-content-header">
            <span className="entry-list-detail-panel-meta-label">Inhalt</span>
          </div>
          {isEditingContent ? (
            <>
              <div className="entry-list-detail-panel-content-toolbar">
                <button
                  type="button"
                  className="secondary"
                  onClick={handleBold}
                >
                  <strong>B</strong>
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={handleItalic}
                >
                  <em>I</em>
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={handleUnderline}
                >
                  <u>U</u>
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={handleInsertTodo}
                >
                  + ToDo
                </button>
              </div>
              {showMemberDropdown && (
                <div className="entry-list-detail-panel-member-dropdown">
                  {members.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className="secondary"
                      onClick={() => handleSelectMember(m)}
                    >
                      {m.name || m.email}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="secondary"
                    onClick={handleCancelMemberDropdown}
                  >
                    Abbrechen
                  </button>
                </div>
              )}
              <textarea
                ref={contentTextareaRef}
                className="entry-list-detail-panel-content-textarea"
                value={contentDraft}
                onChange={(e) => setContentDraft(e.target.value)}
                placeholder="Sitzungsnotizen hier schreiben... Text markieren (oder Cursor auf Zeile setzen) und + ToDo klicken."
              />
              <div className="entry-list-detail-panel-content-actions">
                <button
                  type="button"
                  className="primary"
                  onClick={handleSaveContent}
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
            <div className="edit-hover-wrapper">
              <p className="entry-list-detail-panel-content-text">
                {selectedEntry.content || (
                  <span className="entry-list-detail-panel-content-empty">
                    Noch kein Inhalt.
                  </span>
                )}
              </p>
              <button
                type="button"
                className="secondary edit-hover-button"
                onClick={handleEditContent}
              >
                <Pencil size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="entry-list">
      <div className="entry-list-header">
        <h2>{title}</h2>
      </div>

      {contentFilter === "without" ? (
        <button
          type="button"
          className="entry-list-new-button"
          onClick={() => setShowEntryForm(true)}
        >
          <Plus size={18} />
          Neues Traktandum
        </button>
      ) : (
        <div className="filters-container">
          <div className="filter-field">
            <label htmlFor="filter-topic-project">Thema / Projekt</label>
            <input
              type="text"
              id="filter-topic-project"
              value={filterTopicProject}
              onChange={(e) => setFilterTopicProject(e.target.value)}
              placeholder="Nach Thema oder Projekt filtern..."
            />
          </div>

          <div className="filter-field">
            <label htmlFor="filter-date-from">Datum von</label>
            <input
              type="date"
              id="filter-date-from"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
            />
          </div>

          <div className="filter-field">
            <label htmlFor="filter-date-to">Datum bis</label>
            <input
              type="date"
              id="filter-date-to"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
            />
          </div>

          <div className="filter-actions">
            <button
              type="button"
              className="secondary"
              onClick={handleClearFilters}
            >
              Filter zurücksetzen
            </button>
          </div>
        </div>
      )}

      {loading && <p>Traktanden werden geladen...</p>}

      {!loading &&
        filteredAndSortedEntries.length === 0 &&
        entries.length === 0 && (
          <div className="entry-list-empty">
            <p>Noch keine Traktanden. Erstelle dein erstes Traktandum.</p>
          </div>
        )}

      {!loading &&
        filteredAndSortedEntries.length === 0 &&
        entries.length > 0 && (
          <div className="entry-list-empty">
            <p>Keine Traktanden entsprechen deinen Filtern.</p>
          </div>
        )}

      {!loading &&
        filteredAndSortedEntries.length > 0 &&
        contentFilter === "without" && (
          <div className="grouped-list-traktanden">
            {groupedEntries.map((group) => (
              <div key={group.name} className="grouped-list-traktanden-section">
                <strong className="grouped-list-traktanden-title">
                  {group.name}
                </strong>
                {group.items.map((entry) => (
                  <div key={entry.id}>
                    <div
                      className={
                        selectedId === entry.id
                          ? "entry-list-open-item entry-list-open-item-selected"
                          : "entry-list-open-item"
                      }
                      onClick={() => handleRowClick(entry)}
                    >
                      <span className="entry-list-open-item-title">
                        {entry.item_title}
                      </span>
                      <div className="entry-list-item-actions">
                        <button
                          className="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingEntry(entry);
                          }}
                        >
                          <Pencil size={16} />
                        </button>
                        {isInPosteingang(entry) &&
                          entry.topic !== "posteingang" && (
                            <button
                              className="secondary"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveFromPosteingang(entry.id);
                              }}
                            >
                              <MailMinus size={16} />
                            </button>
                          )}
                        {!isInPosteingang(entry) && (
                          <button
                            className="secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSendToPosteingang(entry.id);
                            }}
                          >
                            <MailPlus size={16} />
                          </button>
                        )}
                        <button
                          className="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(entry.id);
                          }}
                        >
                          <Trash size={16} />
                        </button>
                      </div>
                    </div>
                    {selectedId === entry.id && renderDetailPanel()}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

      {!loading &&
        filteredAndSortedEntries.length > 0 &&
        contentFilter !== "without" && (
          <table className="entry-list-table">
            <thead>
              <tr>
                <th
                  className="entry-list-table-th-sortable"
                  onClick={() => handleSort("topic")}
                >
                  Thema / Projekt{sortIndicator("topic")}
                </th>
                <th
                  className="entry-list-table-th-sortable"
                  onClick={() => handleSort("title")}
                >
                  Traktanden{sortIndicator("title")}
                </th>
                <th
                  className="entry-list-table-th-sortable"
                  onClick={() => handleSort("date")}
                >
                  Datum{sortIndicator("date")}
                </th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedEntries.map((entry) => (
                <React.Fragment key={entry.id}>
                  <tr
                    className={
                      selectedId === entry.id
                        ? "entry-list-table-row entry-list-table-row-selected"
                        : "entry-list-table-row"
                    }
                    onClick={() => handleRowClick(entry)}
                  >
                    <td>
                      <div className="entry-list-item-topic">
                        {renderTopicIcon(entry.topic || entry.project)}
                        {entry.topic || entry.project || "-"}
                      </div>
                    </td>
                    <td>
                      <div className="entry-list-item-title">
                        {entry.item_title}
                      </div>
                    </td>
                    <td>
                      <div className="entry-list-item-date">
                        {formatDate(entry.date_created)}
                      </div>
                    </td>
                    <td>
                      <div className="entry-list-item-actions">
                        <button
                          className="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingEntry(entry);
                          }}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(entry.id);
                          }}
                        >
                          <Trash size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {selectedId === entry.id && (
                    <tr className="entry-list-table-row-detail">
                      <td colSpan={4}>{renderDetailPanel()}</td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}

      {showEntryForm && (
        <div
          className="entry-form-overlay"
          onClick={() => setShowEntryForm(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <EntryForm onCancel={() => setShowEntryForm(false)} />
          </div>
        </div>
      )}

      {editingEntry && (
        <div
          className="entry-form-overlay"
          onClick={() => setEditingEntry(null)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <EntryForm
              entry={editingEntry}
              onCancel={() => setEditingEntry(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
