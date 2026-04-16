'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useEntriesStore } from '../stores/useEntriesStore';
import { useTodosStore } from '../stores/useTodosStore';
import toast from 'react-hot-toast';
import { Pencil, MailPlus, MailMinus, Trash } from 'lucide-react';
import '../../styles/entry-list.css';
import '../../styles/filters.css';

export default function EntryList({ contentFilter, title = 'Alle Traktanden' }) {
  // *** VARIABLES ***
  const entries = useEntriesStore((state) => state.entries);
  const loading = useEntriesStore((state) => state.loading);
  const fetchEntries = useEntriesStore((state) => state.fetchEntries);
  const deleteEntry = useEntriesStore((state) => state.deleteEntry);
  const updateEntry = useEntriesStore((state) => state.updateEntry);
  const addTodo = useTodosStore((state) => state.addTodo);

  const [filterTopicProject, setFilterTopicProject] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [selectedId, setSelectedId] = useState(null);
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [contentDraft, setContentDraft] = useState('');
  const contentTextareaRef = useRef(null);

  // *** FUNCTIONS/HANDLERS ***
  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const selectedEntry = useMemo(
    () => entries.find((e) => e.id === selectedId) || null,
    [entries, selectedId]
  );

  const handleRowClick = (entry) => {
    if (selectedId === entry.id) {
      setSelectedId(null);
      setIsEditingContent(false);
    } else {
      setSelectedId(entry.id);
      setIsEditingContent(false);
      setContentDraft(entry.content || '');
    }
  };

  const handleEditContent = () => {
    setContentDraft(selectedEntry?.content || '');
    setIsEditingContent(true);
  };

  const handleSaveContent = async () => {
    try {
      await updateEntry(selectedId, { content: contentDraft });
      setIsEditingContent(false);
      toast.success('Inhalt aktualisiert');
    } catch (error) {
      toast.error('Inhalt konnte nicht aktualisiert werden');
    }
  };

  const wrapSelection = (before, after) => {
    const textarea = contentTextareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = contentDraft;
    const selected = value.slice(start, end);
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    setContentDraft(next);
    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + before.length + selected.length + after.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  const handleBold = () => wrapSelection('**', '**');
  const handleItalic = () => wrapSelection('*', '*');
  const handleUnderline = () => wrapSelection('__', '__');

  const handleExtractTodo = async () => {
    const textarea = contentTextareaRef.current;
    let todoTitle = '';
    let removeStart = -1;
    let removeEnd = -1;

    if (textarea && textarea.selectionStart !== textarea.selectionEnd) {
      removeStart = textarea.selectionStart;
      removeEnd = textarea.selectionEnd;
      todoTitle = contentDraft.slice(removeStart, removeEnd).trim();
    } else {
      const markerMatch = contentDraft.match(/(^|\n)\s*(?:#todo|todo:)\s+([^\n]+)/i);
      if (markerMatch) {
        todoTitle = markerMatch[2].trim();
        removeStart = contentDraft.indexOf(markerMatch[0]);
        removeEnd = removeStart + markerMatch[0].length;
      } else if (textarea) {
        const cursor = textarea.selectionStart;
        const lineStart = contentDraft.lastIndexOf('\n', cursor - 1) + 1;
        const nextNewline = contentDraft.indexOf('\n', cursor);
        const lineEnd = nextNewline === -1 ? contentDraft.length : nextNewline;
        todoTitle = contentDraft.slice(lineStart, lineEnd).trim();
        removeStart = lineStart;
        removeEnd = lineEnd;
      }
    }

    if (!todoTitle) {
      toast.error('Text markieren oder Cursor auf eine Zeile setzen');
      return;
    }

    const newContent = (
      contentDraft.slice(0, removeStart) + contentDraft.slice(removeEnd)
    )
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    try {
      await addTodo({
        title: todoTitle,
        topic: selectedEntry?.topic || null,
        project: selectedEntry?.project || null,
      });
      await updateEntry(selectedId, { content: newContent });
      setContentDraft(newContent);
      toast.success('ToDo hinzugefügt');
    } catch (error) {
      toast.error('ToDo konnte nicht hinzugefügt werden');
    }
  };

  const handleCancelEdit = () => {
    setIsEditingContent(false);
    setContentDraft(selectedEntry?.content || '');
  };

  const handleClosePanel = () => {
    setSelectedId(null);
    setIsEditingContent(false);
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

  const handleSendToPosteingang = async (id) => {
    try {
      await updateEntry(id, { in_posteingang: true });
      toast.success('In Posteingang verschoben');
    } catch (error) {
      toast.error('Verschieben fehlgeschlagen');
    }
  };

  const handleRemoveFromPosteingang = async (id) => {
    try {
      await updateEntry(id, { in_posteingang: false });
      toast.success('Aus Posteingang entfernt');
    } catch (error) {
      toast.error('Entfernen fehlgeschlagen');
    }
  };

  const isInPosteingang = (entry) => {
    return entry.in_posteingang || entry.topic === 'posteingang';
  };

  const handleClearFilters = () => {
    setFilterTopicProject('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setSortBy('date');
    setSortDir('desc');
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir(column === 'date' ? 'desc' : 'asc');
    }
  };

  const getSortValue = (entry, column) => {
    if (column === 'title') return (entry.item_title || '').toLowerCase();
    if (column === 'topic') return (entry.topic || entry.project || '').toLowerCase();
    return new Date(entry.date_created).getTime();
  };

  const sortIndicator = (column) => {
    if (sortBy !== column) return '';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  };

  const getTopicColorClass = (topic) => {
    if (!topic) return 'entry-list-item-topic-circle-none';
    let hash = 0;
    for (let i = 0; i < topic.length; i++) {
      hash = (hash * 31 + topic.charCodeAt(i)) | 0;
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

  const filteredAndSortedEntries = useMemo(() => {
    let result = [...entries];

    if (contentFilter === 'with') {
      result = result.filter((entry) => entry.content);
    } else if (contentFilter === 'without') {
      result = result.filter((entry) => !entry.content);
    }

    if (filterTopicProject) {
      const searchTerm = filterTopicProject.toLowerCase();
      result = result.filter(
        (entry) =>
          (entry.topic && entry.topic.toLowerCase().includes(searchTerm)) ||
          (entry.project && entry.project.toLowerCase().includes(searchTerm))
      );
    }

    if (filterDateFrom) {
      const fromDate = new Date(filterDateFrom);
      result = result.filter(
        (entry) => new Date(entry.date_created) >= fromDate
      );
    }

    if (filterDateTo) {
      const toDate = new Date(filterDateTo);
      toDate.setHours(23, 59, 59, 999);
      result = result.filter(
        (entry) => new Date(entry.date_created) <= toDate
      );
    }

    result.sort((a, b) => {
      const valA = getSortValue(a, sortBy);
      const valB = getSortValue(b, sortBy);
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [entries, contentFilter, filterTopicProject, filterDateFrom, filterDateTo, sortBy, sortDir]);

  const groupedEntries = useMemo(() => {
    if (contentFilter !== 'without') return [];
    const posteingang = [];
    const map = new Map();
    for (const entry of filteredAndSortedEntries) {
      if (isInPosteingang(entry)) {
        posteingang.push(entry);
      } else {
        const group = entry.topic || entry.project || 'ohne thema';
        if (!map.has(group)) map.set(group, []);
        map.get(group).push(entry);
      }
    }
    const groups = Array.from(map.entries()).map(([name, items]) => ({ name, items }));
    return [{ name: 'posteingang', items: posteingang }, ...groups];
  }, [contentFilter, filteredAndSortedEntries]);

  const renderDetailPanel = () => {
    if (!selectedEntry) return null;
    return (
      <div className="entry-list-detail-panel">
        <div className="entry-list-detail-panel-header">
          <h3 className="entry-list-detail-panel-title">{selectedEntry.item_title}</h3>
          <button
            type="button"
            className="secondary entry-list-detail-panel-close"
            onClick={handleClosePanel}
          >
            ✕
          </button>
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
              <span className="entry-list-detail-panel-meta-label">Projekt</span>
              <span>{selectedEntry.project}</span>
            </span>
          )}
          <span className="entry-list-detail-panel-meta-item">
            <span className="entry-list-detail-panel-meta-label">Datum</span>
            <span>{formatDate(selectedEntry.date_created)}</span>
          </span>
        </div>

        <div className="entry-list-detail-panel-content">
          <div className="entry-list-detail-panel-content-header">
            <span className="entry-list-detail-panel-meta-label">Inhalt</span>
          </div>
          {isEditingContent ? (
            <>
              <div className="entry-list-detail-panel-content-toolbar">
                <button type="button" className="secondary" onClick={handleBold}>
                  <strong>B</strong>
                </button>
                <button type="button" className="secondary" onClick={handleItalic}>
                  <em>I</em>
                </button>
                <button type="button" className="secondary" onClick={handleUnderline}>
                  <u>U</u>
                </button>
                <button type="button" className="secondary" onClick={handleExtractTodo}>
                  + ToDo
                </button>
              </div>
              <textarea
                ref={contentTextareaRef}
                className="entry-list-detail-panel-content-textarea"
                value={contentDraft}
                onChange={(e) => setContentDraft(e.target.value)}
                placeholder="Sitzungsnotizen hier schreiben... Text markieren (oder Cursor auf Zeile setzen) und + ToDo klicken."
              />
              <div className="entry-list-detail-panel-content-actions">
                <button type="button" className="primary" onClick={handleSaveContent}>
                  Speichern
                </button>
                <button type="button" className="secondary" onClick={handleCancelEdit}>
                  Abbrechen
                </button>
              </div>
            </>
          ) : (
            <div className="edit-hover-wrapper">
              <p className="entry-list-detail-panel-content-text">
                {selectedEntry.content || (
                  <span className="entry-list-detail-panel-content-empty">
                    Noch kein Inhalt.
                  </span>
                )}
              </p>
              <button type="button" className="secondary edit-hover-button" onClick={handleEditContent}>
                <Pencil size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="entry-list">
      <div className="entry-list-header">
        <h2>{title}</h2>
      </div>

      <div className="filters-container">
        <div className="filter-field">
          <label htmlFor="filter-topic-project">Thema / Projekt</label>
          <input
            type="text"
            id="filter-topic-project"
            value={filterTopicProject}
            onChange={(e) => setFilterTopicProject(e.target.value)}
            placeholder="Nach Thema oder Projekt filtern..."
          />
        </div>

        <div className="filter-field">
          <label htmlFor="filter-date-from">Datum von</label>
          <input
            type="date"
            id="filter-date-from"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
          />
        </div>

        <div className="filter-field">
          <label htmlFor="filter-date-to">Datum bis</label>
          <input
            type="date"
            id="filter-date-to"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
          />
        </div>

        <div className="filter-actions">
          <button type="button" className="secondary" onClick={handleClearFilters}>
            Filter zurücksetzen
          </button>
        </div>
      </div>

      {loading && <p>Traktanden werden geladen...</p>}

      {!loading && filteredAndSortedEntries.length === 0 && entries.length === 0 && (
        <div className="entry-list-empty">
          <p>Noch keine Traktanden. Erstelle dein erstes Traktandum.</p>
        </div>
      )}

      {!loading && filteredAndSortedEntries.length === 0 && entries.length > 0 && (
        <div className="entry-list-empty">
          <p>Keine Traktanden entsprechen deinen Filtern.</p>
        </div>
      )}

      {!loading && filteredAndSortedEntries.length > 0 && contentFilter === 'without' && (
        <div className="grouped-list-traktanden">
          {groupedEntries.map((group) => (
            <div key={group.name} className="grouped-list-traktanden-section">
              <strong className="grouped-list-traktanden-title">
                {group.name}
              </strong>
              {group.items.map((entry) => (
                <div key={entry.id}>
                  <div
                    className={
                      selectedId === entry.id
                        ? 'entry-list-open-item entry-list-open-item-selected'
                        : 'entry-list-open-item'
                    }
                    onClick={() => handleRowClick(entry)}
                  >
                    <span className="entry-list-open-item-title">{entry.item_title}</span>
                    <div className="entry-list-item-actions">
                      {isInPosteingang(entry) && entry.topic !== 'posteingang' && (
                        <button
                          className="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFromPosteingang(entry.id);
                          }}
                        >
                          <MailMinus size={16} />
                        </button>
                      )}
                      {!isInPosteingang(entry) && (
                        <button
                          className="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSendToPosteingang(entry.id);
                          }}
                        >
                          <MailPlus size={16} />
                        </button>
                      )}
                      <button
                        className="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(entry.id);
                        }}
                      >
                        <Trash size={16} />
                      </button>
                    </div>
                  </div>
                  {selectedId === entry.id && renderDetailPanel()}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {!loading && filteredAndSortedEntries.length > 0 && contentFilter !== 'without' && (
        <table className="entry-list-table">
          <thead>
            <tr>
              <th
                className="entry-list-table-th-sortable"
                onClick={() => handleSort('title')}
              >
                Traktanden{sortIndicator('title')}
              </th>
              <th
                className="entry-list-table-th-sortable"
                onClick={() => handleSort('topic')}
              >
                Thema{sortIndicator('topic')}
              </th>
              <th
                className="entry-list-table-th-sortable"
                onClick={() => handleSort('date')}
              >
                Datum{sortIndicator('date')}
              </th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedEntries.map((entry) => (
              <React.Fragment key={entry.id}>
              <tr
                className={
                  selectedId === entry.id
                    ? 'entry-list-table-row entry-list-table-row-selected'
                    : 'entry-list-table-row'
                }
                onClick={() => handleRowClick(entry)}
              >
                <td>
                  <div className="entry-list-item-title">{entry.item_title}</div>
                </td>
                <td>
                  <div className="entry-list-item-topic">
                    <span
                      className={`entry-list-item-topic-circle ${getTopicColorClass(entry.topic || entry.project)}`}
                    />
                    {entry.topic || entry.project || '-'}
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
              {selectedId === entry.id && (
                <tr className="entry-list-table-row-detail">
                  <td colSpan={4}>
                    {renderDetailPanel()}
                  </td>
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
