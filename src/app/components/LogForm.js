"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useChangelogStore } from "../stores/useChangelogStore";
import { useEntriesStore } from "../stores/useEntriesStore";
import { useTodosStore } from "../stores/useTodosStore";
import "../../styles/entry-form.css";

const NEW = "__new__";

// Today as YYYY-MM-DD in local time (toISOString would shift to UTC).
const todayIso = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
};

// Creating (`initial` may preset topic/change, e.g. from a ToDo) or editing
// (`log` given) a changelog entry. The Thema narrows the Vorgang dropdown;
// both can be created on the spot. The author is set server-side.
export default function LogForm({ onCancel, log = null, initial = {} }) {
  // *** VARIABLES ***
  const vorgaenge = useChangelogStore((state) => state.vorgaenge);
  const ensureChangelog = useChangelogStore((state) => state.ensureChangelog);
  const addLog = useChangelogStore((state) => state.addLog);
  const updateLog = useChangelogStore((state) => state.updateLog);
  const entries = useEntriesStore((state) => state.entries);
  const ensureEntries = useEntriesStore((state) => state.ensureEntries);
  const todos = useTodosStore((state) => state.todos);

  const isEditing = !!log;
  const logVorgang = isEditing
    ? vorgaenge.find((v) => v.id === log.vorgang_id)
    : null;

  const [topic, setTopic] = useState(logVorgang?.topic || initial.topic || "");
  const [isNewTopic, setIsNewTopic] = useState(false);
  const [vorgangId, setVorgangId] = useState(log?.vorgang_id || "");
  const [newVorgangName, setNewVorgangName] = useState("");
  const [change, setChange] = useState(log?.change || initial.change || "");
  const [logDate, setLogDate] = useState(log?.log_date || todayIso());

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

    if (!change.trim()) {
      toast.error("Änderung ist erforderlich");
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

    const payload = {
      change: change.trim(),
      log_date: logDate || todayIso(),
      ...(isNewVorgang
        ? { new_vorgang: { name: newVorgangName.trim(), topic: topic.trim() } }
        : { vorgang_id: vorgangId }),
    };

    try {
      if (isEditing) {
        await updateLog(log.id, payload);
        toast.success("Log aktualisiert");
      } else {
        await addLog(payload);
        toast.success("Log erstellt");
      }
      if (onCancel) onCancel();
    } catch (error) {
      toast.error(
        isEditing
          ? "Log konnte nicht aktualisiert werden"
          : "Log konnte nicht erstellt werden",
      );
    }
  };

  return (
    <form className="entry-form card" onSubmit={handleSubmit}>
      <h2>{isEditing ? "Log bearbeiten" : "Neuer Log"}</h2>
      <div className="entry-form-fields">
        <div className="entry-form-field">
          <label htmlFor="log-topic">Thema</label>
          {isNewTopic ? (
            <input
              type="text"
              id="log-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Neues Thema eingeben..."
              autoFocus
            />
          ) : (
            <select id="log-topic" value={topic} onChange={handleTopicSelect}>
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
          <label htmlFor="log-vorgang">Vorgang *</label>
          {topicVorgaenge.length > 0 && (
            <select
              id="log-vorgang"
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
              id={topicVorgaenge.length > 0 ? undefined : "log-vorgang"}
              value={newVorgangName}
              onChange={(e) => setNewVorgangName(e.target.value)}
              placeholder="Neuen Vorgang eingeben, z.B. Filmer finden"
            />
          )}
        </div>

        <div className="entry-form-field">
          <label htmlFor="log-change">Änderung *</label>
          <textarea
            id="log-change"
            value={change}
            onChange={(e) => setChange(e.target.value)}
            rows={3}
            required
          />
        </div>

        <div className="entry-form-field">
          <label htmlFor="log-date">Datum</label>
          <input
            type="date"
            id="log-date"
            value={logDate}
            onChange={(e) => setLogDate(e.target.value)}
          />
        </div>
      </div>

      <div className="entry-form-actions">
        <button type="submit">
          {isEditing ? "Speichern" : "Log erstellen"}
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}
