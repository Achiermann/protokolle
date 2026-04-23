'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useEntriesStore } from '../stores/useEntriesStore';
import toast from 'react-hot-toast';
import { ArchiveRestore, Trash } from 'lucide-react';
import '../../styles/entry-list.css';

export default function ArchiveList() {
  // *** VARIABLES ***
  const entries = useEntriesStore((state) => state.entries);
  const loading = useEntriesStore((state) => state.loading);
  const fetchEntries = useEntriesStore((state) => state.fetchEntries);
  const updateEntry = useEntriesStore((state) => state.updateEntry);
  const deleteEntry = useEntriesStore((state) => state.deleteEntry);
  const [selectedId, setSelectedId] = useState(null);

  // *** FUNCTIONS/HANDLERS ***
  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const archivedEntries = useMemo(
    () =>
      [...entries]
        .filter((e) => e.archived)
        .sort(
          (a, b) =>
            new Date(b.date_created).getTime() -
            new Date(a.date_created).getTime()
        ),
    [entries]
  );

  const selectedEntry = useMemo(
    () => archivedEntries.find((e) => e.id === selectedId) || null,
    [archivedEntries, selectedId]
  );

  const getTopicColorClass = (topic) => {
    if (!topic) return '';
    let hash = 0;
    for (let i = 0; i < topic.length; i++) {
      hash = (hash * 31 + topic.charCodeAt(i)) | 0;
    }
    return `entry-list-item-topic-c${Math.abs(hash) % 10}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const handleRowClick = (entry) => {
    setSelectedId(selectedId === entry.id ? null : entry.id);
  };

  const handleClosePanel = () => {
    setSelectedId(null);
  };

  const handleRestore = async (id) => {
    try {
      await updateEntry(id, { archived: false });
      if (selectedId === id) setSelectedId(null);
      toast.success('Traktandum wiederhergestellt');
    } catch (error) {
      toast.error('Wiederherstellen fehlgeschlagen');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Bist du sicher, dass du dieses Traktandum löschen willst?')) {
      return;
    }
    try {
      await deleteEntry(id);
      if (selectedId === id) setSelectedId(null);
      toast.success('Traktandum gelöscht');
    } catch (error) {
      toast.error('Traktandum konnte nicht gelöscht werden');
    }
  };

  const renderDetailPanel = () => {
    if (!selectedEntry) return null;
    return (
      <div className="entry-list-detail-panel">
        <div
          className="entry-list-detail-panel-top"
          onClick={handleClosePanel}
        >
          <div className="entry-list-detail-panel-header">
            <h3 className="entry-list-detail-panel-title">
              {selectedEntry.item_title}
              {selectedEntry.created_by_name && (
                <span className="entry-list-item-creator">
                  {' - '}
                  {selectedEntry.created_by_name}
                </span>
              )}
            </h3>
          </div>

          <div className="entry-list-detail-panel-meta">
            {selectedEntry.topic && (
              <span className="entry-list-detail-panel-meta-item">
                <span className="entry-list-detail-panel-meta-label">Thema</span>
                <span>{selectedEntry.topic}</span>
              </span>
            )}
            {selectedEntry.project && (
              <span className="entry-list-detail-panel-meta-item">
                <span className="entry-list-detail-panel-meta-label">
                  Projekt
                </span>
                <span>{selectedEntry.project}</span>
              </span>
            )}
            <span className="entry-list-detail-panel-meta-item">
              <span className="entry-list-detail-panel-meta-label">Datum</span>
              <span>{formatDate(selectedEntry.date_created)}</span>
            </span>
          </div>
          <div className="entry-list-item-actions">
            <button
              type="button"
              className="secondary"
              onClick={(e) => {
                e.stopPropagation();
                handleRestore(selectedEntry.id);
              }}
            >
              <ArchiveRestore size={16} />
            </button>
            <button
              type="button"
              className="secondary"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(selectedEntry.id);
              }}
            >
              <Trash size={16} />
            </button>
          </div>
        </div>

        <div className="entry-list-detail-panel-content">
          <div className="entry-list-detail-panel-content-header">
            <span className="entry-list-detail-panel-meta-label">Inhalt</span>
          </div>
          <p className="entry-list-detail-panel-content-text">
            {selectedEntry.content || (
              <span className="entry-list-detail-panel-content-empty">
                Noch kein Inhalt.
              </span>
            )}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="entry-list">
      <div className="entry-list-header">
        <h2>Archiv</h2>
      </div>

      {loading && <p>Wird geladen...</p>}

      {!loading && archivedEntries.length === 0 && (
        <div className="entry-list-empty">
          <p>Keine archivierten Traktanden.</p>
        </div>
      )}

      {!loading && archivedEntries.length > 0 && (
        <table className="entry-list-table">
          <thead>
            <tr>
              <th>Thema / Projekt</th>
              <th>Traktanden</th>
              <th>Datum</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {archivedEntries.map((entry) => (
              <React.Fragment key={entry.id}>
                {selectedId !== entry.id && (
                  <tr
                    className="entry-list-table-row"
                    onClick={() => handleRowClick(entry)}
                  >
                    <td>
                      <div
                        className={
                          'entry-list-item-topic ' +
                          getTopicColorClass(entry.topic || entry.project)
                        }
                      >
                        {entry.topic || entry.project || '-'}
                      </div>
                    </td>
                    <td>
                      <div className="entry-list-item-title">
                        {entry.item_title}
                        {entry.created_by_name && (
                          <span className="entry-list-item-creator">
                            {' - '}
                            {entry.created_by_name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="entry-list-item-date">
                        {formatDate(entry.date_created)}
                      </div>
                    </td>
                    <td>
                      <div className="entry-list-item-actions">
                        <button
                          type="button"
                          className="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRestore(entry.id);
                          }}
                        >
                          <ArchiveRestore size={16} />
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(entry.id);
                          }}
                        >
                          <Trash size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
                {selectedId === entry.id && (
                  <tr className="entry-list-table-row-detail">
                    <td colSpan={4}>{renderDetailPanel()}</td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
