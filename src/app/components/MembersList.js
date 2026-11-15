"use client";

import { useState, useEffect } from "react";
import { UserPlus, Trash } from "lucide-react";
import toast from "react-hot-toast";
import { useWorkspacesStore } from "../stores/useWorkspacesStore";
import { isAdminRole, useAuthStore } from "../stores/useAuthStore";
import "../../styles/members-list.css";

export default function MembersList() {
  // *** VARIABLES ***
  const members = useWorkspacesStore((state) => state.members);
  const invitations = useWorkspacesStore((state) => state.invitations);
  const removeInvitation = useWorkspacesStore(
    (state) => state.removeInvitation,
  );
  const callerRole = useWorkspacesStore((state) => state.callerRole);
  const loading = useWorkspacesStore((state) => state.loadingMembers);
  const fetchMembers = useWorkspacesStore((state) => state.fetchMembers);
  const inviteMember = useWorkspacesStore((state) => state.inviteMember);
  const removeMember = useWorkspacesStore((state) => state.removeMember);
  const setMemberAdmin = useWorkspacesStore((state) => state.setMemberAdmin);
  const userId = useAuthStore((state) => state.user?.id);
  const canManage = isAdminRole(callerRole);
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
      const result = await inviteMember(inviteEmail.trim());
      toast.success(
        result?.pending
          ? "Eingeladen – wird beim ersten Anmelden Mitglied"
          : "Mitglied hinzugefügt",
      );
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

  const handleRemoveInvitation = async (invitationId) => {
    if (!confirm("Einladung wirklich zurückziehen?")) return;

    try {
      await removeInvitation(invitationId);
      toast.success("Einladung zurückgezogen");
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleAdminToggle = async (member) => {
    try {
      await setMemberAdmin(member.id, !isAdminRole(member.role));
    } catch (error) {
      toast.error(error.message);
    }
  };

  // Why a switch can't be flipped: the creator is always admin, and nobody
  // changes their own role (so a workspace can't lose its last admin).
  const lockReason = (member) => {
    if (member.role === "owner") return "Ersteller:in ist immer Admin";
    if (member.user_id === userId) return "Eigene Rolle nicht änderbar";
    return null;
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
            Hat die Person noch kein Konto, wird sie automatisch Mitglied,
            sobald sie sich mit dieser E-Mail registriert.
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
              <th className="table-header-cell">Admin</th>
              {canManage && <th className="table-header-cell">Aktionen</th>}
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
                  <button
                    type="button"
                    role="switch"
                    className="switch"
                    aria-checked={isAdminRole(member.role)}
                    aria-label={`Admin: ${member.name || member.email}`}
                    title={lockReason(member) || undefined}
                    disabled={!canManage || Boolean(lockReason(member))}
                    onClick={() => handleAdminToggle(member)}
                  />
                </td>
                {canManage && (
                  <td>
                    {member.role !== "owner" && member.user_id !== userId && (
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
            {invitations.map((invitation) => (
              <tr key={invitation.id} className="members-list-pending">
                <td>
                  <div className="members-list-item-email">
                    {invitation.email}
                  </div>
                  <div className="members-list-item-role">
                    Eingeladen – noch nicht registriert
                  </div>
                </td>
                <td>
                  <button
                    type="button"
                    role="switch"
                    className="switch"
                    aria-checked={false}
                    aria-label={`Admin: ${invitation.email}`}
                    title="Erst nach der Registrierung änderbar"
                    disabled
                  />
                </td>
                {canManage && (
                  <td>
                    <button
                      className="secondary"
                      aria-label={`Einladung an ${invitation.email} zurückziehen`}
                      onClick={() => handleRemoveInvitation(invitation.id)}
                    >
                      <Trash size={16} />
                    </button>
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
