"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Flag,
  ListTodo,
  Minus,
  Pencil,
  Plus,
  Trash,
} from "lucide-react";
import toast from "react-hot-toast";
import { useTodosStore } from "../stores/useTodosStore";
import { useEventsStore } from "../stores/useEventsStore";
import { useEntriesStore } from "../stores/useEntriesStore";
import { useProjectsStore } from "../stores/useProjectsStore";
import "../../styles/timeline.css";
// Member/topic colour chips and the shared popup styling.
import "../../styles/entry-list.css";

// The range (this month → +X months) always fills the frame's width exactly,
// so the strip never scrolls; the past isn't drawn at all and lives in the
// overview's "Vergangen" section instead. The scale is deliberately coarse: a
// month header and one divider per month, nothing finer — a line's exact date
// is written on its label, not read off the strip.
const MIN_SCOPE = 3;
const MAX_SCOPE = 24;
const SCOPE_STEP = 3;
const DEFAULT_SCOPE = 3;

// Vertical layout: the month header on top, then open space the item lines
// run through, then the zone where each line ends in its labelled tab.
const LINE_RUN_HEIGHT = 150;
const MONTHS_ROW_H = 24;
// Projects sit in a band right under the month header, one bar per project;
// overlapping projects stack into extra rows.
const PROJECT_BAR_H = 22;
const PROJECT_ROW_GAP = 4;
// Every label tab has the same width and reads "dd. Titel" on one line; it
// only wraps when the text doesn't fit, up to LABEL_MAX_LINES. Keep these in
// step with .timeline-label in timeline.css: 0.8rem mono at line-height 1.25
// (16px per line, ~7.8px per character), --space-1 / --space-2 padding and a
// 2px border.
const LABEL_WIDTH = 176;
const LABEL_LINE_PX = 16;
const LABEL_CHROME_X = 2 * 8 + 2 * 2;
const LABEL_CHROME_Y = 2 * 4 + 2 * 2;
const LABEL_MAX_LINES = 3;
const LABEL_CHARS_PER_LINE = Math.floor((LABEL_WIDTH - LABEL_CHROME_X) / 7.8);
// Space kept between stacked labels, and between labels side by side.
const LABEL_GAP_Y = 4;
const LABEL_GAP_X = 8;
// Keep in step with .timeline-ziel-popover's width in timeline.css.
const POPOVER_WIDTH = 280;

// The kinds of item on the timeline, in filter-bar order. ToDos are numerous
// and fine-grained, so they're opt-in: off until toggled on.
const TYPES = ["entry", "todo", "ziel", "project"];
const DEFAULT_TYPES = ["entry", "ziel", "project"];
const TYPE_LABELS = {
  entry: "Traktanden",
  todo: "ToDos",
  ziel: "Ziele",
  project: "Projekte",
};

const MS_PER_DAY = 86400000;
const MONTH_NAMES = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];
const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mär",
  "Apr",
  "Mai",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dez",
];

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

// Local-midnight date from a DB `scheduled` value (YYYY-MM-DD).
const parseIsoDate = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

// Calendar-day difference; rounding absorbs DST offsets.
const dayDiff = (from, to) => Math.round((to - from) / MS_PER_DAY);

const formatDate = (iso) =>
  parseIsoDate(iso).toLocaleDateString("de-DE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

// A label's text: the day of the month in front of the title, e.g.
// "05. Tour-Budget". The month is already given by the strip's header.
const labelText = (item) => `${item.iso.slice(8, 10)}. ${item.title || ""}`;

// How many lines `text` takes in a label, by greedy word wrap at the label's
// character width (a word longer than a line is broken mid-word, as the CSS
// `overflow-wrap: anywhere` does). Capped where the CSS line clamp cuts off.
const countLabelLines = (text) => {
  let lines = 1;
  let used = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const need = used === 0 ? word.length : used + 1 + word.length;
    if (need <= LABEL_CHARS_PER_LINE) {
      used = need;
      continue;
    }
    if (used > 0) lines += 1;
    lines += Math.floor((word.length - 1) / LABEL_CHARS_PER_LINE);
    used = ((word.length - 1) % LABEL_CHARS_PER_LINE) + 1;
  }
  return Math.min(lines, LABEL_MAX_LINES);
};

