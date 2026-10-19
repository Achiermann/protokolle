"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { useEntriesStore } from "../stores/useEntriesStore";
import { useWorkspacesStore } from "../stores/useWorkspacesStore";
import toast from "react-hot-toast";
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Pencil,
  MailPlus,
  MailMinus,
  Trash,
  Plus,
  Archive,
} from "lucide-react";
import EntryForm from "./EntryForm";
import TodoForm from "./TodoForm";
import RichTextEditor from "./RichTextEditor";
import { sanitizeHtml, decorateTodos } from "../../lib/richText";
import "../../styles/entry-list.css";
import "../../styles/filters.css";

// Builds a lowercased plain-text blob of an entry's searchable fields
// (title, topic, notes, creator). HTML in the notes is stripped to text so
// the word filter matches visible content, not markup.
const getSearchableText = (entry) => {
  const content = entry.content
    ? entry.content.replace(/<[^>]*>/g, " ").replace(/&[a-z]+;|&#\d+;/gi, " ")
    : "";
  return [entry.item_title, entry.topic, entry.created_by_name, content]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
};

// Sortable wrapper for one Posteingang block (card + its unfolded editor move
// as one). `children` is a render prop receiving the drag listeners/attributes
// so they can be attached to the card row only — holding inside the editor
// panel must never start a drag.
function SortablePosteingangItem({ id, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging && { position: "relative", zIndex: 2, opacity: 0.75 }),
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children({ ...attributes, ...listeners })}
    </div>
  );
}

