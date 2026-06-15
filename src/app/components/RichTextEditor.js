"use client";

import { useEffect, useRef, useState } from "react";
import { sanitizeHtml, decorateTodos } from "../../lib/richText";
import "../../styles/entry-list.css";

// Highlight colours. Each value is also a CSS class (see entry-list.css) that
// styles both the toolbar swatch and the <mark> in saved content.
const MARKER_COLORS = [
  { className: "marker-yellow", label: "Gelb markieren" },
  { className: "marker-green", label: "Grün markieren" },
  { className: "marker-blue", label: "Blau markieren" },
  { className: "marker-pink", label: "Pink markieren" },
];

export default function RichTextEditor({
  value,
  onChange,
  members,
  onRequestMembers,
  placeholder,
}) {
  // *** VARIABLES ***
  const editorRef = useRef(null);
  const markerRef = useRef(null);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [showColorDropdown, setShowColorDropdown] = useState(false);
  const [activeColor, setActiveColor] = useState(MARKER_COLORS[0].className);

  // *** FUNCTIONS/HANDLERS ***
  // contentEditable is uncontrolled: seed the DOM once on mount so the caret
  // doesn't jump on every keystroke. `value` is only read back out via onChange.
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = decorateTodos(sanitizeHtml(value || ""));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close the colour dropdown when clicking anywhere outside the marker control.
  useEffect(() => {
    if (!showColorDropdown) return;
    const onDocMouseDown = (e) => {
      if (markerRef.current && !markerRef.current.contains(e.target)) {
        setShowColorDropdown(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [showColorDropdown]);

  const emitChange = () => {
    if (editorRef.current) onChange(sanitizeHtml(editorRef.current.innerHTML));
  };

  // execCommand is deprecated but remains the only dependency-free way to apply
  // bold/italic/underline to the current selection across browsers. No rich-text
  // MCP/library is available, so it is preferred over adding an editor dependency.
  const format = (command) => {
    document.execCommand(command, false, null);
    emitChange();
  };

  const handleBold = () => format("bold");
  const handleItalic = () => format("italic");
  const handleUnderline = () => format("underline");

  // Keyboard shortcuts (Cmd on Mac, Ctrl elsewhere): B/I/U formatting and
  // undo/redo. Undo/redo use the browser's native edit history, so they cover
  // typing and B/I/U but not the direct-DOM highlight/todo edits.
  const handleKeyDown = (e) => {
    if (!e.metaKey && !e.ctrlKey) return;
    const key = e.key.toLowerCase();
    if (key === "b") {
      e.preventDefault();
      format("bold");
    } else if (key === "i") {
      e.preventDefault();
      format("italic");
    } else if (key === "u") {
      e.preventDefault();
      format("underline");
    } else if (key === "z") {
      e.preventDefault();
      document.execCommand(e.shiftKey ? "redo" : "undo", false, null);
      emitChange();
    }
  };

  // The <mark> enclosing the whole selection, if any (the highlighted phrase the
  // user re-clicked). Null when the selection is unmarked or spans a mix.
  const getEnclosingMark = (range) => {
    const editor = editorRef.current;
    let node = range.commonAncestorContainer;
    while (node && node !== editor) {
      if (node.nodeType === 1 && node.tagName === "MARK") return node;
      node = node.parentNode;
    }
    return null;
  };

  const unwrap = (mark) => {
    const parent = mark.parentNode;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
  };

  // Highlight the selection with `className`. If it is already highlighted in
  // that same colour, the highlight is removed (toggle); a different colour
  // recolours it instead.
  const applyColor = (className) => {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;

    const enclosing = getEnclosingMark(range);
    if (enclosing) {
      const current = MARKER_COLORS.find((c) =>
        enclosing.classList.contains(c.className),
      );
      if (current && current.className === className) {
        unwrap(enclosing); // same colour → toggle off
      } else {
        enclosing.className = className; // different colour → recolour
      }
      emitChange();
      return;
    }

    // Unmarked (or mixed) selection: drop any fully-selected nested marks, then
    // wrap the cleaned contents in a single new mark.
    const frag = range.extractContents();
    frag.querySelectorAll("mark").forEach(unwrap);
    const mark = document.createElement("mark");
    mark.className = className;
    mark.appendChild(frag);
    range.insertNode(mark);
    selection.removeAllRanges();
    const next = document.createRange();
    next.selectNodeContents(mark);
    selection.addRange(next);
    emitChange();
  };

  const handleApplyActiveColor = () => {
    setShowColorDropdown(false);
    applyColor(activeColor);
  };

  const handlePickColor = (className) => {
    setActiveColor(className);
    setShowColorDropdown(false);
    applyColor(className);
  };

  const handleToggleColorDropdown = () => setShowColorDropdown((v) => !v);

  const activeMarker =
    MARKER_COLORS.find((c) => c.className === activeColor) || MARKER_COLORS[0];

  // Insert the todo tag wrapped in a todo-line span so it is highlighted
  // immediately and the task text typed next stays inside the highlight. The
  // span is throwaway (stripped on save, re-derived on load by decorateTodos).
  const insertTodoTag = (text) => {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = window.getSelection();
    let range;
    if (
      selection &&
      selection.rangeCount &&
      editor.contains(selection.anchorNode)
    ) {
      range = selection.getRangeAt(0);
    } else {
      range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
    }
    range.deleteContents();
    const span = document.createElement("span");
    span.className = "todo-line";
    span.textContent = text;
    range.insertNode(span);
    const next = document.createRange();
    next.selectNodeContents(span);
    next.collapse(false);
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(next);
    }
    emitChange();
  };

  const handleInsertTodo = async () => {
    if (members.length === 0) await onRequestMembers();
    setShowMemberDropdown(true);
  };

  const handleSelectMember = (member) => {
    const rawName = member.name || member.email.split("@")[0];
    const nameTag = rawName.replace(/\s+/g, "_");
    insertTodoTag(`/todo@${nameTag} `);
    setShowMemberDropdown(false);
  };

  const handleCancelMemberDropdown = () => setShowMemberDropdown(false);

  // Pressing a toolbar/dropdown button must not blur the editor, or execCommand
  // and caret insertion would lose the selection they act on.
  const keepSelection = (e) => e.preventDefault();

  // return (JSX)
  return (
    <>
      <div className="entry-list-detail-panel-content-toolbar">
        <button
          type="button"
          className="secondary"
          onMouseDown={keepSelection}
          onClick={handleBold}
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          className="secondary"
          onMouseDown={keepSelection}
          onClick={handleItalic}
        >
          <em>I</em>
        </button>
        <button
          type="button"
          className="secondary"
          onMouseDown={keepSelection}
          onClick={handleUnderline}
        >
          <u>U</u>
        </button>
        <div className="entry-list-marker" ref={markerRef}>
          <button
            type="button"
            className={`entry-list-marker-button ${activeMarker.className}`}
            aria-label={activeMarker.label}
            title={activeMarker.label}
            onMouseDown={keepSelection}
            onClick={handleApplyActiveColor}
          />
          <button
            type="button"
            className="secondary entry-list-marker-arrow"
            aria-label="Farbe wählen"
            title="Farbe wählen"
            onMouseDown={keepSelection}
            onClick={handleToggleColorDropdown}
          >
            ▾
          </button>
          {showColorDropdown && (
            <div className="entry-list-marker-dropdown">
              {MARKER_COLORS.map((c) => (
                <button
                  key={c.className}
                  type="button"
                  className={`entry-list-marker-button ${c.className}`}
                  aria-label={c.label}
                  title={c.label}
                  onMouseDown={keepSelection}
                  onClick={() => handlePickColor(c.className)}
                />
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          className="secondary"
          onMouseDown={keepSelection}
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
              onMouseDown={keepSelection}
              onClick={() => handleSelectMember(m)}
            >
              {m.name || m.email}
            </button>
          ))}
          <button
            type="button"
            className="secondary"
            onMouseDown={keepSelection}
            onClick={handleCancelMemberDropdown}
          >
            Abbrechen
          </button>
        </div>
      )}
      <div
        ref={editorRef}
        className="entry-list-detail-panel-content-textarea entry-list-detail-panel-content-editable"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        onInput={emitChange}
        onKeyDown={handleKeyDown}
      />
    </>
  );
}
