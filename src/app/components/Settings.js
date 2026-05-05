'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/useAuthStore';
import MembersList from './MembersList';
import '../../styles/settings.css';

export default function Settings() {
  // *** VARIABLES ***
  const user = useAuthStore((state) => state.user);
  const role = useAuthStore((state) => state.role);
  const setUserName = useAuthStore((state) => state.setUserName);

  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  // *** FUNCTIONS/HANDLERS ***
  useEffect(() => {
    setName(user?.name || '');
  }, [user?.name]);

  const handleSaveName = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Aktualisierung fehlgeschlagen');
      }

      setUserName(data.name);
      toast.success('Name aktualisiert');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings">
      <div className="settings-header">
        <h2>Einstellungen</h2>
      </div>

      <section className="settings-section">
        <h3 className="settings-section-title">Mein Profil</h3>
        <form className="settings-name-form" onSubmit={handleSaveName}>
          <div className="settings-field">
            <label htmlFor="settings-name">Name</label>
            <input
              id="settings-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Vor- und Nachname"
              required
            />
          </div>
          <button
            type="submit"
            className="primary"
            disabled={saving || !name.trim() || name.trim() === (user?.name || '')}
          >
            {saving ? 'Speichern...' : 'Speichern'}
          </button>
        </form>
      </section>

      {role === 'owner' && <MembersList />}
    </div>
  );
}
