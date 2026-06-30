"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  RotateCcw,
  MessageSquareCheck,
  Pencil,
  Trash,
  Plus,
} from "lucide-react";
import toast from "react-hot-toast";
import { useTodosStore } from "../stores/useTodosStore";
import RichTextEditor from "./RichTextEditor";
import TodoForm from "./TodoForm";
import { sanitizeHtml, decorateTodos } from "../../lib/richText";
import "../../styles/todo-list.css";
// Member names and the comment panel reuse entry-list styling.
import "../../styles/entry-list.css";

// A comment counts as present only when it has visible text (an empty editor can
// emit stray markup like <br>). This drives the "in Bearbeitung" bucket and the
// message icon.
const commentText = (comment) =>
  (comment || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .trim();
const hasComment = (todo) => commentText(todo.comment).length > 0;

export default function TodoList() {
  // *** VARIABLES ***
  const todos = useTodosStore((state) => state.todos);
  const loading = useTodosStore((state) => state.loading);
  const ensureTodos = useTodosStore((state) => state.ensureTodos);
  const updateTodo = useTodosStore((state) => state.updateTodo);
  const deleteTodo = useTodosStore((state) => state.deleteTodo);

  const [selectedId, setSelectedId] = useState(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [isEditingComment, setIsEditingComment] = useState(false);
  const [showTodoForm, setShowTodoForm] = useState(false);

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

  // Normalise to a single key so different casings of the same person map to
  // the same colour and the same display label.
  const normalizeMemberKey = (name) => (name || "").trim().toLowerCase();

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

  // "Offen" holds every open todo (commented or not); commented ones just show
  // the message icon. "Erledigt" holds the done ones.
  const openTodos = useMemo(() => todos.filter((t) => !t.done), [todos]);
  const doneTodos = useMemo(() => todos.filter((t) => t.done), [todos]);

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
          <th className="table-header-cell">Für</th>
          <th className="table-header-cell">ToDo</th>
          <th className="table-header-cell">Thema</th>
          <th className="table-header-cell">Datum</th>
          <th className="todo-list-table-th-actions table-header-cell"></th>
        </tr>
      </thead>
      <tbody>
        {list.map((todo) => (
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
        ))}
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

      <div className="todo-list-header">
        <h2>Offen</h2>
      </div>

      {loading && <p>ToDos werden geladen...</p>}

      {!loading && todos.length === 0 && (
        <div className="todo-list-empty">
          <p>Noch keine ToDos.</p>
        </div>
      )}

      {!loading && openTodos.length > 0 && renderTodoTable(openTodos, "open")}

      {!loading && doneTodos.length > 0 && (
        <>
          <div className="todo-list-header todo-list-header-done">
            <h2>Erledigt</h2>
          </div>
          {renderTodoTable(doneTodos, "done")}
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
