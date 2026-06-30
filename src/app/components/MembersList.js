"use client";

import { useState, useEffect } from "react";
import { UserPlus, Trash } from "lucide-react";
import toast from "react-hot-toast";
import { useWorkspacesStore } from "../stores/useWorkspacesStore";
import "../../styles/members-list.css";

export default function MembersList() {
  // *** VARIABLES ***
  const members = useWorkspacesStore((state) => state.members);
  const callerRole = useWorkspacesStore((state) => state.callerRole);
  const loading = useWorkspacesStore((state) => state.loadingMembers);
  const fetchMembers = useWorkspacesStore((state) => state.fetchMembers);
  const inviteMember = useWorkspacesStore((state) => state.inviteMember);
  const removeMember = useWorkspacesStore((state) => state.removeMember);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);

  // *** FUNCTIONS/HANDLERS ***
  useEffect(() => {
    fetchMembers().catch(() =>
      toast.error("Mitglieder konnten nicht geladen werden"),
    );
  }, [fetchMembers]);

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviting(true);
    try {
      await inviteMember(inviteEmail.trim());
      toast.success("Mitglied hinzugefügt");
      setInviteEmail("");
      setShowInviteForm(false);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (memberId) => {
    if (!confirm("Mitglied wirklich entfernen?")) return;

    try {
      await removeMember(memberId);
      toast.success("Mitglied entfernt");
    } catch (error) {
      toast.error(error.message);
    }
  };

  const getRoleLabel = (role) => {
    if (role === "owner") return "Besitzer";
    return "Mitglied";
  };

  return (
    <div className="members-list">
      <h3 className="members-list-section-title">Mitglieder</h3>

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
              {inviting ? "Wird eingeladen..." : "Einladen"}
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
              <th className="table-header-cell">E-Mail</th>
              <th className="table-header-cell">Rolle</th>
              {callerRole === "owner" && <th className="table-header-cell">Aktionen</th>}
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
                {callerRole === "owner" && (
                  <td>
                    {member.role !== "owner" && (
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
