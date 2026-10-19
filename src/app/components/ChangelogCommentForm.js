"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useChangelogStore } from "../stores/useChangelogStore";
import { useEntriesStore } from "../stores/useEntriesStore";
import { useTodosStore } from "../stores/useTodosStore";
import "../../styles/entry-form.css";

const NEW = "__new__";

// Writes a changelog comment from outside the changelog (the ToDo list's
// "Kommentar im Changelog"); `initial` presets topic and text. The Thema
// narrows the Vorgang dropdown; both can be created on the spot. The author
// is set server-side.
export default function ChangelogCommentForm({ onCancel, initial = {} }) {
  // *** VARIABLES ***
  const vorgaenge = useChangelogStore((state) => state.vorgaenge);
  const ensureChangelog = useChangelogStore((state) => state.ensureChangelog);
  const addComment = useChangelogStore((state) => state.addComment);
  const entries = useEntriesStore((state) => state.entries);
  const ensureEntries = useEntriesStore((state) => state.ensureEntries);
  const todos = useTodosStore((state) => state.todos);

  const [topic, setTopic] = useState(initial.topic || "");
  const [isNewTopic, setIsNewTopic] = useState(false);
  const [vorgangId, setVorgangId] = useState("");
  const [newVorgangName, setNewVorgangName] = useState("");
  const [body, setBody] = useState(initial.body || "");

  // Topics from Traktanden, ToDos and existing Vorgänge.
  const existingTopics = useMemo(() => {
    const set = new Set();
    for (const e of entries) if (e.topic) set.add(e.topic);
    for (const t of todos) if (t.topic) set.add(t.topic);
    for (const v of vorgaenge) if (v.topic) set.add(v.topic);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "de"));
  }, [entries, todos, vorgaenge]);

  // Vorgänge under the chosen Thema ("" = ohne Thema). A brand-new Thema has
  // none yet, so a new Vorgang is the only option there.
  const topicVorgaenge = useMemo(() => {
    if (isNewTopic) return [];
    return vorgaenge
      .filter((v) => (v.topic || "") === topic)
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  }, [vorgaenge, topic, isNewTopic]);

  const isNewVorgang = vorgangId === NEW || topicVorgaenge.length === 0;

  // *** FUNCTIONS/HANDLERS ***
  // The Thema list needs entries even when opened from the ToDo panel.
  useEffect(() => {
    ensureEntries();
    ensureChangelog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTopicSelect = (e) => {
    const value = e.target.value;
    setIsNewTopic(value === NEW);
    setTopic(value === NEW ? "" : value);
    setVorgangId("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!body.trim()) {
      toast.error("Kommentar ist erforderlich");
      return;
    }
    if (isNewVorgang && !newVorgangName.trim()) {
      toast.error("Vorgang ist erforderlich");
      return;
    }
    if (!isNewVorgang && !vorgangId) {
      toast.error("Bitte einen Vorgang wählen");
      return;
    }

    try {
      await addComment({
        body: body.trim(),
        ...(isNewVorgang
          ? {
              new_vorgang: { name: newVorgangName.trim(), topic: topic.trim() },
            }
          : { vorgang_id: vorgangId }),
      });
      toast.success("Kommentar erstellt");
      if (onCancel) onCancel();
    } catch (error) {
      toast.error("Kommentar konnte nicht erstellt werden");
    }
  };

  return (
    <form className="entry-form card" onSubmit={handleSubmit}>
      <h2>Kommentar im Changelog</h2>
      <div className="entry-form-fields">
        <div className="entry-form-field">
          <label htmlFor="changelog-comment-topic">Thema</label>
          {isNewTopic ? (
            <input
              type="text"
              id="changelog-comment-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Neues Thema eingeben..."
              autoFocus
            />
          ) : (
            <select
              id="changelog-comment-topic"
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

        <div className="entry-form-field">
          <label htmlFor="changelog-comment-vorgang">Vorgang *</label>
          {topicVorgaenge.length > 0 && (
            <select
              id="changelog-comment-vorgang"
              value={vorgangId}
              onChange={(e) => setVorgangId(e.target.value)}
            >
              <option value="">– Vorgang wählen –</option>
              {topicVorgaenge.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
              <option value={NEW}>Neuer Vorgang</option>
            </select>
          )}
          {isNewVorgang && (
            <input
              type="text"
              id={
                topicVorgaenge.length > 0
                  ? undefined
                  : "changelog-comment-vorgang"
              }
              value={newVorgangName}
              onChange={(e) => setNewVorgangName(e.target.value)}
              placeholder="Neuen Vorgang eingeben, z.B. Filmer finden"
            />
          )}
        </div>

        <div className="entry-form-field">
          <label htmlFor="changelog-comment-body">Kommentar *</label>
          <textarea
            id="changelog-comment-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            required
          />
        </div>
      </div>

      <div className="entry-form-actions">
        <button type="submit">Kommentar erstellen</button>
        <button type="button" className="secondary" onClick={onCancel}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}
