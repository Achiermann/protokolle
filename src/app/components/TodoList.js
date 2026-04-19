'use client';

import { useEffect, useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useEntriesStore } from '../stores/useEntriesStore';
import '../../styles/todo-list.css';

export default function TodoList() {
  // *** VARIABLES ***
  const entries = useEntriesStore((state) => state.entries);
  const loading = useEntriesStore((state) => state.loading);
  const fetchEntries = useEntriesStore((state) => state.fetchEntries);
  const updateEntry = useEntriesStore((state) => state.updateEntry);

  // *** FUNCTIONS/HANDLERS ***
  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const getMemberColorClass = (name) => {
    if (!name) return 'todo-list-item-member-circle-none';
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = (hash * 31 + name.charCodeAt(i)) | 0;
    }
    const index = Math.abs(hash) % 10;
    return `todo-list-item-member-circle-${index}`;
  };

  const todos = useMemo(() => {
    const out = [];
    const regex = /\/(todo|done)@(\S+)[ \t]+([^\n]+)/g;
    for (const entry of entries) {
      if (!entry.content) continue;
      let match;
      regex.lastIndex = 0;
      while ((match = regex.exec(entry.content)) !== null) {
        out.push({
          id: `${entry.id}-${match.index}`,
          entryId: entry.id,
          matchStart: match.index,
          prefix: `/${match[1]}`,
          isDone: match[1] === 'done',
          assignee: match[2].replace(/_/g, ' '),
          title: match[3].trim(),
          topic: entry.topic,
          project: entry.project,
          date: entry.date_created,
        });
      }
    }
    return out;
  }, [entries]);

  const activeTodos = useMemo(
    () => todos.filter((t) => !t.isDone),
    [todos],
  );
  const doneTodos = useMemo(() => todos.filter((t) => t.isDone), [todos]);

  const toggleDone = async (todo) => {
    const entry = entries.find((e) => e.id === todo.entryId);
    if (!entry || !entry.content) return;
    const content = entry.content;
    const replacement = todo.isDone ? '/todo' : '/done';
    const newContent =
      content.slice(0, todo.matchStart) +
      replacement +
      content.slice(todo.matchStart + todo.prefix.length);
    try {
      await updateEntry(todo.entryId, { content: newContent });
    } catch (error) {
      toast.error('Aktualisierung fehlgeschlagen');
    }
  };

  const renderMemberCell = (todo) => (
    <div className="todo-list-item-member">
      <span
        className={`todo-list-item-member-circle ${getMemberColorClass(todo.assignee)}`}
      />
      {todo.assignee}
    </div>
  );

  return (
    <div className="todo-list">
      <div className="todo-list-header">
        <h2>ToDo</h2>
      </div>

      {loading && <p>ToDos werden geladen...</p>}

      {!loading && activeTodos.length === 0 && (
        <div className="todo-list-empty">
          <p>Noch keine ToDos.</p>
        </div>
      )}

      {!loading && activeTodos.length > 0 && (
        <table className="todo-list-table">
          <thead>
            <tr>
              <th className="todo-list-table-th-check"></th>
              <th>Für</th>
              <th>ToDo</th>
              <th>Thema / Projekt</th>
              <th>Datum</th>
            </tr>
          </thead>
          <tbody>
            {activeTodos.map((todo) => (
              <tr key={todo.id}>
                <td className="todo-list-table-td-check">
                  <input
                    type="checkbox"
                    checked={false}
                    onChange={() => toggleDone(todo)}
                  />
                </td>
                <td>{renderMemberCell(todo)}</td>
                <td>
                  <div className="todo-list-item-title">{todo.title}</div>
                </td>
                <td>
                  <div className="todo-list-item-todo">
                    {todo.topic || todo.project || '-'}
                  </div>
                </td>
                <td>
                  <div className="todo-list-item-date">
                    {formatDate(todo.date)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && doneTodos.length > 0 && (
        <>
          <div className="todo-list-header todo-list-header-done">
            <h2>Erledigt</h2>
          </div>
          <table className="todo-list-table">
            <thead>
              <tr>
                <th className="todo-list-table-th-check"></th>
                <th>Für</th>
                <th>ToDo</th>
                <th>Thema / Projekt</th>
                <th>Datum</th>
              </tr>
            </thead>
            <tbody>
              {doneTodos.map((todo) => (
                <tr key={todo.id} className="todo-list-row-done">
                  <td className="todo-list-table-td-check">
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => toggleDone(todo)}
                      title="Zurück zu offen"
                    >
                      <RotateCcw size={16} />
                    </button>
                  </td>
                  <td>{renderMemberCell(todo)}</td>
                  <td>
                    <div className="todo-list-item-title">{todo.title}</div>
                  </td>
                  <td>
                    <div className="todo-list-item-todo">
                      {todo.topic || todo.project || '-'}
                    </div>
                  </td>
                  <td>
                    <div className="todo-list-item-date">
                      {formatDate(todo.date)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
