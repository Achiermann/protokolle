"use client";

import { useRef, useState } from "react";
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
import { GripVertical, X } from "lucide-react";

// Intern schedule editor. Each entry is one row: [hh] : [mm]  [Beschrieb].
//  - hh / mm take digits only (max 2); hh 00–23, mm 00–59.
//  - There is always one empty row at the bottom. Once it has a time and a
//    Beschrieb and focus leaves it, it becomes a real entry and a new empty
//    row appears.
//  - Entries can be reordered by dragging the handle and deleted with ×.
// Saves (the whole list, in order) when focus leaves an edited row, after a
// drag and after a delete. Entries without a time (converted legacy lines
// like "Danach Barbetrieb") stay valid.

const newId = () =>
  globalThis.crypto?.randomUUID?.() ||
  `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const toRow = (item) => {
  const [h = "", m = ""] = (item.time || "").split(":");
  return { id: item.id || newId(), h, m, text: item.text || "" };
};

const digits = (value) => value.replace(/\D/g, "").slice(0, 2);
const pad = (value) => (value === "" ? "" : value.padStart(2, "0"));

// "HH:MM", null for no time, or undefined when the input is invalid.
const rowTime = (row) => {
  if (row.h === "" && row.m === "") return null;
  const h = Number(row.h || 0);
  const m = Number(row.m || 0);
  if (h > 23 || m > 59) return undefined;
  return `${pad(String(h))}:${pad(String(m))}`;
};

const isComplete = (row) =>
  row.h !== "" && rowTime(row) && row.text.trim() !== "";

function TimeInputs({ row, onChange, autoFocusMinutes }) {
  const minutesRef = useRef(null);
  const invalid = rowTime(row) === undefined;
  return (
    <span className={`schedule-edit-time ${invalid ? "invalid" : ""}`}>
      <input
        type="text"
        inputMode="numeric"
        aria-label="Stunde"
        placeholder="hh"
        value={row.h}
        onChange={(e) => {
          const h = digits(e.target.value);
          onChange({ h });
          if (h.length === 2 && autoFocusMinutes) minutesRef.current?.focus();
        }}
        // Read the field itself, not `row`: the auto-jump to the minutes
        // blurs this input in the same tick as the last keystroke, before
        // `row` has the new value (that turned "16" into "01").
        onBlur={(e) => onChange({ h: pad(digits(e.target.value)) })}
      />
      <span aria-hidden="true">:</span>
      <input
        ref={minutesRef}
        type="text"
        inputMode="numeric"
        aria-label="Minute"
        placeholder="mm"
        value={row.m}
        onChange={(e) => onChange({ m: digits(e.target.value) })}
        onBlur={(e) => onChange({ m: pad(digits(e.target.value)) })}
      />
    </span>
  );
}

function SortableRow({ row, onChange, onLeave, onDelete }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id });

  return (
    <li
      ref={setNodeRef}
      className={`schedule-edit-row ${isDragging ? "dragging" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) onLeave();
      }}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="schedule-edit-handle"
        aria-label="Verschieben"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </button>
      <TimeInputs row={row} onChange={onChange} autoFocusMinutes />
      <input
        type="text"
        className="schedule-edit-text"
        aria-label="Beschrieb"
        placeholder="Beschrieb"
        value={row.text}
        onChange={(e) => onChange({ text: e.target.value })}
      />
      <button
        type="button"
        className="schedule-edit-delete"
        aria-label="Eintrag löschen"
        onClick={onDelete}
      >
        <X size={16} />
      </button>
    </li>
  );
}

export default function ScheduleEditor({ items, onSave }) {
  // *** VARIABLES ***
  const [rows, setRows] = useState(() => (items || []).map(toRow));
  const [draft, setDraft] = useState(() => ({
    id: newId(),
    h: "",
    m: "",
    text: "",
  }));
  // Rows edited since the last save, so leaving an untouched row is free.
  const dirty = useRef(false);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 6 },
    }),
  );

  // *** FUNCTIONS/HANDLERS ***
  const save = (nextRows) => {
    if (nextRows.some((row) => rowTime(row) === undefined)) return;
    dirty.current = false;
    onSave(
      nextRows
        .map((row) => ({
          id: row.id,
          time: rowTime(row),
          text: row.text.trim(),
        }))
        .filter((item) => item.time || item.text),
    );
  };

  const updateRow = (id, patch) => {
    dirty.current = true;
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const handleLeaveRow = () => {
    if (dirty.current) save(rows);
  };

  const handleDelete = (id) => {
    const next = rows.filter((r) => r.id !== id);
    setRows(next);
    save(next);
  };

  // The empty bottom row becomes an entry once it has time + Beschrieb.
  const handleLeaveDraft = () => {
    if (!isComplete(draft)) return;
    const next = [...rows, { ...draft, h: pad(draft.h), m: pad(draft.m) }];
    setRows(next);
    setDraft({ id: newId(), h: "", m: "", text: "" });
    save(next);
  };

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const from = rows.findIndex((r) => r.id === active.id);
    const to = rows.findIndex((r) => r.id === over.id);
    const next = arrayMove(rows, from, to);
    setRows(next);
    save(next);
  };

  return (
    <div className="schedule-edit">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={rows.map((r) => r.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="schedule-edit-list">
            {rows.map((row) => (
              <SortableRow
                key={row.id}
                row={row}
                onChange={(patch) => updateRow(row.id, patch)}
                onLeave={handleLeaveRow}
                onDelete={() => handleDelete(row.id)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <div
        className="schedule-edit-row schedule-edit-draft"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) handleLeaveDraft();
        }}
      >
        <span className="schedule-edit-handle" aria-hidden="true" />
        <TimeInputs
          row={draft}
          onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
          autoFocusMinutes
        />
        <input
          type="text"
          className="schedule-edit-text"
          aria-label="Neuer Eintrag: Beschrieb"
          placeholder="Neuer Eintrag"
          value={draft.text}
          onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
        <span className="schedule-edit-delete" aria-hidden="true" />
      </div>
    </div>
  );
}
