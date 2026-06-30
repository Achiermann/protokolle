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

// Custom undo/redo. The editor mixes execCommand edits (typing, B/I/U) with
// direct-DOM edits (highlight, todo); the browser's native history only tracks
// the former, so native undo desyncs and corrupts after a highlight. Instead we
// snapshot the whole editor on each committed change and restore on ⌘Z / ⌘⇧Z.
// Rapid typing is coalesced into one step: a snapshot is committed after this
// pause, and always before a format/highlight/todo action.
const TYPING_DEBOUNCE_MS = 400;
const MAX_HISTORY = 200;

export default function RichTextEditor({
  value,
  onChange,
  members = [],
  onRequestMembers = () => {},
  placeholder,
  // The + ToDo affordance only makes sense in entry notes (where todos are
  // authored). Comments reuse this editor with it hidden.
  showTodoButton = true,
}) {
  // *** VARIABLES ***
  const editorRef = useRef(null);
  const markerRef = useRef(null);
  // undo/redo: stacks of { html, caret } snapshots. `present` is the last
  // committed state; `timer` debounces a typing burst; `applying` suppresses the
  // input events our own programmatic edits fire.
  const historyRef = useRef({
    undo: [],
    redo: [],
    present: null,
    timer: null,
    applying: false,
  });
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [showColorDropdown, setShowColorDropdown] = useState(false);
  const [activeColor, setActiveColor] = useState(MARKER_COLORS[0].className);

  // *** FUNCTIONS/HANDLERS ***
  // contentEditable is uncontrolled: seed the DOM once on mount so the caret
  // doesn't jump on every keystroke. `value` is only read back out via onChange.
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = decorateTodos(sanitizeHtml(value || ""));
      historyRef.current.present = snapshot();
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

  // *** UNDO / REDO ***
  // Caret as a character offset from the editor start, so it survives the
  // innerHTML replacement a restore does. Range.toString() counts only text-node
  // characters, matching the text-node walk in setCaret.
  const getCaret = () => {
    const editor = editorRef.current;
    if (!editor) return null;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    const range = sel.getRangeAt(0);
    if (!editor.contains(range.endContainer)) return null;
    const pre = range.cloneRange();
    pre.selectNodeContents(editor);
    pre.setEnd(range.endContainer, range.endOffset);
    return pre.toString().length;
  };

  const setCaret = (offset) => {
    const editor = editorRef.current;
    if (!editor || offset == null) return;
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    const walker = document.createTreeWalker(
      editor,
      NodeFilter.SHOW_TEXT,
      null,
    );
    let remaining = offset;
    let node;
    let placed = false;
    while ((node = walker.nextNode())) {
      const len = node.nodeValue.length;
      if (remaining <= len) {
        range.setStart(node, remaining);
        placed = true;
        break;
      }
      remaining -= len;
    }
    if (placed) {
      range.collapse(true);
    } else {
      range.selectNodeContents(editor);
      range.collapse(false);
    }
    sel.removeAllRanges();
    sel.addRange(range);
  };

  const snapshot = () => ({
    html: editorRef.current ? editorRef.current.innerHTML : "",
    caret: getCaret(),
  });

  // Record the current DOM as a new step: the previous `present` becomes an undo
  // target. No-op when nothing actually changed, so spurious steps never pile up.
  const commit = () => {
    const h = historyRef.current;
    const cur = snapshot();
    if (h.present && h.present.html === cur.html) return;
    if (h.present) h.undo.push(h.present);
    if (h.undo.length > MAX_HISTORY) h.undo.shift();
    h.present = cur;
    h.redo = [];
  };

  // Commit a pending typing burst immediately (before an undo or a structural
  // edit) so the burst lands as its own step.
  const flushTyping = () => {
    const h = historyRef.current;
    if (h.timer) {
      clearTimeout(h.timer);
      h.timer = null;
      commit();
    }
  };

  const scheduleTypingCommit = () => {
    const h = historyRef.current;
    if (h.timer) clearTimeout(h.timer);
    h.timer = setTimeout(() => {
      h.timer = null;
      commit();
    }, TYPING_DEBOUNCE_MS);
  };

  const restore = (state) => {
    const editor = editorRef.current;
    if (!editor || !state) return;
    const h = historyRef.current;
    h.applying = true;
    editor.innerHTML = state.html;
    setCaret(state.caret);
    h.applying = false;
    emitChange();
  };

  const undo = () => {
    const h = historyRef.current;
    flushTyping();
    if (h.undo.length === 0) return;
    h.redo.push(h.present);
    h.present = h.undo.pop();
    restore(h.present);
  };

  const redo = () => {
    const h = historyRef.current;
    if (h.redo.length === 0) return;
    h.undo.push(h.present);
    h.present = h.redo.pop();
    restore(h.present);
  };

  // Wrap a structural edit (B/I/U, highlight, todo) so it commits as one undo
  // step. `applying` keeps the input events execCommand fires from also being
  // logged as a typing burst.
  const runWithHistory = (mutator) => {
    const h = historyRef.current;
    flushTyping();
    h.applying = true;
    mutator();
    h.applying = false;
    commit();
    emitChange();
  };

  // Typing path: propagate the value and (debounced) commit a history step.
  // Skipped while our own programmatic edits are running.
  const handleInput = () => {
    if (historyRef.current.applying) return;
    scheduleTypingCommit();
    emitChange();
  };

  // execCommand is deprecated but remains the only dependency-free way to apply
  // bold/italic/underline to the current selection across browsers. No rich-text
  // MCP/library is available, so it is preferred over adding an editor dependency.
  const format = (command) =>
    runWithHistory(() => document.execCommand(command, false, null));

  const handleBold = () => format("bold");
  const handleItalic = () => format("italic");
  const handleUnderline = () => format("underline");

  // Pressing Enter inside a highlight should start a fresh, unhighlighted line —
  // otherwise the <mark> carries onto the next line and even an empty line break
  // ends up highlighted. Pull everything from the caret to the end of the mark
  // out of it, drop the mark if it is left empty, then let a normal paragraph
  // break happen at the now-unmarked caret. Only handles a collapsed caret
  // inside a mark; everything else falls through to native Enter. Returns true
  // when it handled the key.
  const exitMarkOnNewLine = () => {
    const editor = editorRef.current;
    if (!editor) return false;
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return false;
    const range = selection.getRangeAt(0);
    if (!range.collapsed) return false;

    let mark = range.startContainer;
    while (mark && mark !== editor) {
      if (mark.nodeType === 1 && mark.tagName === "MARK") break;
      mark = mark.parentNode;
    }
    if (!mark || mark === editor || mark.tagName !== "MARK") return false;

    runWithHistory(() => {
      const parent = mark.parentNode;
      const afterMark = mark.nextSibling;

      // Move the part of the mark from the caret onward out, unmarked.
      const tail = document.createRange();
      tail.setStart(range.startContainer, range.startOffset);
      tail.setEnd(mark, mark.childNodes.length);
      const tailContent = tail.extractContents();
      const firstTail = tailContent.firstChild;
      parent.insertBefore(tailContent, afterMark);

      // The mark is empty when the caret sat at its very start.
      if (!mark.textContent) parent.removeChild(mark);

      const caret = document.createRange();
      if (firstTail) {
        caret.setStartBefore(firstTail);
      } else if (afterMark && afterMark.parentNode === parent) {
        caret.setStartBefore(afterMark);
      } else {
        caret.selectNodeContents(parent);
        caret.collapse(false);
      }
      caret.collapse(true);
      selection.removeAllRanges();
      selection.addRange(caret);

      document.execCommand("insertParagraph");
    });
    return true;
  };

  // Keyboard shortcuts (Cmd on Mac, Ctrl elsewhere): B/I/U formatting and
  // undo/redo. Undo/redo run our own snapshot history (see above) so they cover
  // every edit — typing, B/I/U, highlight and todo — consistently.
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      if (exitMarkOnNewLine()) {
        e.preventDefault();
        return;
      }
    }
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
      if (e.shiftKey) redo();
      else undo();
    } else if (key === "y") {
      e.preventDefault();
      redo();
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

  // The nearest <mark> ancestor of `node` within the editor, if any.
  const closestMark = (node) => {
    const editor = editorRef.current;
    let n = node;
    while (n && n !== editor) {
      if (n.nodeType === 1 && n.tagName === "MARK") return n;
      n = n.parentNode;
    }
    return null;
  };

  // Every text node the range touches, in document order. Walking the text
  // nodes in place — rather than range.extractContents() — is what keeps the
  // highlight inline: block wrappers (the <div> line breaks contentEditable
  // inserts on Enter) are left untouched, so a multi-line selection no longer
  // gets stuffed into one inline <mark> and rendered as full-width colour bars.
  const collectSelectedTextNodes = (range) => {
    const editor = editorRef.current;
    const root = range.commonAncestorContainer;
    if (root.nodeType === 3) return editor.contains(root) ? [root] : [];
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.nodeValue) return NodeFilter.FILTER_REJECT;
        return range.intersectsNode(n)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      },
    });
    let n;
    while ((n = walker.nextNode())) {
      if (editor.contains(n)) nodes.push(n);
    }
    return nodes;
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

    // Re-clicking inside a single highlighted phrase toggles it off (same
    // colour) or recolours the whole phrase (different colour).
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
      selection.removeAllRanges();
      return;
    }

    // Wrap exactly the selected text in each text node it spans, leaving the
    // surrounding block structure alone. Offsets are read up front; only the
    // boundary nodes are partially covered, every node between them fully.
    const { startContainer, startOffset, endContainer, endOffset } = range;
    collectSelectedTextNodes(range).forEach((node) => {
      const from = node === startContainer ? startOffset : 0;
      const to = node === endContainer ? endOffset : node.nodeValue.length;
      if (to <= from) return;
      // A fully-covered text node that already *is* a single-colour mark is
      // recoloured in place, so re-highlighting never nests <mark>s.
      const parentMark = closestMark(node);
      if (
        parentMark &&
        from === 0 &&
        to === node.nodeValue.length &&
        parentMark.childNodes.length === 1
      ) {
        parentMark.className = className;
        return;
      }
      const sub = document.createRange();
      sub.setStart(node, from);
      sub.setEnd(node, to);
      const mark = document.createElement("mark");
      mark.className = className;
      sub.surroundContents(mark);
    });
    selection.removeAllRanges();
  };

  const handleApplyActiveColor = () => {
    setShowColorDropdown(false);
    runWithHistory(() => applyColor(activeColor));
  };

  const handlePickColor = (className) => {
    setActiveColor(className);
    setShowColorDropdown(false);
    runWithHistory(() => applyColor(className));
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
  };

  const handleInsertTodo = async () => {
    if (members.length === 0) await onRequestMembers();
    setShowMemberDropdown(true);
  };

  const handleSelectMember = (member) => {
    const rawName = member.name || member.email.split("@")[0];
    const nameTag = rawName.replace(/\s+/g, "_");
    runWithHistory(() => insertTodoTag(`/todo@${nameTag} `));
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
        {showTodoButton && (
          <button
            type="button"
            className="secondary"
            onMouseDown={keepSelection}
            onClick={handleInsertTodo}
          >
            + ToDo
          </button>
        )}
      </div>
      {showTodoButton && showMemberDropdown && (
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
        onInput={handleInput}
        onKeyDown={handleKeyDown}
      />
    </>
  );
}