// Same member colour hash + display casing as the ToDo table.
const normalizeMemberKey = (name) => (name || "").trim().toLowerCase();
const getMemberColorClass = (name) => {
  const key = normalizeMemberKey(name);
  if (!key) return "";
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return `entry-list-item-topic-c${Math.abs(hash) % 10}`;
};
const formatMemberName = (name) =>
  normalizeMemberKey(name)
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

// Identical hash to EntryList.getTopicColorClass (raw string, not normalised)
// so a traktandum's line matches its topic chip in the entry list.
const getTopicColorClass = (topic) => {
  if (!topic) return "";
  let hash = 0;
  for (let i = 0; i < topic.length; i++) {
    hash = (hash * 31 + topic.charCodeAt(i)) | 0;
  }
  return `entry-list-item-topic-c${Math.abs(hash) % 10}`;
};

export default function Timeline({ onOpenEntry }) {
  // *** VARIABLES ***
  const todos = useTodosStore((state) => state.todos);
  const todosLoading = useTodosStore((state) => state.loading);
  const ensureTodos = useTodosStore((state) => state.ensureTodos);
  const events = useEventsStore((state) => state.events);
  const eventsLoading = useEventsStore((state) => state.loading);
  const ensureEvents = useEventsStore((state) => state.ensureEvents);
  const addEvent = useEventsStore((state) => state.addEvent);
  const updateEvent = useEventsStore((state) => state.updateEvent);
  const deleteEvent = useEventsStore((state) => state.deleteEvent);
  const entries = useEntriesStore((state) => state.entries);
  const entriesLoading = useEntriesStore((state) => state.loading);
  const ensureEntries = useEntriesStore((state) => state.ensureEntries);
  const projects = useProjectsStore((state) => state.projects);
  const projectsLoading = useProjectsStore((state) => state.loading);
  const ensureProjects = useProjectsStore((state) => state.ensureProjects);
  const addProject = useProjectsStore((state) => state.addProject);
  const updateProject = useProjectsStore((state) => state.updateProject);
  const deleteProject = useProjectsStore((state) => state.deleteProject);

  const [scopeMonths, setScopeMonths] = useState(DEFAULT_SCOPE);
  // Which item types are shown, on the strip and in the overview alike.
  const [activeTypes, setActiveTypes] = useState(() => new Set(DEFAULT_TYPES));
  const [viewWidth, setViewWidth] = useState(0);
  const [showPast, setShowPast] = useState(false);
  // The row picked in the overview table: its line stays highlighted.
  const [selectedKey, setSelectedKey] = useState(null);
  // "+ Ziel" popup (workspace-only Ziel, no traktandum).
  const [showZielForm, setShowZielForm] = useState(false);
  const [zielTitle, setZielTitle] = useState("");
  const [zielDate, setZielDate] = useState("");
  // Edit popover for a workspace-only Ziel: draft fields + anchor position.
  const [editingZiel, setEditingZiel] = useState(null);
  // "+ Projekt" popup: a name and an inclusive date span.
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectStart, setProjectStart] = useState("");
  const [projectEnd, setProjectEnd] = useState("");
  // Edit popover for a project bar, same shape as editingZiel.
  const [editingProject, setEditingProject] = useState(null);
  const stripRef = useRef(null);

  const today = useMemo(() => startOfToday(), []);
  const todayIso = useMemo(() => {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [today]);

  // *** FUNCTIONS/HANDLERS ***
  useEffect(() => {
    ensureTodos();
    ensureEvents();
    ensureEntries();
    ensureProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track the strip's width so the range always fills it exactly.
  useEffect(() => {
    const el = stripRef.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(() => setViewWidth(el.clientWidth));
    observer.observe(el);
    setViewWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  // Whole months, no past: the 1st of the current month through the last day
  // of the month `scope` ahead, so the month header never shows a partial
  // month. Anything already behind us lives in the overview's "Vergangen"
  // section instead.
  const range = useMemo(() => {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(
      today.getFullYear(),
      today.getMonth() + scopeMonths + 1,
      0,
    );
    return { start, end, totalDays: dayDiff(start, end) + 1 };
  }, [today, scopeMonths]);

  // The whole range fits the viewport exactly, so the strip never scrolls.
  const pxPerDay = viewWidth > 0 ? viewWidth / range.totalDays : 4;
  const stripWidth = range.totalDays * pxPerDay;

  const months = useMemo(() => {
    const out = [];
    const cursor = new Date(range.start);
    while (cursor <= range.end) {
      const dayCount = new Date(
        cursor.getFullYear(),
        cursor.getMonth() + 1,
        0,
      ).getDate();
      out.push({
        month: cursor.getMonth(),
        year: cursor.getFullYear(),
        dayCount,
        startIndex: dayDiff(range.start, cursor),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return out;
  }, [range]);

  // Projects overlapping the visible range, clipped to it, packed into rows so
  // that bars running at the same time never overlap.
  const { projectBars, projectRowCount } = useMemo(() => {
    if (!activeTypes.has("project")) {
      return { projectBars: [], projectRowCount: 0 };
    }
    const lastIndex = range.totalDays - 1;
    const visible = projects
      .map((project) => ({
        project,
        startIndex: dayDiff(range.start, parseIsoDate(project.start_date)),
        endIndex: dayDiff(range.start, parseIsoDate(project.end_date)),
      }))
      .filter((bar) => bar.endIndex >= 0 && bar.startIndex <= lastIndex)
      .sort(
        (a, b) =>
          a.startIndex - b.startIndex ||
          b.endIndex - a.endIndex ||
          a.project.name.localeCompare(b.project.name),
      );
    const rowEnds = [];
    const bars = visible.map((bar) => {
      let row = rowEnds.findIndex((end) => end < bar.startIndex);
      if (row === -1) {
        row = rowEnds.length;
        rowEnds.push(0);
      }
      rowEnds[row] = bar.endIndex;
      const from = Math.max(bar.startIndex, 0);
      const to = Math.min(bar.endIndex, lastIndex);
      return {
        ...bar,
        row,
        left: from * pxPerDay,
        width: (to - from + 1) * pxPerDay,
        clippedStart: bar.startIndex < 0,
        clippedEnd: bar.endIndex > lastIndex,
      };
    });
    return { projectBars: bars, projectRowCount: rowEnds.length };
  }, [projects, activeTypes, range, pxPerDay]);

  const projectBandHeight =
    projectRowCount > 0
      ? projectRowCount * (PROJECT_BAR_H + PROJECT_ROW_GAP) + PROJECT_ROW_GAP
      : 0;
  // Item lines start below the month header and the project band.
  const headerHeight = MONTHS_ROW_H + projectBandHeight;

  const entriesById = useMemo(
    () => new Map(entries.map((entry) => [entry.id, entry])),
    [entries],
  );

  // Merge the scheduled traktanden, todos and Ziele the filter bar leaves
  // active into positioned items, and stack their hanging labels so they never
  // overlap.
  const { items, labelZoneHeight } = useMemo(() => {
    const list = [];
    for (const todo of activeTypes.has("todo") ? todos : []) {
      if (!todo.scheduled) continue;
      const index = dayDiff(range.start, parseIsoDate(todo.scheduled));
      if (index < 0 || index >= range.totalDays) continue;
      list.push({
        key: `todo-${todo.id}`,
        type: "todo",
        todo,
        title: todo.title,
        iso: todo.scheduled,
        index,
      });
    }
    for (const event of activeTypes.has("ziel") ? events : []) {
      const index = dayDiff(range.start, parseIsoDate(event.scheduled));
      if (index < 0 || index >= range.totalDays) continue;
      list.push({
        key: `ziel-${event.id}`,
        type: "ziel",
        event,
        title: event.title,
        iso: event.scheduled,
        index,
      });
    }
    // Archiving a traktandum takes it off the timeline.
    for (const entry of activeTypes.has("entry") ? entries : []) {
      if (!entry.scheduled || entry.archived) continue;
      const index = dayDiff(range.start, parseIsoDate(entry.scheduled));
      if (index < 0 || index >= range.totalDays) continue;
      list.push({
        key: `entry-${entry.id}`,
        type: "entry",
        entry,
        title: entry.item_title,
        iso: entry.scheduled,
        index,
      });
    }
    list.sort(
      (a, b) =>
        a.iso.localeCompare(b.iso) || (a.title || "").localeCompare(b.title),
    );

    // Labels differ in height (one line unless the text wraps), so they're
    // stacked by pixel offset rather than in fixed lanes: each goes to the
    // highest spot where it clears every label it overlaps horizontally.
    const stacked = [];
    const placed = list.map((item) => {
      const x = (item.index + 0.5) * pxPerDay;
      const text = labelText(item);
      const labelHeight =
        countLabelLines(text) * LABEL_LINE_PX + LABEL_CHROME_Y;
      const labelLeft = Math.min(
        Math.max(x - LABEL_WIDTH / 2, 0),
        Math.max(stripWidth - LABEL_WIDTH, 0),
      );
      const neighbours = stacked.filter(
        (other) =>
          other.left < labelLeft + LABEL_WIDTH + LABEL_GAP_X &&
          labelLeft < other.left + LABEL_WIDTH + LABEL_GAP_X,
      );
      const candidates = [0, ...neighbours.map((o) => o.bottom + LABEL_GAP_Y)];
      const labelOffset = Math.min(
        ...candidates.filter((top) =>
          neighbours.every(
            (o) =>
              top + labelHeight + LABEL_GAP_Y <= o.top ||
              top >= o.bottom + LABEL_GAP_Y,
          ),
        ),
      );
      stacked.push({
        left: labelLeft,
        top: labelOffset,
        bottom: labelOffset + labelHeight,
      });
      return { ...item, x, text, labelLeft, labelOffset };
    });
    const zoneHeight = Math.max(0, ...stacked.map((o) => o.bottom)) + 8;
    return {
      items: placed,
      labelZoneHeight: Math.max(zoneHeight, LABEL_LINE_PX + LABEL_CHROME_Y + 8),
    };
  }, [todos, events, entries, activeTypes, range, pxPerDay, stripWidth]);

  const todayX = (dayDiff(range.start, today) + 0.5) * pxPerDay;

  // Deselecting the last active type would leave an empty timeline with no way
  // back that reads as broken, so the last one stays on.
  const handleToggleType = (type) => {
    setEditingZiel(null);
    setEditingProject(null);
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        if (next.size === 1) return prev;
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const handleScope = (delta) => {
    setEditingZiel(null);
    setEditingProject(null);
    setScopeMonths((prev) =>
      Math.min(MAX_SCOPE, Math.max(MIN_SCOPE, prev + delta)),
    );
  };

  const openEntryFor = (entryId) => {
    const entry = entryId ? entriesById.get(entryId) : null;
    if (entry) onOpenEntry(entry);
  };

  // Jump/edit: todos and traktandum-Ziele open their traktandum; only
  // workspace-only Ziele open the edit popover (linked ones are owned by
  // their /ziel marker in the notes). Reached by clicking an item's label on
  // the strip, or the action button at the end of an overview row.
  const handleItemClick = (item) => {
    if (item.type === "entry") {
      onOpenEntry(item.entry);
      return;
    }
    if (item.type === "todo") {
      openEntryFor(item.todo.entry_id);
      return;
    }
    if (item.event.entry_id) {
      openEntryFor(item.event.entry_id);
      return;
    }
    // The popover lives outside the strip (whose overflow would clip it), so
    // it is placed in viewport coordinates: over the item's line, clamped to
    // stay fully on screen.
    setEditingProject(null);
    const el = stripRef.current;
    const rect = el?.getBoundingClientRect();
    const anchorX = rect ? rect.left + item.x : 0;
    setEditingZiel({
      id: item.event.id,
      title: item.event.title,
      scheduled: item.event.scheduled,
      left: Math.max(
        8,
        Math.min(
          anchorX - POPOVER_WIDTH / 2,
          window.innerWidth - POPOVER_WIDTH - 8,
        ),
      ),
      top: rect ? rect.top + headerHeight + 8 : 80,
    });
  };

  const handleZielFormSubmit = async (e) => {
    e.preventDefault();
    if (!zielTitle.trim() || !zielDate) return;
    try {
      await addEvent({ title: zielTitle.trim(), scheduled: zielDate });
      toast.success("Ziel erstellt");
      setShowZielForm(false);
    } catch (error) {
      toast.error("Ziel konnte nicht erstellt werden");
    }
  };

  const handleZielSave = async (e) => {
    e.preventDefault();
    if (!editingZiel.title.trim() || !editingZiel.scheduled) return;
    try {
      await updateEvent(editingZiel.id, {
        title: editingZiel.title.trim(),
        scheduled: editingZiel.scheduled,
      });
      setEditingZiel(null);
      toast.success("Ziel aktualisiert");
    } catch (error) {
      toast.error("Ziel konnte nicht aktualisiert werden");
    }
  };

  const handleZielDelete = async () => {
    if (!confirm("Ziel wirklich löschen?")) return;
    try {
      await deleteEvent(editingZiel.id);
      setEditingZiel(null);
      toast.success("Ziel gelöscht");
    } catch (error) {
      toast.error("Ziel konnte nicht gelöscht werden");
    }
  };

  const handleProjectFormSubmit = async (e) => {
    e.preventDefault();
    if (!projectName.trim() || !projectStart || !projectEnd) return;
    if (projectEnd < projectStart) {
      toast.error("Ende liegt vor dem Start");
      return;
    }
    try {
      await addProject({
        name: projectName.trim(),
        start_date: projectStart,
        end_date: projectEnd,
      });
      toast.success("Projekt erstellt");
      setShowProjectForm(false);
    } catch (error) {
      toast.error("Projekt konnte nicht erstellt werden");
    }
  };

  // Same placement as the Ziel popover: viewport coordinates under the
  // clicked bar, clamped to stay fully on screen.
  const handleProjectClick = (bar, e) => {
    setEditingZiel(null);
    const rect = e.currentTarget.getBoundingClientRect();
    // At the click for a mouse; keyboard events carry no pointer position, so
    // the bar's centre (within the viewport) stands in.
    const anchorX =
      e.clientX ??
      (Math.max(rect.left, 0) + Math.min(rect.right, window.innerWidth)) / 2;
    setEditingProject({
      id: bar.project.id,
      name: bar.project.name,
      start_date: bar.project.start_date,
      end_date: bar.project.end_date,
      left: Math.max(
        8,
        Math.min(
          anchorX - POPOVER_WIDTH / 2,
          window.innerWidth - POPOVER_WIDTH - 8,
        ),
      ),
      top: rect.bottom + 8,
    });
  };

  const handleProjectSave = async (e) => {
    e.preventDefault();
    const { id, name, start_date, end_date } = editingProject;
    if (!name.trim() || !start_date || !end_date) return;
    if (end_date < start_date) {
      toast.error("Ende liegt vor dem Start");
      return;
    }
    try {
      await updateProject(id, { name: name.trim(), start_date, end_date });
      setEditingProject(null);
      toast.success("Projekt aktualisiert");
    } catch (error) {
      toast.error("Projekt konnte nicht aktualisiert werden");
    }
  };

  const handleProjectDelete = async () => {
    if (!confirm("Projekt wirklich löschen?")) return;
    try {
      await deleteProject(editingProject.id);
      setEditingProject(null);
      toast.success("Projekt gelöscht");
    } catch (error) {
      toast.error("Projekt konnte nicht gelöscht werden");
    }
  };

  const upcomingItems = useMemo(
    () => items.filter((item) => item.iso >= todayIso),
    [items, todayIso],
  );
  const pastItems = useMemo(
    () =>
      items
        .filter((item) => item.iso < todayIso)
        .sort((a, b) => b.iso.localeCompare(a.iso)),
    [items, todayIso],
  );

  // Ziele have one fixed colour; todos follow their member, traktanden their
  // topic — each matching the chips those rows show elsewhere in the app.
  const itemColorClass = (item) => {
    if (item.type === "ziel") return "timeline-ziel-color";
    if (item.type === "entry") return getTopicColorClass(item.entry.topic);
    return getMemberColorClass(item.todo.assignee);
  };
  const isDone = (item) => item.type === "todo" && item.todo.done;

  const loading =
    todosLoading || eventsLoading || entriesLoading || projectsLoading;

  // A row click highlights the item's line on the strip. Jumping to the
  // traktandum (or editing a free Ziel) lives on the action button, so the
  // two don't fight over the same click.
  const handleRowClick = (item) => {
    setSelectedKey(item.key);
  };

  const renderRow = (item) => {
    // A traktandum is its own target; todos and marker-Ziele point at the one
    // they were authored in.
    const linkedEntry =
      item.type === "entry"
        ? item.entry
        : item.type === "todo"
          ? item.todo.entry_id && entriesById.get(item.todo.entry_id)
          : item.event.entry_id && entriesById.get(item.event.entry_id);
    const canOpenEntry = Boolean(linkedEntry);
    // Free Ziele (no traktandum) are edited right on the timeline.
    const canEditZiel = item.type === "ziel" && !item.event.entry_id;
    const topic =
      item.type === "entry"
        ? item.entry.topic
        : item.type === "todo"
          ? item.todo.topic
          : null;
    return (
      <tr
        key={item.key}
        className={`timeline-table-row${isDone(item) ? " timeline-table-row-done" : ""}${selectedKey === item.key ? " timeline-table-row-selected" : ""}`}
        onClick={() => handleRowClick(item)}
      >
        <td>{formatDate(item.iso)}</td>
        <td>{item.title}</td>
        <td>
          {item.type === "todo" && item.todo.assignee ? (
            <span
              className={`entry-list-item-topic ${getMemberColorClass(item.todo.assignee)}`}
            >
              {formatMemberName(item.todo.assignee)}
            </span>
          ) : (
            "-"
          )}
        </td>
        <td>
          {topic ? (
            <span
              className={`entry-list-item-topic ${getTopicColorClass(topic)}`}
            >
              {topic}
            </span>
          ) : (
            "-"
          )}
        </td>
        <td>
          <span className="timeline-table-type">
            {item.type === "ziel" ? (
              <Flag size={13} />
            ) : item.type === "entry" ? (
              <ClipboardList size={13} />
            ) : (
              <ListTodo size={13} />
            )}
            {item.type === "ziel"
              ? "Ziel"
              : item.type === "entry"
                ? "Traktandum"
                : "ToDo"}
          </span>
        </td>
        <td
          className="timeline-table-td-actions"
          onClick={(e) => e.stopPropagation()}
        >
          {(canOpenEntry || canEditZiel) && (
            <button
              type="button"
              className="secondary"
              title={canOpenEntry ? "Zum Traktandum" : "Ziel bearbeiten"}
              onClick={() => {
                setSelectedKey(item.key);
                handleItemClick(item);
              }}
            >
              {canOpenEntry ? (
                <ClipboardList size={16} />
              ) : (
                <Pencil size={16} />
              )}
            </button>
          )}
        </td>
      </tr>
    );
  };

  const renderTable = (list) => (
    <table className="timeline-table">
      <thead>
        <tr>
          <th className="table-header-cell">Geplant</th>
          <th className="table-header-cell">Titel</th>
          <th className="table-header-cell">Für</th>
          <th className="table-header-cell">Thema</th>
          <th className="table-header-cell">Typ</th>
          <th className="table-header-cell"></th>
        </tr>
      </thead>
      <tbody>{list.map(renderRow)}</tbody>
    </table>
  );

  // return (JSX)
  return (
    <div className="timeline">
      <div className="timeline-toolbar">
        <h2>Timeline</h2>
      </div>

      <div className="timeline-filter-row">
        <div className="timeline-controls">
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setZielTitle("");
              setZielDate("");
              setShowProjectForm(false);
              setShowZielForm((v) => !v);
            }}
          >
            + Ziel
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setProjectName("");
              setProjectStart("");
              setProjectEnd("");
              setShowZielForm(false);
              setShowProjectForm((v) => !v);
            }}
          >
            + Projekt
          </button>
          <div className="timeline-filter member-toggle-group">
            {TYPES.map((type) => (
              <button
                key={type}
                type="button"
                className={`member-toggle${activeTypes.has(type) ? " member-toggle-selected" : ""}`}
                aria-pressed={activeTypes.has(type)}
                onClick={() => handleToggleType(type)}
              >
                {TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>

        <div className="timeline-scope">
          <button
            type="button"
            className="secondary"
            aria-label="Zeitraum verkleinern"
            disabled={scopeMonths <= MIN_SCOPE}
            onClick={() => handleScope(-SCOPE_STEP)}
          >
            <Minus size={14} />
          </button>
          <span className="timeline-scope-label">{scopeMonths} Monate</span>
          <button
            type="button"
            className="secondary"
            aria-label="Zeitraum vergrössern"
            disabled={scopeMonths >= MAX_SCOPE}
            onClick={() => handleScope(SCOPE_STEP)}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {showZielForm && (
        <form
          className="entry-list-detail-panel-member-dropdown entry-list-schedule-popup"
          onSubmit={handleZielFormSubmit}
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
              onClick={() => setShowZielForm(false)}
            >
              Abbrechen
            </button>
          </div>
        </form>
      )}

      {showProjectForm && (
        <form
          className="entry-list-detail-panel-member-dropdown entry-list-schedule-popup"
          onSubmit={handleProjectFormSubmit}
        >
          <div className="entry-list-schedule-popup-row">
            <input
              type="text"
              className="entry-list-schedule-popup-title"
              placeholder="Projekt..."
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              autoFocus
            />
            <input
              type="date"
              aria-label="Start"
              title="Start"
              value={projectStart}
              onChange={(e) => {
                const value = e.target.value;
                setProjectStart(value);
                // Keep the span valid: an end before the new start follows it.
                if (value && projectEnd && projectEnd < value) {
                  setProjectEnd(value);
                }
              }}
              required
            />
            <input
              type="date"
              aria-label="Ende"
              title="Ende"
              value={projectEnd}
              min={projectStart || undefined}
              onChange={(e) => setProjectEnd(e.target.value)}
              required
            />
            <button
              type="submit"
              className="primary"
              disabled={!projectName.trim() || !projectStart || !projectEnd}
            >
              OK
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setShowProjectForm(false)}
            >
              Abbrechen
            </button>
          </div>
        </form>
      )}

      {loading && <p>Timeline wird geladen...</p>}

      {!loading && items.length === 0 && projectBars.length === 0 && (
        <p className="timeline-empty">
          Noch nichts geplant. Traktanden und ToDos mit Datum sowie Ziele und
          Projekte erscheinen hier.
        </p>
      )}

      <div className="timeline-frame" ref={stripRef}>
        <div className="timeline-strip" style={{ width: stripWidth }}>
          <div className="timeline-months" style={{ height: MONTHS_ROW_H }}>
            {months.map((m) => {
              const width = m.dayCount * pxPerDay;
              return (
                <div
                  key={`${m.year}-${m.month}`}
                  className="timeline-month"
                  style={{ width }}
                >
                  {width >= 110
                    ? `${MONTH_NAMES[m.month]} ${m.year}`
                    : `${MONTH_SHORT[m.month]} ${String(m.year).slice(2)}`}
                </div>
              );
            })}
          </div>

          {/* The body is plain empty space the item lines run through; the
              only thing drawn in it is one divider per month, hanging off the
              strip so it reaches all the way down past the labels. */}
          <div
            className="timeline-body"
            style={{
              height: projectBandHeight + LINE_RUN_HEIGHT + labelZoneHeight,
            }}
          />
          {months.map((m) => (
            <div
              key={`line-${m.year}-${m.month}`}
              className="timeline-month-line"
              style={{ left: m.startIndex * pxPerDay, top: MONTHS_ROW_H }}
            />
          ))}

          {projectBars.map((bar) => (
            // Not a <button> for the same reason as the item labels below.
            <div
              key={bar.project.id}
              role="button"
              tabIndex={0}
              className={`timeline-project ${getTopicColorClass(bar.project.name)}${bar.clippedStart ? " timeline-project-clipped-start" : ""}${bar.clippedEnd ? " timeline-project-clipped-end" : ""}${editingProject?.id === bar.project.id ? " timeline-project-hot" : ""}`}
              style={{
                left: bar.left,
                width: bar.width,
                top:
                  MONTHS_ROW_H +
                  PROJECT_ROW_GAP +
                  bar.row * (PROJECT_BAR_H + PROJECT_ROW_GAP),
                height: PROJECT_BAR_H,
              }}
              title={`${bar.project.name} · ${formatDate(bar.project.start_date)} – ${formatDate(bar.project.end_date)}`}
              onClick={(e) => handleProjectClick(bar, e)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleProjectClick(bar, e);
                }
              }}
            >
              {bar.project.name}
            </div>
          ))}

          {items.map((item) => {
            const colorClass = itemColorClass(item);
            const hot = selectedKey === item.key;
            const lineTop = headerHeight;
            const lineHeight = LINE_RUN_HEIGHT + item.labelOffset + 10;
            const labelTop = lineTop + lineHeight - 2;
            const tooltip = [
              item.title,
              item.type === "todo"
                ? item.todo.assignee
                : item.type === "entry"
                  ? "Traktandum"
                  : "Ziel",
              item.type === "todo"
                ? item.todo.topic
                : item.type === "entry"
                  ? item.entry.topic
                  : null,
              formatDate(item.iso),
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <div
                key={item.key}
                className={`${isDone(item) ? "timeline-item-done" : ""}${hot ? " timeline-item-hot" : ""}`}
              >
                <div
                  className={`timeline-line ${colorClass}`}
                  style={{ left: item.x, top: lineTop, height: lineHeight }}
                />
                {/* Deliberately not a <button>: the global button:hover fill
                    would override the label's own colour on hover. */}
                <div
                  role="button"
                  tabIndex={0}
                  className={`timeline-label ${colorClass}`}
                  style={{
                    left: item.labelLeft,
                    top: labelTop,
                    width: LABEL_WIDTH,
                  }}
                  title={tooltip}
                  onClick={() => handleItemClick(item)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleItemClick(item);
                    }
                  }}
                >
                  {item.text}
                </div>
              </div>
            );
          })}

          <div
            className="timeline-today-line"
            style={{ left: todayX - 1, top: MONTHS_ROW_H }}
          >
            <span className="timeline-today-label">Heute</span>
          </div>
        </div>
      </div>

      {/* Outside the scrolling strip, which would clip it (see the viewport
          coordinates computed in handleItemClick). */}
      {editingZiel && (
        <form
          className="timeline-ziel-popover"
          style={{ left: editingZiel.left, top: editingZiel.top }}
          onSubmit={handleZielSave}
        >
          <input
            type="text"
            value={editingZiel.title}
            onChange={(e) =>
              setEditingZiel((prev) => ({
                ...prev,
                title: e.target.value,
              }))
            }
            autoFocus
          />
          <input
            type="date"
            value={editingZiel.scheduled}
            onChange={(e) =>
              setEditingZiel((prev) => ({
                ...prev,
                scheduled: e.target.value,
              }))
            }
            required
          />
          <div className="timeline-ziel-popover-actions">
            <button
              type="submit"
              className="primary"
              disabled={!editingZiel.title.trim() || !editingZiel.scheduled}
            >
              Speichern
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setEditingZiel(null)}
            >
              Abbrechen
            </button>
            <button
              type="button"
              className="secondary"
              onClick={handleZielDelete}
              title="Ziel löschen"
            >
              <Trash size={14} />
            </button>
          </div>
        </form>
      )}

      {editingProject && (
        <form
          className="timeline-ziel-popover"
          style={{ left: editingProject.left, top: editingProject.top }}
          onSubmit={handleProjectSave}
        >
          <input
            type="text"
            value={editingProject.name}
            onChange={(e) =>
              setEditingProject((prev) => ({ ...prev, name: e.target.value }))
            }
            autoFocus
          />
          <input
            type="date"
            aria-label="Start"
            title="Start"
            value={editingProject.start_date}
            onChange={(e) =>
              setEditingProject((prev) => ({
                ...prev,
                start_date: e.target.value,
                end_date:
                  e.target.value && prev.end_date < e.target.value
                    ? e.target.value
                    : prev.end_date,
              }))
            }
            required
          />
          <input
            type="date"
            aria-label="Ende"
            title="Ende"
            value={editingProject.end_date}
            min={editingProject.start_date || undefined}
            onChange={(e) =>
              setEditingProject((prev) => ({
                ...prev,
                end_date: e.target.value,
              }))
            }
            required
          />
          <div className="timeline-ziel-popover-actions">
            <button
              type="submit"
              className="primary"
              disabled={
                !editingProject.name.trim() ||
                !editingProject.start_date ||
                !editingProject.end_date
              }
            >
              Speichern
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setEditingProject(null)}
            >
              Abbrechen
            </button>
            <button
              type="button"
              className="secondary"
              onClick={handleProjectDelete}
              title="Projekt löschen"
            >
              <Trash size={14} />
            </button>
          </div>
        </form>
      )}

      {!loading && (
        <div className="timeline-table-section">
          <h3 className="timeline-table-title">Übersicht</h3>
          {upcomingItems.length === 0 ? (
            <p className="timeline-empty">Nichts Anstehendes geplant.</p>
          ) : (
            renderTable(upcomingItems)
          )}

          {pastItems.length > 0 && (
            <>
              <div
                className="timeline-table-title timeline-table-title-past"
                onClick={() => setShowPast(!showPast)}
              >
                <h3>Vergangen ({pastItems.length})</h3>
                {showPast ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
              {showPast && renderTable(pastItems)}
            </>
          )}
        </div>
      )}
    </div>
  );
}
