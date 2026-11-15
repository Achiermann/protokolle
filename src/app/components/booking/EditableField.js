"use client";

import { useEffect, useRef, useState } from "react";

// Click-to-edit value for the Intern sheet.
//   text / number / date → single line: Enter saves
//   multiline            → textarea that grows: ⌘/Ctrl+Enter saves
// Blur saves too; Escape cancels. Nothing is sent when the value is unchanged.
export default function EditableField({
  value,
  onSave,
  type = "text",
  multiline = false,
  placeholder = "—",
  label,
  children,
}) {
  // *** VARIABLES ***
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);
  const asText = value === null || value === undefined ? "" : String(value);

  // *** FUNCTIONS/HANDLERS ***
  useEffect(() => {
    const el = inputRef.current;
    if (!editing || !el) return;
    el.focus();
    if (type !== "date") {
      const end = el.value.length;
      el.setSelectionRange?.(end, end);
    }
  }, [editing, type]);

  // Auto-grow the textarea to its content.
  useEffect(() => {
    const el = inputRef.current;
    if (!editing || !multiline || !el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft, editing, multiline]);

  const start = () => {
    setDraft(asText);
    setEditing(true);
  };

  const commit = async (next = draft) => {
    setEditing(false);
    if (next.trim() === asText.trim()) return;
    await onSave(next.trim() === "" ? null : next);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setEditing(false);
    } else if (e.key === "Enter" && (!multiline || e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      commit();
    }
  };

  if (editing) {
    const common = {
      ref: inputRef,
      className: "booking-edit-input",
      value: draft,
      "aria-label": label,
      onChange: (e) => setDraft(e.target.value),
      onBlur: () => commit(),
      onKeyDown: handleKeyDown,
    };
    if (multiline) return <textarea rows={1} {...common} />;
    if (type === "date") {
      // Saved on blur/Enter only — saving on change would fire mid-typing
      // (e.g. year "0002") when the date is keyed in by hand.
      return (
        <input
          type="date"
          {...common}
          onBlur={() => (draft ? commit() : setEditing(false))}
        />
      );
    }
    return (
      <input
        type={type === "number" ? "number" : "text"}
        min={type === "number" ? 0 : undefined}
        {...common}
      />
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      className={`booking-editable ${asText ? "" : "booking-editable-empty"}`}
      title="Klicken zum Bearbeiten"
      aria-label={label ? `${label} bearbeiten` : undefined}
      onClick={start}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          start();
        }
      }}
    >
      {asText ? (children ?? asText) : placeholder}
    </span>
  );
}
