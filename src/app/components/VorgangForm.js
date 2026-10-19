"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useChangelogStore } from "../stores/useChangelogStore";
import { useEntriesStore } from "../stores/useEntriesStore";
import { useTodosStore } from "../stores/useTodosStore";
import "../../styles/entry-form.css";

const NEW = "__new__";

// Creating (`initialTopic` may preset the Thema, e.g. from a Thema's "+"
// button; an optional first comment can be written right away) or editing
// (`vorgang` given: rename or file under another Thema).
export default function VorgangForm({
  vorgang = null,
  initialTopic = "",
  onCancel,
  onCreated,
}) {
  // *** VARIABLES ***
  const vorgaenge = useChangelogStore((state) => state.vorgaenge);
  const addVorgang = useChangelogStore((state) => state.addVorgang);
  const updateVorgang = useChangelogStore((state) => state.updateVorgang);
  const entries = useEntriesStore((state) => state.entries);
  const todos = useTodosStore((state) => state.todos);

  const isEditing = !!vorgang;
  const [name, setName] = useState(vorgang?.name || "");
  const [topic, setTopic] = useState(vorgang?.topic || initialTopic);
  const [comment, setComment] = useState("");
  const [isNewTopic, setIsNewTopic] = useState(false);

  const existingTopics = useMemo(() => {
    const set = new Set();
    for (const e of entries) if (e.topic) set.add(e.topic);
    for (const t of todos) if (t.topic) set.add(t.topic);
    for (const v of vorgaenge) if (v.topic) set.add(v.topic);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "de"));
  }, [entries, todos, vorgaenge]);

  // *** FUNCTIONS/HANDLERS ***
  const handleTopicSelect = (e) => {
    const value = e.target.value;
    setIsNewTopic(value === NEW);
    setTopic(value === NEW ? "" : value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name ist erforderlich");
      return;
    }
    if (isEditing) {
      try {
        await updateVorgang(vorgang.id, { name: name.trim(), topic });
        toast.success("Vorgang aktualisiert");
        if (onCancel) onCancel();
      } catch (error) {
        toast.error("Vorgang konnte nicht aktualisiert werden");
      }
      return;
    }
    try {
      const created = await addVorgang({
        name: name.trim(),
        topic,
        comment: comment.trim(),
      });
      toast.success("Vorgang erstellt");
      if (onCreated) onCreated(created);
      if (onCancel) onCancel();
    } catch (error) {
      toast.error("Vorgang konnte nicht erstellt werden");
    }
  };

  return (
    <form className="entry-form card" onSubmit={handleSubmit}>
      <h2>{isEditing ? "Vorgang bearbeiten" : "Neuer Vorgang"}</h2>
      <div className="entry-form-fields">
        <div className="entry-form-field">
          <label htmlFor="vorgang-name">Vorgang *</label>
          <input
            type="text"
            id="vorgang-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="entry-form-field">
          <label htmlFor="vorgang-topic">Thema</label>
          {isNewTopic ? (
            <input
              type="text"
              id="vorgang-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Neues Thema eingeben..."
              autoFocus
            />
          ) : (
            <select
              id="vorgang-topic"
              value={topic}
              onChange={handleTopicSelect}
            >
              <option value="">– Ohne Thema –</option>
              {existingTopics.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              <option value={NEW}>Neues Thema</option>
            </select>
          )}
        </div>
        {!isEditing && (
          <div className="entry-form-field">
            <label htmlFor="vorgang-comment">Erster Kommentar</label>
            <textarea
              id="vorgang-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
          </div>
        )}
      </div>

      <div className="entry-form-actions">
        <button type="submit">
          {isEditing ? "Speichern" : "Vorgang erstellen"}
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}
