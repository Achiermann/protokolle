'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useEntriesStore } from '../stores/useEntriesStore';
import { Pencil, Archive } from 'lucide-react';
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
  const [members, setMembers] = useState([]);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [todoInsertPos, setTodoInsertPos] = useState(null);
  const contentTextareaRef = useRef(null);

  // *** FUNCTIONS/HANDLERS ***
  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const getTopicColorClass = (value) => {
    if (!value) return '';
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = (hash * 31 + value.charCodeAt(i)) | 0;
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

  const groups = useMemo(() => {
    const map = new Map();
    for (const entry of entries) {
      if (!entry.content) continue;
      if (entry.archived) continue;
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
      .filter((e) => e.content && !e.archived && e[field] === selectedGroup)
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

  const wrapSelection = (before, after) => {
    const textarea = contentTextareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = editDraft;
    const selected = value.slice(start, end);
    const next =
      value.slice(0, start) + before + selected + after + value.slice(end);
    setEditDraft(next);
    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + before.length + selected.length + after.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  const handleBold = () => wrapSelection('**', '**');
  const handleItalic = () => wrapSelection('*', '*');
  const handleUnderline = () => wrapSelection('__', '__');

  const loadMembers = async () => {
    try {
      const response = await fetch('/api/workspaces/members');
      if (!response.ok) throw new Error('fail');
      const data = await response.json();
      setMembers(data.items || []);
    } catch (error) {
      toast.error('Mitglieder konnten nicht geladen werden');
    }
  };

  const handleInsertTodo = async () => {
    const textarea = contentTextareaRef.current;
    if (!textarea) return;
    if (members.length === 0) await loadMembers();

    const pos = textarea.selectionStart;
    const prefix = '/todo';
    const next = editDraft.slice(0, pos) + prefix + editDraft.slice(pos);
    setEditDraft(next);
    setTodoInsertPos(pos);
    setShowMemberDropdown(true);
    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = pos + prefix.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  const handleSelectMember = (member) => {
    if (todoInsertPos === null) return;
    const rawName = member.name || member.email.split('@')[0];
    const nameTag = rawName.replace(/\s+/g, '_');
    const replacement = `/todo@${nameTag} `;
    const before = editDraft.slice(0, todoInsertPos);
    const after = editDraft.slice(todoInsertPos + '/todo'.length);
    const nextContent = before + replacement + after;
    const cursor = todoInsertPos + replacement.length;
    setEditDraft(nextContent);
    setShowMemberDropdown(false);
    setTodoInsertPos(null);
    requestAnimationFrame(() => {
      const textarea = contentTextareaRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  const handleCancelMemberDropdown = () => {
    setShowMemberDropdown(false);
    setTodoInsertPos(null);
  };

  const handleArchiveGroup = async (name) => {
    const toArchive = entries.filter(
      (e) => !e.archived && e[field] === name
    );
    if (toArchive.length === 0) return;
    if (
      !confirm(
        `Alle ${toArchive.length} Traktanden in "${name}" archivieren?`
      )
    ) {
      return;
    }
    try {
      await Promise.all(
        toArchive.map((e) => updateEntry(e.id, { archived: true }))
      );
      if (selectedGroup === name) setSelectedGroup(null);
      toast.success('Traktanden archiviert');
    } catch (error) {
      toast.error('Archivieren fehlgeschlagen');
    }
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
                {selectedEntries.map((entry) =>
                (
                <div key={entry.id} className={'grouped-list-traktanden-section ' + (entry.item_title === "posteingang" ? `posteingang` : ``)}>
                    <div className="grouped-list-traktanden-section-header">
                      <strong className="grouped-list-traktanden-title">
                        {entry.item_title}
                        {entry.created_by_name && (
                          <span className="entry-list-item-creator">
                            {" - "}
                            {entry.created_by_name}
                          </span>
                        )}
                      </strong>
                      <span className="grouped-list-traktanden-date">
                        {formatDate(entry.date_created)}
                      </span>
                    </div>
                    {editingId === entry.id ? (
                      <>
                        <div className="entry-list-detail-panel-content-toolbar">
                          <button
                            type="button"
                            className="secondary"
                            onClick={handleBold}
                          >
                            <strong>B</strong>
                          </button>
                          <button
                            type="button"
                            className="secondary"
                            onClick={handleItalic}
                          >
                            <em>I</em>
                          </button>
                          <button
                            type="button"
                            className="secondary"
                            onClick={handleUnderline}
                          >
                            <u>U</u>
                          </button>
                          <button
                            type="button"
                            className="secondary"
                            onClick={handleInsertTodo}
                          >
                            + ToDo
                          </button>
                        </div>
                        {showMemberDropdown && (
                          <div className="entry-list-detail-panel-member-dropdown">
                            {members.map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                className="secondary"
                                onClick={() => handleSelectMember(m)}
                              >
                                {m.name || m.email}
                              </button>
                            ))}
                            <button
                              type="button"
                              className="secondary"
                              onClick={handleCancelMemberDropdown}
                            >
                              Abbrechen
                            </button>
                          </div>
                        )}
                        <textarea
                          ref={contentTextareaRef}
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
              <th>Aktionen</th>
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
                  <div
                    className={
                      'entry-list-item-topic ' + getTopicColorClass(group.name)
                    }
                  >
                    {group.name}
                  </div>
                </td>
                <td>
                  <div className="entry-list-item-date">{group.items.length}</div>
                </td>
                <td>
                  <div className="entry-list-item-actions">
                    <button
                      type="button"
                      className="secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleArchiveGroup(group.name);
                      }}
                    >
                      <Archive size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
