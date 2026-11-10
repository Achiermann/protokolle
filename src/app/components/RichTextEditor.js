"use client";

import { useEffect, useRef, useState } from "react";
import {
  sanitizeHtml,
  decorateTodos,
  buildTodoTag,
  buildZielTag,
} from "../../lib/richText";
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
  const emojiRef = useRef(null);
  const emojiPickerHostRef = useRef(null);
  // Selection (character offsets) when the emoji picker opened: typing in its
  // search field moves focus out of the editor, so the insertion point is
  // restored from here.
  const emojiSelectionRef = useRef(null);
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
  const [showTodoPopup, setShowTodoPopup] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState(new Set());
  const [todoDate, setTodoDate] = useState("");
  const [showZielPopup, setShowZielPopup] = useState(false);
  const [zielTitle, setZielTitle] = useState("");
  const [zielDate, setZielDate] = useState("");
  const [showColorDropdown, setShowColorDropdown] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeColor, setActiveColor] = useState(MARKER_COLORS[0].className);
  // Caret offset captured when a popup opens: interacting with the popup's
  // inputs moves focus (and thus the selection) out of the editor, so the
  // insertion point is restored from here on OK.
  const savedCaretRef = useRef(null);

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

  // Same for the emoji picker; Escape closes it too.
  useEffect(() => {
    if (!showEmojiPicker) return;
    const onDocMouseDown = (e) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setShowEmojiPicker(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showEmojiPicker]);

  // The full emoji picker (emoji-mart, German search/labels) is loaded only
  // when it is first opened, so its ~400 KB of emoji data never weighs on the
  // editor itself. It is a web component, mounted into the host div.
  useEffect(() => {
    if (!showEmojiPicker) return;
    const host = emojiPickerHostRef.current;
    let cancelled = false;
    Promise.all([
      import("emoji-mart"),
      import("@emoji-mart/data"),
      import("@emoji-mart/data/i18n/de.json"),
    ]).then(([{ Picker }, data, i18n]) => {
      if (cancelled || !host) return;
      const picker = new Picker({
        data: data.default || data,
        i18n: i18n.default || i18n,
        locale: "de",
        theme: "light",
        skinTonePosition: "none",
        previewPosition: "none",
        autoFocus: true,
        onEmojiSelect: (emoji) => handleInsertEmoji(emoji.native),
      });
      host.appendChild(picker);
    });
    return () => {
      cancelled = true;
      if (host) host.replaceChildren();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showEmojiPicker]);

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

  // *** HIGHLIGHTING ***
  // Highlighting works on character offsets over the editor's text nodes, not on
  // existing <mark> elements: the selection is turned into a [start, end) span
  // of text, every text node in that span is cut out exactly at the boundaries,
  // lifted out of whatever mark it was in, and (when colouring) wrapped in a
  // fresh mark. A final cleanup merges neighbouring same-colour marks and drops
  // empty / edge-whitespace ones, which are what used to show up as little
  // colour slivers at the start of lines (mark has 2px padding).

  // All text nodes of the editor in document order.
  const editorTextNodes = () => {
    const editor = editorRef.current;
    const nodes = [];
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    return nodes;
  };

  // A DOM boundary point → character offset from the editor start.
  const offsetOf = (container, offset) => {
    const pre = document.createRange();
    pre.selectNodeContents(editorRef.current);
    pre.setEnd(container, offset);
    return pre.toString().length;
  };

  // Restore a [start, end) selection from character offsets.
  const selectOffsets = (start, end) => {
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    let pos = 0;
    let startSet = false;
    let endSet = false;
    for (const node of editorTextNodes()) {
      const len = node.nodeValue.length;
      // Start prefers the beginning of the next node, end the close of this one,
      // so the selection hugs the highlighted text.
      if (!startSet && start < pos + len) {
        range.setStart(node, start - pos);
        startSet = true;
      }
      if (startSet && !endSet && end <= pos + len) {
        range.setEnd(node, end - pos);
        endSet = true;
        break;
      }
      pos += len;
    }
    if (!startSet || !endSet) return;
    sel.removeAllRanges();
    sel.addRange(range);
  };

  // The nearest <mark> ancestor of `node` within the editor, if any.
  const closestMark = (node) => {
    const editor = editorRef.current;
    let n = node.parentNode;
    while (n && n !== editor) {
      if (n.nodeType === 1 && n.tagName === "MARK") return n;
      n = n.parentNode;
    }
    return null;
  };

  const unwrap = (el) => {
    const parent = el.parentNode;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  };

  // Take `node` out of every mark around it. The parts of a mark before and
  // after the node stay highlighted (in copies of that mark); only the node
  // itself ends up unmarked — so un-highlighting a few words inside a long
  // highlight no longer clears the whole thing.
  const liftOutOfMarks = (node) => {
    let mark;
    while ((mark = closestMark(node))) {
      const before = document.createRange();
      before.setStart(mark, 0);
      before.setEndBefore(node);
      if (!before.collapsed) {
        const head = mark.cloneNode(false);
        head.appendChild(before.extractContents());
        mark.parentNode.insertBefore(head, mark);
      }
      const after = document.createRange();
      after.setStartAfter(node);
      after.setEnd(mark, mark.childNodes.length);
      if (!after.collapsed) {
        const tail = mark.cloneNode(false);
        tail.appendChild(after.extractContents());
        mark.parentNode.insertBefore(tail, mark.nextSibling);
      }
      unwrap(mark);
    }
  };

  const isBlockish = (n) =>
    !n || (n.nodeType === 1 && ["DIV", "P", "BR"].includes(n.tagName));

  // A mark with no visible text that sits at a line edge (or is empty) only
  // renders as a padding sliver — those are dropped.
  const isStrayMark = (mark) => {
    if (mark.textContent.trim()) return false;
    if (!mark.textContent) return true;
    return isBlockish(mark.previousSibling) || isBlockish(mark.nextSibling);
  };

  // Tidy marks after an edit: merge adjacent same-colour siblings, drop stray
  // whitespace marks, remove inline wrappers the splitting left empty.
  const cleanupMarks = () => {
    const editor = editorRef.current;
    editor.normalize();
    editor.querySelectorAll("mark").forEach((mark) => {
      if (!mark.isConnected) return;
      let next = mark.nextSibling;
      while (
        next &&
        next.nodeType === 1 &&
        next.tagName === "MARK" &&
        next.className === mark.className
      ) {
        while (next.firstChild) mark.appendChild(next.firstChild);
        next.remove();
        next = mark.nextSibling;
      }
    });
    editor.querySelectorAll("mark").forEach((mark) => {
      if (isStrayMark(mark)) unwrap(mark);
    });
    editor.querySelectorAll("b, strong, i, em, u").forEach((el) => {
      if (!el.textContent && !el.querySelector("br")) el.remove();
    });
    editor.normalize();
  };

  // Highlight the selection with `className`, or remove highlighting when
  // `className` is null (eraser). Clicking a colour on text that is entirely
  // highlighted in that colour removes it again (toggle). The selection is
  // trimmed of surrounding whitespace and widened to whole words, and stays
  // selected afterwards so the next click can toggle or recolour it.
  const applyColor = (className) => {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;

    const nodes = editorTextNodes();
    const text = nodes.map((n) => n.nodeValue).join("");
    let start = offsetOf(range.startContainer, range.startOffset);
    let end = offsetOf(range.endContainer, range.endOffset);

    // Trim surrounding whitespace (incl. the line break a triple-click adds).
    while (start < end && /\s/.test(text[start])) start++;
    while (end > start && /\s/.test(text[end - 1])) end--;
    if (start >= end) return;

    // Widen to whole words — within the boundary text node only, so a word
    // never bleeds across a line break into the neighbouring line.
    let pos = 0;
    for (const node of nodes) {
      const v = node.nodeValue;
      const len = v.length;
      if (start >= pos && start < pos + len) {
        let local = start - pos;
        while (local > 0 && /\S/.test(v[local - 1])) local--;
        start = pos + local;
      }
      if (end > pos && end <= pos + len) {
        let local = end - pos;
        while (local < len && /\S/.test(v[local])) local++;
        end = pos + local;
      }
      pos += len;
    }

    // The slice of each text node inside [start, end).
    const segments = [];
    pos = 0;
    for (const node of nodes) {
      const len = node.nodeValue.length;
      const from = Math.max(start, pos) - pos;
      const to = Math.min(end, pos + len) - pos;
      if (to > from) segments.push({ node, from, to });
      pos += len;
    }

    // Toggle: everything visible in the span already has this colour → remove.
    const visible = segments.filter((s) =>
      s.node.nodeValue.slice(s.from, s.to).trim(),
    );
    const allSame =
      className &&
      visible.length > 0 &&
      visible.every((s) => {
        const mark = closestMark(s.node);
        return mark && mark.classList.contains(className);
      });
    const target = allSame ? null : className;

    segments.forEach(({ node, from, to }) => {
      let piece = node;
      if (to < piece.nodeValue.length) piece.splitText(to);
      if (from > 0) piece = piece.splitText(from);
      liftOutOfMarks(piece);
      if (target) {
        const mark = document.createElement("mark");
        mark.className = target;
        piece.parentNode.insertBefore(mark, piece);
        mark.appendChild(piece);
      }
    });

    cleanupMarks();
    selectOffsets(start, end);
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

  const handleErase = () => {
    setShowColorDropdown(false);
    runWithHistory(() => applyColor(null));
  };

  const handleToggleColorDropdown = () => setShowColorDropdown((v) => !v);

  // Remember where the emoji goes before the picker's search field takes focus:
  // the selection as character offsets, or null when the caret isn't in the
  // editor (the emoji is then appended at the end).
  const handleToggleEmojiPicker = () => {
    if (!showEmojiPicker) {
      const editor = editorRef.current;
      const sel = window.getSelection();
      const range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
      emojiSelectionRef.current =
        editor && range && editor.contains(range.commonAncestorContainer)
          ? {
              start: offsetOf(range.startContainer, range.startOffset),
              end: offsetOf(range.endContainer, range.endOffset),
            }
          : null;
    }
    setShowEmojiPicker((v) => !v);
  };

  // Insert the emoji at the remembered caret, replacing a selection.
  const handleInsertEmoji = (emoji) => {
    setShowEmojiPicker(false);
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const saved = emojiSelectionRef.current;
    if (saved) {
      setCaret(saved.start);
      const sel = window.getSelection();
      const startRange = sel.getRangeAt(0).cloneRange();
      setCaret(saved.end);
      const range = sel.getRangeAt(0).cloneRange();
      range.setStart(startRange.startContainer, startRange.startOffset);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      setCaret(Number.MAX_SAFE_INTEGER); // falls back to the end
    }
    runWithHistory(() => document.execCommand("insertText", false, emoji));
  };

  const activeMarker =
    MARKER_COLORS.find((c) => c.className === activeColor) || MARKER_COLORS[0];

  // Insert a marker tag wrapped in a colour-line span so it is highlighted
  // immediately and text typed next stays inside the highlight. The span is
  // throwaway (stripped on save, re-derived on load by decorateTodos).
  const insertTodoTag = (text, cls = "todo-line") => {
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
    span.className = cls;
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
    // Capture the caret before the popup steals focus (see savedCaretRef).
    savedCaretRef.current = getCaret();
    if (members.length === 0) await onRequestMembers();
    setSelectedMemberIds(new Set());
    setTodoDate("");
    setShowZielPopup(false);
    setShowTodoPopup(true);
  };

  const handleToggleMember = (id) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleTodoPopupSubmit = (e) => {
    e.preventDefault();
    const names = members
      .filter((m) => selectedMemberIds.has(m.id))
      .map((m) => m.name || m.email.split("@")[0]);
    if (names.length === 0) return;
    const editor = editorRef.current;
    if (editor) {
      editor.focus();
      setCaret(savedCaretRef.current);
    }
    runWithHistory(() => insertTodoTag(buildTodoTag(names, todoDate || null)));
    setShowTodoPopup(false);
  };

  const handleCancelTodoPopup = () => setShowTodoPopup(false);

  const handleOpenZiel = () => {
    savedCaretRef.current = getCaret();
    setZielTitle("");
    setZielDate("");
    setShowTodoPopup(false);
    setShowZielPopup(true);
  };

  // Ziele are authored inline like todos: OK inserts a `/ziel@Datum Titel`
  // marker at the caret; the row is created (and linked to this traktandum)
  // when the notes are saved.
  const handleZielSubmit = (e) => {
    e.preventDefault();
    if (!zielTitle.trim() || !zielDate) return;
    const editor = editorRef.current;
    if (editor) {
      editor.focus();
      setCaret(savedCaretRef.current);
    }
    runWithHistory(() =>
      insertTodoTag(buildZielTag(zielTitle.trim(), zielDate), "ziel-line"),
    );
    setShowZielPopup(false);
  };

  const handleCancelZiel = () => setShowZielPopup(false);

  // Escape closes whichever popup is open (without touching the editor).
  const closePopupsOnEscape = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      setShowTodoPopup(false);
      setShowZielPopup(false);
    }
  };

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
              <button
                type="button"
                className="entry-list-marker-button entry-list-marker-eraser"
                aria-label="Markierung entfernen"
                title="Markierung entfernen"
                onMouseDown={keepSelection}
                onClick={handleErase}
              >
                ✕
              </button>
            </div>
          )}
        </div>
        <div className="entry-list-emoji" ref={emojiRef}>
          <button
            type="button"
            className="secondary"
            aria-label="Emoji einfügen"
            title="Emoji einfügen"
            onMouseDown={keepSelection}
            onClick={handleToggleEmojiPicker}
          >
            😊
          </button>
          {showEmojiPicker && (
            <div className="entry-list-emoji-picker" ref={emojiPickerHostRef} />
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
        {showTodoButton && (
          <button type="button" className="secondary" onClick={handleOpenZiel}>
            + Ziel
          </button>
        )}
      </div>
      {showTodoButton && showTodoPopup && (
        <form
          className="entry-list-detail-panel-member-dropdown entry-list-schedule-popup"
          onSubmit={handleTodoPopupSubmit}
          onKeyDown={closePopupsOnEscape}
        >
          <div className="member-toggle-group">
            {members.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`member-toggle${selectedMemberIds.has(m.id) ? " member-toggle-selected" : ""}`}
                onClick={() => handleToggleMember(m.id)}
              >
                {m.name || m.email}
              </button>
            ))}
          </div>
          <div className="entry-list-schedule-popup-row">
            <label
              className="entry-list-schedule-popup-date-label"
              htmlFor="todo-schedule-date"
            >
              Geplant
            </label>
            <input
              type="date"
              id="todo-schedule-date"
              value={todoDate}
              onChange={(e) => setTodoDate(e.target.value)}
            />
            <button
              type="submit"
              className="primary"
              disabled={selectedMemberIds.size === 0}
            >
              OK
            </button>
            <button
              type="button"
              className="secondary"
              onClick={handleCancelTodoPopup}
            >
              Abbrechen
            </button>
          </div>
        </form>
      )}
      {showTodoButton && showZielPopup && (
        <form
          className="entry-list-detail-panel-member-dropdown entry-list-schedule-popup"
          onSubmit={handleZielSubmit}
          onKeyDown={closePopupsOnEscape}
        >
          <div className="entry-list-schedule-popup-row">
            <input
              type="text"
              className="entry-list-schedule-popup-title"
              placeholder="Ziel..."
              value={zielTitle}
              onChange={(e) => setZielTitle(e.target.value)}
              autoFocus
            />
            <input
              type="date"
              aria-label="Geplant"
              value={zielDate}
              onChange={(e) => setZielDate(e.target.value)}
              required
            />
            <button
              type="submit"
              className="primary"
              disabled={!zielTitle.trim() || !zielDate}
            >
              OK
            </button>
            <button
              type="button"
              className="secondary"
              onClick={handleCancelZiel}
            >
              Abbrechen
            </button>
          </div>
        </form>
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
