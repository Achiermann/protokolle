'use client';

import { useEffect, useMemo, useState } from 'react';
import { useEntriesStore } from '../stores/useEntriesStore';
import { Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import '../../styles/entry-list.css';

export default function GroupedList({ field, title, emptyLabel }) {
  // *** VARIABLES ***
  const entries = useEntriesStore((state) => state.entries);
  const loading = useEntriesStore((state) => state.loading);
  const fetchEntries = useEntriesStore((state) => state.fetchEntries);
  const updateEntry = useEntriesStore((state) => state.updateEntry);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState('');

  // *** FUNCTIONS/HANDLERS ***
  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const getGroupColorClass = (value) => {
    if (!value) return 'entry-list-item-topic-circle-none';
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = (hash * 31 + value.charCodeAt(i)) | 0;
    }
    const index = Math.abs(hash) % 10;
    return `entry-list-item-topic-circle-${index}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const groups = useMemo(() => {
    const map = new Map();
    for (const entry of entries) {
      const value = entry[field];
      if (!value) continue;
      if (!map.has(value)) map.set(value, []);
      map.get(value).push(entry);
    }
    return Array.from(map.entries())
      .map(([name, items]) => ({ name, items }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [entries, field]);

  const selectedEntries = useMemo(() => {
    if (!selectedGroup) return [];
    return entries
      .filter((e) => e[field] === selectedGroup)
      .sort(
        (a, b) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime()
      );
  }, [entries, field, selectedGroup]);

  const handleRowClick = (name) => {
    setSelectedGroup(selectedGroup === name ? null : name);
  };

  const handleClosePanel = () => {
    setSelectedGroup(null);
    setEditingId(null);
  };

  const handleEditClick = (entry) => {
    setEditingId(entry.id);
    setEditDraft(entry.content || '');
  };

  const handleSaveEdit = async (id) => {
    try {
      await updateEntry(id, { content: editDraft });
      setEditingId(null);
      toast.success('Inhalt aktualisiert');
    } catch (error) {
      toast.error('Inhalt konnte nicht aktualisiert werden');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  return (
    <div className="entry-list">
      <div className="entry-list-header">
        <h2>{title}</h2>
      </div>

      {selectedGroup && (
        <div className="entry-list-detail-panel">
          <div className="entry-list-detail-panel-header">
            <h3 className="entry-list-detail-panel-title">{selectedGroup}</h3>
            <button
              type="button"
              className="secondary entry-list-detail-panel-close"
              onClick={handleClosePanel}
            >
              ✕
            </button>
          </div>

          <div className="entry-list-detail-panel-content">
            <span className="entry-list-detail-panel-meta-label">Traktanden</span>
            {selectedEntries.length === 0 ? (
              <p className="entry-list-detail-panel-content-empty">
                Noch keine Traktanden.
              </p>
            ) : (
              <div className="grouped-list-traktanden">
                {selectedEntries.map((entry) => (
                  <div key={entry.id} className="grouped-list-traktanden-section">
                    <div className="grouped-list-traktanden-section-header">
                      <strong className="grouped-list-traktanden-title">
                        {entry.item_title}
                      </strong>
                      <span className="grouped-list-traktanden-date">
                        {formatDate(entry.date_created)}
                      </span>
                    </div>
                    {editingId === entry.id ? (
                      <>
                        <textarea
                          className="entry-list-detail-panel-content-textarea"
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                        />
                        <div className="entry-list-detail-panel-content-actions">
                          <button type="button" className="primary" onClick={() => handleSaveEdit(entry.id)}>
                            Speichern
                          </button>
                          <button type="button" className="secondary" onClick={handleCancelEdit}>
                            Abbrechen
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        {entry.content && (
                          <p className="grouped-list-traktanden-content">
                            {entry.content}
                          </p>
                        )}
                        <button
                          type="button"
                          className="secondary edit-hover-button"
                          onClick={() => handleEditClick(entry)}
                        >
                          <Pencil size={16} />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {loading && <p>Wird geladen...</p>}

      {!loading && groups.length === 0 && (
        <div className="entry-list-empty">
          <p>{emptyLabel}</p>
        </div>
      )}

      {!loading && groups.length > 0 && (
        <table className="entry-list-table">
          <thead>
            <tr>
              <th>{title}</th>
              <th>Anzahl</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <tr
                key={group.name}
                className={
                  selectedGroup === group.name
                    ? 'entry-list-table-row entry-list-table-row-selected'
                    : 'entry-list-table-row'
                }
                onClick={() => handleRowClick(group.name)}
              >
                <td>
                  <div className="entry-list-item-topic">
                    <span
                      className={`entry-list-item-topic-circle ${getGroupColorClass(group.name)}`}
                    />
                    {group.name}
                  </div>
                </td>
                <td>
                  <div className="entry-list-item-date">{group.items.length}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
