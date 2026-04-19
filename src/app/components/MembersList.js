'use client';

import { useState, useEffect } from 'react';
import { UserPlus, Trash } from 'lucide-react';
import toast from 'react-hot-toast';
import '../../styles/members-list.css';

export default function MembersList() {
  // *** VARIABLES ***
  const [members, setMembers] = useState([]);
  const [callerRole, setCallerRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);

  // *** FUNCTIONS/HANDLERS ***
  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const response = await fetch('/api/workspaces/members');
      if (!response.ok) throw new Error('Laden fehlgeschlagen');
      const data = await response.json();
      setMembers(data.items || []);
      setCallerRole(data.callerRole);
    } catch (error) {
      toast.error('Mitglieder konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviting(true);
    try {
      const response = await fetch('/api/workspaces/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Einladung fehlgeschlagen');
      }

      toast.success('Mitglied hinzugefügt');
      setInviteEmail('');
      setShowInviteForm(false);
      fetchMembers();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (memberId) => {
    if (!confirm('Mitglied wirklich entfernen?')) return;

    try {
      const response = await fetch('/api/workspaces/members', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: memberId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Entfernen fehlgeschlagen');
      }

      toast.success('Mitglied entfernt');
      fetchMembers();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const getRoleLabel = (role) => {
    if (role === 'owner') return 'Besitzer';
    return 'Mitglied';
  };

  return (
    <div className="members-list">
      <div className="members-list-header">
        <h2>Mitglieder</h2>
      </div>

      <button
        type="button"
        className="members-list-invite-toggle"
        onClick={() => setShowInviteForm(!showInviteForm)}
      >
        <UserPlus size={18} />
        Mitglied einladen
      </button>

      {showInviteForm && (
        <form className="members-list-invite-form" onSubmit={handleInvite}>
          <div className="members-list-invite-row">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="E-Mail-Adresse eingeben"
              required
            />
            <button type="submit" className="primary" disabled={inviting}>
              {inviting ? 'Wird eingeladen...' : 'Einladen'}
            </button>
          </div>
          <p className="members-list-invite-hint">
            Die Person muss bereits ein Konto haben.
          </p>
        </form>
      )}

      {loading && <p>Wird geladen...</p>}

      {!loading && members.length === 0 && (
        <div className="members-list-empty">
          <p>Noch keine Mitglieder.</p>
        </div>
      )}

      {!loading && members.length > 0 && (
        <table className="members-list-table">
          <thead>
            <tr>
              <th>E-Mail</th>
              <th>Rolle</th>
              {callerRole === 'owner' && <th>Aktionen</th>}
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id}>
                <td>
                  <div className="members-list-item-email">
                    {member.name
                      ? `${member.name} (${member.email})`
                      : member.email}
                  </div>
                </td>
                <td>
                  <div className="members-list-item-role">
                    {getRoleLabel(member.role)}
                  </div>
                </td>
                {callerRole === 'owner' && (
                  <td>
                    {member.role !== 'owner' && (
                      <button
                        className="secondary"
                        onClick={() => handleRemove(member.id)}
                      >
                        <Trash size={16} />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
