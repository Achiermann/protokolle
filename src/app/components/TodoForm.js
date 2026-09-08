"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTodosStore } from "../stores/useTodosStore";
import { useEntriesStore } from "../stores/useEntriesStore";
import { useWorkspacesStore } from "../stores/useWorkspacesStore";
import "../../styles/entry-form.css";

// Matches a member to a todo's stored assignee string, which is the member's
// name (or the local part of their email) as it was when the todo was made.
const memberLabel = (member) => member.name || member.email.split("@")[0];
const sameName = (a, b) =>
  (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase();

// Creating: pick any number of members, one todo per member. Editing (`todo`
// given): title, person and date of that one row, where the person is a single
// choice — a todo belongs to someone, and editing moves it. The topic isn't
// editable; standalone todos keep the one they were given, marker-todos
// inherit their traktandum's.
export default function TodoForm({ onCancel, todo = null }) {
  // *** VARIABLES ***
  const addTodo = useTodosStore((state) => state.addTodo);
  const updateTodo = useTodosStore((state) => state.updateTodo);
  const todos = useTodosStore((state) => state.todos);
  const entries = useEntriesStore((state) => state.entries);
  const ensureEntries = useEntriesStore((state) => state.ensureEntries);
  const members = useWorkspacesStore((state) => state.members);
  const fetchMembers = useWorkspacesStore((state) => state.fetchMembers);

  const isEditing = !!todo;
  const [formData, setFormData] = useState({
    title: todo?.title || "",
    topic: "",
    scheduled: todo?.scheduled || "",
  });
  // One todo row is created per selected member; when editing, exactly one.
  const [selectedMemberIds, setSelectedMemberIds] = useState(new Set());
  const [isNewTopic, setIsNewTopic] = useState(false);

  // Topics come from both entries and existing standalone todos.
  const existingTopics = useMemo(() => {
    const set = new Set();
    for (const e of entries) if (e.topic) set.add(e.topic);
    for (const t of todos) if (t.topic) set.add(t.topic);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "de"));
  }, [entries, todos]);

  // *** FUNCTIONS/HANDLERS ***
  // Make sure the topic and member lists are available even when the form is
  // opened from the todo panel (where entries aren't otherwise loaded).
  useEffect(() => {
    ensureEntries();
    if (members.length === 0) {
      fetchMembers().catch(() =>
        toast.error("Mitglieder konnten nicht geladen werden"),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Preselect the current assignee once the member list has arrived (it is
  // fetched lazily, so this can't happen on mount).
  useEffect(() => {
    if (!isEditing || members.length === 0) return;
    const current = members.find((m) =>
      sameName(memberLabel(m), todo.assignee),
    );
    setSelectedMemberIds(new Set(current ? [current.id] : []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, members]);

  const handleToggleMember = (id) => {
    // Editing reassigns rather than fans out, so the choice is exclusive.
    if (isEditing) {
      setSelectedMemberIds(new Set([id]));
      return;
    }
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleTopicSelect = (e) => {
    const value = e.target.value;
    if (value === "__new__") {
      setIsNewTopic(true);
      setFormData((prev) => ({ ...prev, topic: "" }));
    } else {
      setIsNewTopic(false);
      setFormData((prev) => ({ ...prev, topic: value }));
    }
  };

  const resetForm = () => {
    setFormData({ title: "", topic: "", scheduled: "" });
    setSelectedMemberIds(new Set());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error("ToDo-Titel ist erforderlich");
      return;
    }
    const assignees = members
      .filter((m) => selectedMemberIds.has(m.id))
      .map(memberLabel);
    if (assignees.length === 0) {
      toast.error("Person (Für) ist erforderlich");
      return;
    }

    if (isEditing) {
      try {
        await updateTodo(todo.id, {
          title: formData.title.trim(),
          assignee: assignees[0],
          scheduled: formData.scheduled || null,
        });
        toast.success("ToDo aktualisiert");
        if (onCancel) onCancel();
      } catch (error) {
        toast.error("ToDo konnte nicht aktualisiert werden");
      }
      return;
    }

    try {
      await addTodo({
        title: formData.title,
        assignees,
        topic: formData.topic || null,
        scheduled: formData.scheduled || null,
      });
      toast.success(assignees.length > 1 ? "ToDos erstellt" : "ToDo erstellt");
      resetForm();
      if (onCancel) onCancel();
    } catch (error) {
      toast.error("ToDo konnte nicht erstellt werden");
    }
  };

  return (
    <form className="entry-form card" onSubmit={handleSubmit}>
      <h2>{isEditing ? "ToDo bearbeiten" : "Neues ToDo"}</h2>
      <div className="entry-form-fields">
        <div className="entry-form-field">
          <label htmlFor="title">ToDo *</label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
          />
        </div>

        <div className="entry-form-field">
          <label>Für *</label>
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
        </div>

        <div className="entry-form-field">
          <label htmlFor="scheduled">Geplant</label>
          <input
            type="date"
            id="scheduled"
            name="scheduled"
            value={formData.scheduled}
            onChange={handleChange}
          />
        </div>

        <div
          className="entry-form-field"
          hidden={isEditing}
          aria-hidden={isEditing}
        >
          <label htmlFor="topic">Thema</label>
          {isNewTopic ? (
            <input
              type="text"
              id="topic"
              name="topic"
              value={formData.topic}
              onChange={handleChange}
              placeholder="Neues Thema eingeben..."
              autoFocus
            />
          ) : (
            <select
              id="topic"
              value={formData.topic}
              onChange={handleTopicSelect}
            >
              <option value="">– Thema wählen –</option>
              {existingTopics.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              <option value="__new__">Neues Thema</option>
            </select>
          )}
        </div>
      </div>

      <div className="entry-form-actions">
        <button type="submit">
          {isEditing ? "Speichern" : "ToDo erstellen"}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            resetForm();
            if (onCancel) onCancel();
          }}
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}
