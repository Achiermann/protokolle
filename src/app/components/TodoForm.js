"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useTodosStore } from "../stores/useTodosStore";
import { useEntriesStore } from "../stores/useEntriesStore";
import { useWorkspacesStore } from "../stores/useWorkspacesStore";
import "../../styles/entry-form.css";

export default function TodoForm({ onCancel }) {
  // *** VARIABLES ***
  const addTodo = useTodosStore((state) => state.addTodo);
  const todos = useTodosStore((state) => state.todos);
  const entries = useEntriesStore((state) => state.entries);
  const ensureEntries = useEntriesStore((state) => state.ensureEntries);
  const members = useWorkspacesStore((state) => state.members);
  const fetchMembers = useWorkspacesStore((state) => state.fetchMembers);

  const [formData, setFormData] = useState({
    title: "",
    assignee: "",
    topic: "",
  });
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error("ToDo-Titel ist erforderlich");
      return;
    }
    if (!formData.assignee.trim()) {
      toast.error("Person (Für) ist erforderlich");
      return;
    }

    try {
      await addTodo({
        title: formData.title,
        assignee: formData.assignee,
        topic: formData.topic || null,
      });
      toast.success("ToDo erstellt");
      setFormData({ title: "", assignee: "", topic: "" });
      if (onCancel) onCancel();
    } catch (error) {
      toast.error("ToDo konnte nicht erstellt werden");
    }
  };

  return (
    <form className="entry-form card" onSubmit={handleSubmit}>
      <h2>Neues ToDo</h2>
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
          <label htmlFor="assignee">Für *</label>
          <select
            id="assignee"
            name="assignee"
            value={formData.assignee}
            onChange={handleChange}
            required
          >
            <option value="">– Person wählen –</option>
            {members.map((m) => {
              const name = m.name || m.email.split("@")[0];
              return (
                <option key={m.id} value={name}>
                  {m.name || m.email}
                </option>
              );
            })}
          </select>
        </div>

        <div className="entry-form-field">
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
        <button type="submit">ToDo erstellen</button>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            setFormData({ title: "", assignee: "", topic: "" });
            if (onCancel) onCancel();
          }}
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}
