"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  RotateCcw,
  MessageSquareCheck,
  Pencil,
  Trash,
  Plus,
  ChevronDown,
  ChevronUp,
  ClipboardList,
} from "lucide-react";
import toast from "react-hot-toast";
import { useTodosStore } from "../stores/useTodosStore";
import { useEntriesStore } from "../stores/useEntriesStore";
import RichTextEditor from "./RichTextEditor";
import TodoForm from "./TodoForm";
import { sanitizeHtml, decorateTodos } from "../../lib/richText";
import "../../styles/todo-list.css";
// Member names, the comment panel, toolbar and filters reuse entry-list styling.
import "../../styles/entry-list.css";
import "../../styles/filters.css";

// A comment counts as present only when it has visible text (an empty editor can
// emit stray markup like <br>). This drives the "in Bearbeitung" bucket and the
// message icon.
const commentText = (comment) =>
  (comment || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .trim();
const hasComment = (todo) => commentText(todo.comment).length > 0;

// Lowercased plain-text blob of a todo's searchable fields (title, assignee,
// topic, comment). Mirrors EntryList.getSearchableText so the word filter
// behaves the same in both lists.
const getSearchableText = (todo) =>
  [todo.title, todo.assignee, todo.topic, commentText(todo.comment)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

// Normalise to a single key so different casings of the same person map to
// the same colour and the same display label.
const normalizeMemberKey = (name) => (name || "").trim().toLowerCase();

const getSortValue = (todo, column) => {
  if (column === "assignee") return normalizeMemberKey(todo.assignee);
  if (column === "title") return (todo.title || "").toLowerCase();
  if (column === "topic") return (todo.topic || "").toLowerCase();
  return new Date(todo.date_created).getTime();
};

export default function TodoList({ onOpenEntry }) {
  // *** VARIABLES ***
  const todos = useTodosStore((state) => state.todos);
  const loading = useTodosStore((state) => state.loading);
  const ensureTodos = useTodosStore((state) => state.ensureTodos);
  const updateTodo = useTodosStore((state) => state.updateTodo);
  const deleteTodo = useTodosStore((state) => state.deleteTodo);
  const entries = useEntriesStore((state) => state.entries);

  const [selectedId, setSelectedId] = useState(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [isEditingComment, setIsEditingComment] = useState(false);
  const [showTodoForm, setShowTodoForm] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [filterSearch, setFilterSearch] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [sortBy, setSortBy] = useState("date");
  const [sortDir, setSortDir] = useState("desc");

  // *** FUNCTIONS/HANDLERS ***
  useEffect(() => {
    ensureTodos();
  }, [ensureTodos]);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("de-DE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  // Display label: every name starts with a capital letter.
  const formatMemberName = (name) =>
    normalizeMemberKey(name)
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

  // Reuse the same highlighter marker the entry-list topics use.
  const getMemberColorClass = (name) => {
    const key = normalizeMemberKey(name);
    if (!key) return "";
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (hash * 31 + key.charCodeAt(i)) | 0;
    }
    const index = Math.abs(hash) % 10;
    return `entry-list-item-topic-c${index}`;
  };

  // Identical hash to EntryList.getTopicColorClass so a topic shows the same
  // colour chip here as it does in the entry list.
  const getTopicColorClass = (topic) => {
    if (!topic) return "";
    let hash = 0;
    for (let i = 0; i < topic.length; i++) {
      hash = (hash * 31 + topic.charCodeAt(i)) | 0;
    }
    return `entry-list-item-topic-c${Math.abs(hash) % 10}`;
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

  const sortIndicator = (column) => {
    if (sortBy !== column) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  };

  // Filters and sorting apply to the whole list before it is split into the
  // "Offen" and "Erledigt" buckets, so both tables share one state.
  const filteredAndSortedTodos = useMemo(() => {
    let result = [...todos];

    if (filterSearch.trim()) {
      const searchTerm = filterSearch.trim().toLowerCase();
      result = result.filter((todo) =>
        getSearchableText(todo).includes(searchTerm),
      );
    }

    if (filterDateFrom) {
      const fromDate = new Date(filterDateFrom);
      result = result.filter((todo) => new Date(todo.date_created) >= fromDate);
    }

    if (filterDateTo) {
      const toDate = new Date(filterDateTo);
      toDate.setHours(23, 59, 59, 999);
      result = result.filter((todo) => new Date(todo.date_created) <= toDate);
    }

    result.sort((a, b) => {
      const valA = getSortValue(a, sortBy);
      const valB = getSortValue(b, sortBy);
      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [todos, filterSearch, filterDateFrom, filterDateTo, sortBy, sortDir]);

  // Parent entries of marker-todos, for the "Zum Traktandum" jump. The entries
  // cache holds every entry (the Sidebar keeps it warm), archived ones included.
  const entriesById = useMemo(
    () => new Map(entries.map((entry) => [entry.id, entry])),
    [entries],
  );

  // "Offen" holds every open todo (commented or not); commented ones just show
  // the message icon. "Erledigt" holds the done ones.
  const openTodos = useMemo(
    () => filteredAndSortedTodos.filter((t) => !t.done),
    [filteredAndSortedTodos],
  );
  const doneTodos = useMemo(
    () => filteredAndSortedTodos.filter((t) => t.done),
    [filteredAndSortedTodos],
  );

  const handleTitleClick = (todo) => {
    if (selectedId === todo.id) {
      setSelectedId(null);
      setIsEditingComment(false);
    } else {
      setSelectedId(todo.id);
      setCommentDraft(todo.comment || "");
      // A commented todo unfolds to its read view (with an edit button); an
      // uncommented one opens straight into the editor.
      setIsEditingComment(!hasComment(todo));
    }
  };

  const handleEditComment = (todo) => {
    setCommentDraft(todo.comment || "");
    setIsEditingComment(true);
  };

  const handleToggleDone = async (todo) => {
    try {
      await updateTodo(todo.id, { done: !todo.done });
    } catch (error) {
      toast.error("Aktualisierung fehlgeschlagen");
    }
  };

  const handleDelete = async (todo) => {
    if (!confirm("ToDo wirklich löschen?")) return;
    try {
      await deleteTodo(todo.id);
      if (selectedId === todo.id) setSelectedId(null);
      toast.success("ToDo gelöscht");
    } catch (error) {
      toast.error("ToDo konnte nicht gelöscht werden");
    }
  };

  const handleSaveComment = async () => {
    try {
      const updated = await updateTodo(selectedId, { comment: commentDraft });
      // Stay unfolded showing the saved comment as read text; if it was cleared
      // there is nothing to read, so collapse.
      if (updated && hasComment(updated)) {
        setIsEditingComment(false);
      } else {
        setSelectedId(null);
        setIsEditingComment(false);
      }
      toast.success("Kommentar gespeichert");
    } catch (error) {
      toast.error("Kommentar konnte nicht gespeichert werden");
    }
  };

  const handleCancelComment = (todo) => {
    // Back to read view if there is a saved comment to show, else collapse.
    if (hasComment(todo)) {
      setIsEditingComment(false);
    } else {
      setSelectedId(null);
      setIsEditingComment(false);
    }
  };

  const renderMemberCell = (todo) => {
    const name = formatMemberName(todo.assignee);
    if (!name) return <span className="todo-list-item-date">-</span>;
    return (
      <span
        className={`entry-list-item-topic ${getMemberColorClass(todo.assignee)}`}
      >
        {name}
      </span>
    );
  };

  const renderCommentPanel = (todo) => (
    <div className="entry-list-detail-panel">
      <div className="entry-list-detail-panel-content">
        {isEditingComment ? (
          <>
            <RichTextEditor
              key={todo.id}
              value={todo.comment || ""}
              onChange={setCommentDraft}
              showTodoButton={false}
              placeholder="Kommentar schreiben..."
            />
            <div className="entry-list-detail-panel-content-actions">
              <button
                type="button"
                className="primary"
                onClick={handleSaveComment}
              >
                Speichern
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => handleCancelComment(todo)}
              >
                Abbrechen
              </button>
            </div>
          </>
        ) : (
          <div className="edit-hover-wrapper">
            <div
              className="entry-list-detail-panel-content-text"
              dangerouslySetInnerHTML={{
                __html: decorateTodos(sanitizeHtml(todo.comment)),
              }}
            />
            <button
              type="button"
              className="secondary edit-hover-button"
              onClick={() => handleEditComment(todo)}
            >
              <Pencil size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // One table for each bucket. The "done" variant swaps the toggle checkbox for
  // a restore button; every row's title unfolds its comment panel.
  const renderTodoTable = (list, variant) => (
    <table className="todo-list-table">
      <thead>
        <tr>
          <th className="todo-list-table-th-check table-header-cell"></th>
          <th
            className="entry-list-table-th-sortable table-header-cell"
            onClick={() => handleSort("assignee")}
          >
            Für{sortIndicator("assignee")}
          </th>
          <th
            className="entry-list-table-th-sortable table-header-cell"
            onClick={() => handleSort("title")}
          >
            ToDo{sortIndicator("title")}
          </th>
          <th
            className="entry-list-table-th-sortable table-header-cell"
            onClick={() => handleSort("topic")}
          >
            Thema{sortIndicator("topic")}
          </th>
          <th
            className="entry-list-table-th-sortable table-header-cell"
            onClick={() => handleSort("date")}
          >
            Datum{sortIndicator("date")}
          </th>
          <th className="todo-list-table-th-actions table-header-cell"></th>
        </tr>
      </thead>
      <tbody>
        {list.map((todo) => {
          // The jump button needs a parent that is actually reachable: in the
          // Archiv view when archived, otherwise in Alle Traktanden (which
          // only lists entries with content).
          const linkedEntry = todo.entry_id
            ? entriesById.get(todo.entry_id)
            : null;
          const canOpenEntry =
            linkedEntry && (linkedEntry.archived || linkedEntry.content);
          return (
            <React.Fragment key={todo.id}>
              <tr
                className="todo-list-table-row"
                onClick={() => handleTitleClick(todo)}
              >
                <td
                  className="todo-list-table-td-check"
                  onClick={(e) => e.stopPropagation()}
                >
                  {variant === "done" ? (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => handleToggleDone(todo)}
                      title="Zurück zu offen"
                    >
                      <RotateCcw size={14} />
                    </button>
                  ) : (
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={() => handleToggleDone(todo)}
                    />
                  )}
                </td>
                <td>{renderMemberCell(todo)}</td>
                <td>
                  <div className="todo-list-item-title-wrap">
                    {hasComment(todo) && (
                      <MessageSquareCheck
                        size={16}
                        className="todo-list-item-title-icon"
                      />
                    )}
                    <span className="todo-list-item-title">{todo.title}</span>
                  </div>
                </td>
                <td>
                  <div
                    className={`entry-list-item-topic ${getTopicColorClass(todo.topic)}`}
                  >
                    {todo.topic || "-"}
                  </div>
                </td>
                <td>
                  <div className="todo-list-item-date">
                    {formatDate(todo.date_created)}
                  </div>
                </td>
                <td
                  className="todo-list-table-td-actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  {canOpenEntry && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => onOpenEntry(linkedEntry)}
                      title="Zum Traktandum"
                    >
                      <ClipboardList size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => handleDelete(todo)}
                    title="ToDo löschen"
                  >
                    <Trash size={14} />
                  </button>
                </td>
              </tr>
              {selectedId === todo.id && (
                <tr className="todo-list-table-row-detail">
                  <td colSpan={6}>{renderCommentPanel(todo)}</td>
                </tr>
              )}
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );

  return (
    <div className="todo-list">
      <button
        type="button"
        className="entry-list-new-button"
        onClick={() => setShowTodoForm(true)}
      >
        <Plus size={18} />
        Neues ToDo
      </button>

      <div className="entry-list-toolbar">
        <div className="todo-list-header">
          <h2>Offen</h2>
        </div>
        <div className="filters-container">
          <div className="filter-field">
            <label htmlFor="todo-filter-search">Suche</label>
            <input
              type="text"
              id="todo-filter-search"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              placeholder="Nach Begriff filtern..."
            />
          </div>

          <div className="filter-field">
            <label htmlFor="todo-filter-date-from">Datum von</label>
            <input
              type="date"
              id="todo-filter-date-from"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
            />
          </div>

          <div className="filter-field">
            <label htmlFor="todo-filter-date-to">Datum bis</label>
            <input
              type="date"
              id="todo-filter-date-to"
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

      {loading && <p>ToDos werden geladen...</p>}

      {!loading && todos.length === 0 && (
        <div className="todo-list-empty">
          <p>Noch keine ToDos.</p>
        </div>
      )}

      {!loading && todos.length > 0 && filteredAndSortedTodos.length === 0 && (
        <div className="todo-list-empty">
          <p>Keine ToDos entsprechen deinen Filtern.</p>
        </div>
      )}

      {!loading && openTodos.length > 0 && renderTodoTable(openTodos, "open")}

      {!loading && doneTodos.length > 0 && (
        <>
          <div
            className="todo-list-header todo-list-header-done"
            onClick={() => setShowDone(!showDone)}
          >
            <h2>Erledigt ({doneTodos.length})</h2>
            {showDone ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
          {showDone && renderTodoTable(doneTodos, "done")}
        </>
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