export default function EntryList({
  contentFilter,
  title = "Alle Traktanden",
  focusEntryId = null,
}) {
  // *** VARIABLES ***
  const entries = useEntriesStore((state) => state.entries);
  const loading = useEntriesStore((state) => state.loading);
  const deleteEntry = useEntriesStore((state) => state.deleteEntry);
  const updateEntry = useEntriesStore((state) => state.updateEntry);
  const reorderPosteingang = useEntriesStore(
    (state) => state.reorderPosteingang,
  );
  const members = useWorkspacesStore((state) => state.members);
  const fetchMembers = useWorkspacesStore((state) => state.fetchMembers);

  const [filterSearch, setFilterSearch] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  // Deep link from the ToDo list: the linked entry starts out selected (its
  // panel unfolds as soon as the entry is in the cache). The component
  // remounts on every view switch, so initialising from the prop is enough.
  const [selectedId, setSelectedId] = useState(focusEntryId);
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [contentDraft, setContentDraft] = useState("");
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [showTodoForm, setShowTodoForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);

  // True while (and briefly after) a Posteingang drag, so the card's onClick
  // doesn't toggle the editor when the user releases a drag.
  const justDraggedRef = useRef(false);

  // Guards the deep-link scroll so it happens exactly once per mount.
  const didFocusScrollRef = useRef(false);

  // Mouse: dragging starts as soon as the pressed card moves 5px, so it feels
  // instant; a clean click (no movement) still opens the editor. Touch keeps
  // press-and-hold instead — instant activation would hijack finger-scrolling
  // over the cards.
  const dragSensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
  );

  // *** FUNCTIONS/HANDLERS ***
  // Scroll the deep-linked row into view once it is in the DOM (depends on
  // `entries` so it retries until the cache has delivered the row).
  useEffect(() => {
    if (!focusEntryId || didFocusScrollRef.current) return;
    const row = document.getElementById(`entry-row-${focusEntryId}`);
    if (!row) return;
    didFocusScrollRef.current = true;
    row.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusEntryId, entries]);

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

  const loadMembers = async () => {
    try {
      await fetchMembers();
    } catch (error) {
      toast.error("Mitglieder konnten nicht geladen werden");
    }
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
      // New arrivals go to the end of the Posteingang: one past the highest
      // position in use (re-added items don't remember their old spot).
      const nextPosition =
        entries.reduce(
          (max, entry) =>
            isInPosteingang(entry) &&
            typeof entry.posteingang_position === "number"
              ? Math.max(max, entry.posteingang_position)
              : max,
          -1,
        ) + 1;
      await updateEntry(id, {
        in_posteingang: true,
        posteingang_position: nextPosition,
      });
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

  const handleArchive = async (id) => {
    try {
      await updateEntry(id, { archived: true });
      if (selectedId === id) setSelectedId(null);
      toast.success("Traktandum archiviert");
    } catch (error) {
      toast.error("Archivieren fehlgeschlagen");
    }
  };

  const isInPosteingang = (entry) => {
    return entry.in_posteingang || entry.topic === "posteingang";
  };

  const handleClearFilters = () => {
    setFilterSearch("");
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
    if (column === "topic") return (entry.topic || "").toLowerCase();
    // `scheduled` is an ISO date string, so string order is date order; "~"
    // sorts after any digit, pushing unscheduled entries to the end.
    if (column === "scheduled") return entry.scheduled || "~";
    return new Date(entry.date_modified).getTime();
  };

  const sortIndicator = (column) => {
    if (sortBy !== column) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  };

  const getTopicColorClass = (topic) => {
    if (!topic) return "";
    let hash = 0;
    for (let i = 0; i < topic.length; i++) {
      hash = (hash * 31 + topic.charCodeAt(i)) | 0;
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

  const filteredAndSortedEntries = useMemo(() => {
    let result = [...entries];

    if (contentFilter === "with") {
      result = result.filter((entry) => entry.content && !entry.archived);
    } else if (contentFilter === "without") {
      result = result.filter((entry) => !entry.content);
    }

    if (filterSearch.trim()) {
      const searchTerm = filterSearch.trim().toLowerCase();
      result = result.filter((entry) =>
        getSearchableText(entry).includes(searchTerm),
      );
    }

    if (filterDateFrom) {
      const fromDate = new Date(filterDateFrom);
      result = result.filter(
        (entry) => new Date(entry.date_modified) >= fromDate,
      );
    }

    if (filterDateTo) {
      const toDate = new Date(filterDateTo);
      toDate.setHours(23, 59, 59, 999);
      result = result.filter(
        (entry) => new Date(entry.date_modified) <= toDate,
      );
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
    filterSearch,
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
        const group = entry.topic || "ohne thema";
        if (!map.has(group)) map.set(group, []);
        map.get(group).push(entry);
      }
    }
    // The Posteingang always shows the manual drag order. Items that never got
    // a position (NULL) go to the end, keeping their date order among
    // themselves (Array.sort is stable); they get real positions on the first
    // drag.
    posteingang.sort((a, b) => {
      const posA = a.posteingang_position ?? Number.POSITIVE_INFINITY;
      const posB = b.posteingang_position ?? Number.POSITIVE_INFINITY;
      return posA === posB ? 0 : posA - posB;
    });
    const groups = Array.from(map.entries()).map(([name, items]) => ({
      name,
      items,
    }));
    return [{ name: "posteingang", items: posteingang }, ...groups];
  }, [contentFilter, filteredAndSortedEntries]);

  const handleDragStart = () => {
    justDraggedRef.current = true;
  };

  // Reset the click guard shortly after the drag settles — the browser fires
  // the card's click right after the drop, and that click must be swallowed.
  const releaseClickGuard = () => {
    window.setTimeout(() => {
      justDraggedRef.current = false;
    }, 150);
  };

  const handlePosteingangDragEnd = ({ active, over }) => {
    releaseClickGuard();
    if (!over || active.id === over.id) return;
    const items =
      groupedEntries.find((group) => group.name === "posteingang")?.items ?? [];
    const oldIndex = items.findIndex((entry) => entry.id === active.id);
    const newIndex = items.findIndex((entry) => entry.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    // Renumber the whole section 0..n-1 and persist only what changed; this
    // also assigns real positions to items that were still unpositioned.
    const positionsById = {};
    arrayMove(items, oldIndex, newIndex).forEach((entry, position) => {
      if (entry.posteingang_position !== position) {
        positionsById[entry.id] = position;
      }
    });
    if (Object.keys(positionsById).length === 0) return;
    reorderPosteingang(positionsById).catch(() => {
      toast.error("Reihenfolge konnte nicht gespeichert werden");
    });
  };

  // One Traktandum card in the grouped list. In the Posteingang the dnd-kit
  // press-and-hold listeners come in via dragProps and sit on this row (not on
  // the unfolded editor below it).
  const renderTraktandumCard = (entry, index, group, dragProps = {}) => (
    <div
      id={`entry-row-${entry.id}`}
      className={
        selectedId === entry.id
          ? "entry-list-open-item entry-list-open-item-selected"
          : "entry-list-open-item"
      }
      onClick={() => {
        if (justDraggedRef.current) return;
        if (selectedId === entry.id) {
          setSelectedId(null);
          setIsEditingContent(false);
        } else {
          setSelectedId(entry.id);
          setIsEditingContent(true);
          setContentDraft(entry.content || "");
        }
      }}
      {...dragProps}
    >
      <span className="entry-list-open-item-title">
        {group.name === "posteingang" && `${index + 1}. `}
        {entry.item_title}
        {(entry.created_by_name || entry.scheduled) && (
          <span className="entry-list-item-creator">
            {" - "}
            {[
              entry.created_by_name && `erstellt von ${entry.created_by_name}`,
              entry.scheduled && `geplant auf ${formatDate(entry.scheduled)}`,
            ]
              .filter(Boolean)
              .join(", ")}
          </span>
        )}
      </span>
      <div className="entry-list-item-actions">
        <button
          className="secondary"
          onClick={(e) => {
            e.stopPropagation();
            setEditingEntry(entry);
          }}
        >
          <Pencil size={14} />
        </button>
        {isInPosteingang(entry) && entry.topic !== "posteingang" && (
          <button
            className="secondary"
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveFromPosteingang(entry.id);
            }}
          >
            <MailMinus size={14} />
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
            <MailPlus size={14} />
          </button>
        )}
        <button
          className="secondary"
          onClick={(e) => {
            e.stopPropagation();
            handleDelete(entry.id);
          }}
        >
          <Trash size={14} />
        </button>
      </div>
    </div>
  );

  const renderContentEditor = () => {
    if (!selectedEntry) return null;
    return (
      <div className="entry-list-detail-panel">
        <div className="entry-list-detail-panel-content">
          <RichTextEditor
            value={contentDraft}
            onChange={setContentDraft}
            members={members}
            onRequestMembers={loadMembers}
            placeholder="Sitzungsnotizen hier schreiben... Text markieren und B/I/U oder + ToDo klicken."
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
              onClick={handleClosePanel}
            >
              Abbrechen
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderDetailPanel = () => {
    if (!selectedEntry) return null;
    return (
      <div className="entry-list-detail-panel">
        <div className="entry-list-detail-panel-top" onClick={handleClosePanel}>
          <div className="entry-list-detail-panel-header">
            <h3 className="entry-list-detail-panel-title">
              {selectedEntry.item_title}
              {selectedEntry.created_by_name && (
                <span className="entry-list-item-creator">
                  {" - "}
                  {selectedEntry.created_by_name}
                </span>
              )}
            </h3>
          </div>

          <div className="entry-list-detail-panel-meta">
            {selectedEntry.topic && (
              <span className="entry-list-detail-panel-meta-item">
                <span className="entry-list-detail-panel-meta-label">
                  Thema
                </span>
                <span>{selectedEntry.topic}</span>
              </span>
            )}
            <span className="entry-list-detail-panel-meta-item">
              <span className="entry-list-detail-panel-meta-label">
                Geändert
              </span>
              <span>{formatDate(selectedEntry.date_modified)}</span>
            </span>
            <span className="entry-list-detail-panel-meta-item">
              <span className="entry-list-detail-panel-meta-label">
                Erstellt
              </span>
              <span>{formatDate(selectedEntry.date_created)}</span>
            </span>
            {selectedEntry.scheduled && (
              <span className="entry-list-detail-panel-meta-item">
                <span className="entry-list-detail-panel-meta-label">
                  Geplant
                </span>
                <span>{formatDate(selectedEntry.scheduled)}</span>
              </span>
            )}
          </div>
          <div className="entry-list-item-actions">
            <button
              type="button"
              className="secondary"
              onClick={(e) => {
                e.stopPropagation();
                setEditingEntry(selectedEntry);
              }}
            >
              <Pencil size={16} />
            </button>
            <button
              type="button"
              className="secondary"
              onClick={(e) => {
                e.stopPropagation();
                handleArchive(selectedEntry.id);
              }}
            >
              <Archive size={16} />
            </button>
            <button
              type="button"
              className="secondary"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(selectedEntry.id);
              }}
            >
              <Trash size={16} />
            </button>
          </div>
        </div>

        <div className="entry-list-detail-panel-content">
          <div className="entry-list-detail-panel-content-header">
            <span className="entry-list-detail-panel-meta-label">Inhalt</span>
          </div>
          {isEditingContent ? (
            <>
              <RichTextEditor
                value={contentDraft}
                onChange={setContentDraft}
                members={members}
                onRequestMembers={loadMembers}
                placeholder="Sitzungsnotizen hier schreiben... Text markieren und B/I/U oder + ToDo klicken."
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
              {selectedEntry.content ? (
                <div
                  className="entry-list-detail-panel-content-text"
                  dangerouslySetInnerHTML={{
                    __html: decorateTodos(sanitizeHtml(selectedEntry.content)),
                  }}
                />
              ) : (
                <p className="entry-list-detail-panel-content-text">
                  <span className="entry-list-detail-panel-content-empty">
                    Noch kein Inhalt.
                  </span>
                </p>
              )}
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
      {contentFilter === "without" ? (
        <>
          <div className="entry-list-header">
            <h2>{title}</h2>
          </div>
          <button
            type="button"
            className="entry-list-new-button"
            onClick={() => setShowEntryForm(true)}
          >
            <Plus size={18} />
            Neues Traktandum
          </button>
          <button
            type="button"
            className="entry-list-new-button"
            onClick={() => setShowTodoForm(true)}
          >
            <Plus size={18} />
            Neues ToDo
          </button>
        </>
      ) : (
        <div className="entry-list-toolbar">
          <div className="entry-list-header">
            <h2>{title}</h2>
          </div>
          <div className="filters-container">
            <div className="filter-field">
              <label htmlFor="filter-search">Suche</label>
              <input
                type="text"
                id="filter-search"
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                placeholder="Nach Begriff filtern..."
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
            {groupedEntries.map((group) =>
              group.name === "posteingang" ? (
                <div
                  key={group.name}
                  className="grouped-list-traktanden-section grouped-list-traktanden-section-posteingang"
                >
                  <strong
                    className={`grouped-list-traktanden-title entry-list-item-topic ${getTopicColorClass(group.name)}`}
                  >
                    posteingang / aktuelles meeting
                  </strong>
                  <DndContext
                    sensors={dragSensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handlePosteingangDragEnd}
                    onDragCancel={releaseClickGuard}
                  >
                    <SortableContext
                      items={group.items.map((entry) => entry.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {group.items.map((entry, index) => (
                        <SortablePosteingangItem key={entry.id} id={entry.id}>
                          {(dragProps) => (
                            <>
                              {renderTraktandumCard(
                                entry,
                                index,
                                group,
                                dragProps,
                              )}
                              {selectedId === entry.id && renderContentEditor()}
                            </>
                          )}
                        </SortablePosteingangItem>
                      ))}
                    </SortableContext>
                  </DndContext>
                </div>
              ) : (
                <div
                  key={group.name}
                  className="grouped-list-traktanden-section"
                >
                  <strong
                    className={`grouped-list-traktanden-title entry-list-item-topic ${getTopicColorClass(group.name)}`}
                  >
                    {group.name}
                  </strong>
                  {group.items.map((entry, index) => (
                    <div key={entry.id}>
                      {renderTraktandumCard(entry, index, group)}
                      {selectedId === entry.id && renderContentEditor()}
                    </div>
                  ))}
                </div>
              ),
            )}
          </div>
        )}

      {!loading &&
        filteredAndSortedEntries.length > 0 &&
        contentFilter !== "without" && (
          <table className="entry-list-table">
            <thead>
              <tr>
                <th
                  className="entry-list-table-th-sortable table-header-cell"
                  onClick={() => handleSort("topic")}
                >
                  Thema{sortIndicator("topic")}
                </th>
                <th
                  className="entry-list-table-th-sortable table-header-cell"
                  onClick={() => handleSort("title")}
                >
                  Traktanden{sortIndicator("title")}
                </th>
                <th
                  className="entry-list-table-th-sortable table-header-cell"
                  onClick={() => handleSort("date")}
                >
                  Datum{sortIndicator("date")}
                </th>
                <th
                  className="entry-list-table-th-sortable table-header-cell"
                  onClick={() => handleSort("scheduled")}
                >
                  Geplant{sortIndicator("scheduled")}
                </th>
                <th className="table-header-cell">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedEntries.map((entry) => (
                <React.Fragment key={entry.id}>
                  <tr
                    id={`entry-row-${entry.id}`}
                    className="entry-list-table-row"
                    onClick={() => handleRowClick(entry)}
                  >
                    <td>
                      <div
                        className={
                          "entry-list-item-topic " +
                          getTopicColorClass(entry.topic)
                        }
                      >
                        {entry.topic || "-"}
                      </div>
                    </td>
                    <td>
                      <div className="entry-list-item-title">
                        {entry.item_title}
                        {entry.created_by_name && (
                          <span className="entry-list-item-creator">
                            {" - "}
                            {entry.created_by_name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="entry-list-item-date">
                        {formatDate(entry.date_modified)}
                      </div>
                    </td>
                    <td>
                      <div className="entry-list-item-date">
                        {entry.scheduled ? formatDate(entry.scheduled) : "-"}
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
                            handleArchive(entry.id);
                          }}
                        >
                          <Archive size={16} />
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
                      <td colSpan={5}>{renderDetailPanel()}</td>
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

      {showTodoForm && (
        <div
          className="entry-form-overlay"
          onClick={() => setShowTodoForm(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <TodoForm onCancel={() => setShowTodoForm(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
