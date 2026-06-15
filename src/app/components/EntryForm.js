"use client";

import { useState, useMemo } from "react";
import { useEntriesStore } from "../stores/useEntriesStore";
import toast from "react-hot-toast";
import "../../styles/entry-form.css";

export default function EntryForm({ onCancel, entry }) {
  // *** VARIABLES ***
  const entries = useEntriesStore((state) => state.entries);
  const addEntry = useEntriesStore((state) => state.addEntry);
  const updateEntry = useEntriesStore((state) => state.updateEntry);
  const isEditing = !!entry;
  const [formData, setFormData] = useState({
    item_title: entry?.item_title || "",
    topic: entry?.topic || "",
  });
  const [isNewTopic, setIsNewTopic] = useState(false);

  const existingTopics = useMemo(() => {
    const set = new Set();
    for (const e of entries) {
      if (e.topic) set.add(e.topic);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "de"));
  }, [entries]);

  // *** FUNCTIONS/HANDLERS ***
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

    if (!formData.item_title.trim()) {
      toast.error("Traktandum-Titel ist erforderlich");
      return;
    }

    if (!formData.topic.trim()) {
      toast.error("Thema ist erforderlich");
      return;
    }

    try {
      if (isEditing) {
        await updateEntry(entry.id, {
          item_title: formData.item_title,
          topic: formData.topic || null,
        });
        toast.success("Traktandum aktualisiert");
      } else {
        await addEntry({
          item_title: formData.item_title,
          topic: formData.topic || null,
          content: null,
          members: [],
        });
        toast.success("Traktandum erstellt");
      }

      setFormData({
        item_title: "",
        topic: "",
      });
      if (onCancel) onCancel();
    } catch (error) {
      toast.error(
        isEditing
          ? "Traktandum konnte nicht aktualisiert werden"
          : "Traktandum konnte nicht erstellt werden",
      );
    }
  };

  return (
    <form className="entry-form card" onSubmit={handleSubmit}>
      <h2>{isEditing ? "Traktandum bearbeiten" : "Neues Traktandum"}</h2>
      <div className="entry-form-fields">
        <div className="entry-form-field">
          <label htmlFor="item_title">Traktandum Titel *</label>
          <input
            type="text"
            id="item_title"
            name="item_title"
            value={formData.item_title}
            onChange={handleChange}
            required
          />
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
        <button type="submit">
          {isEditing ? "Speichern" : "Traktandum erstellen"}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            setFormData({
              item_title: "",
              topic: "",
            });
            if (onCancel) onCancel();
          }}
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}
