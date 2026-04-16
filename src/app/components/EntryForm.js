'use client';

import { useState } from 'react';
import { useEntriesStore } from '../stores/useEntriesStore';
import toast from 'react-hot-toast';
import '../../styles/entry-form.css';

export default function EntryForm({ onCancel }) {
  // *** VARIABLES ***
  const addEntry = useEntriesStore((state) => state.addEntry);
  const [formData, setFormData] = useState({
    item_title: '',
    topic: '',
    project: '',
  });

  // *** FUNCTIONS/HANDLERS ***
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.item_title.trim()) {
      toast.error('Traktandum-Titel ist erforderlich');
      return;
    }

    if (!formData.topic.trim() && !formData.project.trim()) {
      toast.error('Thema oder Projekt ist erforderlich');
      return;
    }

    try {
      await addEntry({
        item_title: formData.item_title,
        topic: formData.topic || null,
        project: formData.project || null,
        content: null,
        members: [],
      });

      toast.success('Traktandum erstellt');
      setFormData({
        item_title: '',
        topic: '',
        project: '',
      });
      if (onCancel) onCancel();
    } catch (error) {
      toast.error('Traktandum konnte nicht erstellt werden');
    }
  };

  return (
    <form className="entry-form card" onSubmit={handleSubmit}>
      <h2>Neues Traktandum</h2>
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
          <input
            type="text"
            id="topic"
            name="topic"
            value={formData.topic}
            onChange={handleChange}
          />
        </div>

        <div className="entry-form-field">
          <label htmlFor="project">Projekt</label>
          <input
            type="text"
            id="project"
            name="project"
            value={formData.project}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className="entry-form-actions">
        <button type="submit">Traktandum erstellen</button>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            setFormData({
              item_title: '',
              topic: '',
              project: '',
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
