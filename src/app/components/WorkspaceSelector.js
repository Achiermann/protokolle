'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import '../../styles/workspace-selector.css';

export default function WorkspaceSelector() {
  // *** VARIABLES ***
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  // *** FUNCTIONS/HANDLERS ***
  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const fetchWorkspaces = async () => {
    try {
      const response = await fetch('/api/workspaces');
      if (!response.ok) throw new Error('Laden fehlgeschlagen');
      const data = await response.json();
      setWorkspaces(data.items || []);

      if ((data.items || []).length === 0) {
        setShowCreateForm(true);
      }
    } catch (error) {
      toast.error('Workspaces konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (workspaceId) => {
    try {
      const response = await fetch('/api/workspaces/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId }),
      });

      if (!response.ok) throw new Error('Auswahl fehlgeschlagen');

      router.push('/');
    } catch (error) {
      toast.error('Workspace konnte nicht ausgewählt werden');
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) {
      toast.error('Name ist erforderlich');
      return;
    }

    setCreating(true);
    try {
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });

      if (!response.ok) throw new Error('Erstellen fehlgeschlagen');

      const data = await response.json();
      toast.success('Workspace erstellt');

      // Auto-select the newly created workspace
      await handleSelect(data.item.id);
    } catch (error) {
      toast.error('Workspace konnte nicht erstellt werden');
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      toast.error('Abmeldung fehlgeschlagen');
    }
  };

  return (
    <div className="workspace-page">
      <div className="workspace-container card">
        <h1 className="workspace-title">Workspace wählen</h1>

        {loading && <p className="workspace-loading">Wird geladen...</p>}

        {!loading && workspaces.length > 0 && (
          <div className="workspace-list">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                className="workspace-item"
                onClick={() => handleSelect(ws.id)}
              >
                <span className="workspace-item-name">{ws.name}</span>
                <span className="workspace-item-role">{ws.role}</span>
              </button>
            ))}
          </div>
        )}

        {!loading && !showCreateForm && (
          <button
            type="button"
            className="secondary workspace-create-toggle"
            onClick={() => setShowCreateForm(true)}
          >
            Neuen Workspace erstellen
          </button>
        )}

        {!loading && showCreateForm && (
          <form className="workspace-create-form" onSubmit={handleCreate}>
            {workspaces.length === 0 && (
              <p className="workspace-empty-hint">
                Du hast noch keinen Workspace. Erstelle einen, um zu beginnen.
              </p>
            )}
            <div className="workspace-create-field">
              <label htmlFor="workspace-name">Workspace-Name</label>
              <input
                id="workspace-name"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="z.B. Soybomb"
                required
              />
            </div>
            <button type="submit" className="primary" disabled={creating}>
              {creating ? 'Wird erstellt...' : 'Workspace erstellen'}
            </button>
          </form>
        )}

        <button
          type="button"
          className="workspace-logout-button"
          onClick={handleLogout}
        >
          Abmelden
        </button>
      </div>
    </div>
  );
}
