"use client";

import { useEffect } from "react";
import toast from "react-hot-toast";
import { useBookingStore } from "../../stores/useBookingStore";
import { useWorkspacesStore } from "../../stores/useWorkspacesStore";
import { isAdminRole } from "../../stores/useAuthStore";
import EditableField from "./EditableField";

// Intern only: project-level settings below the gig — its name and which
// non-admin members may open it.
// Non-admin workspace members who may open this project (admins see all).
function ProjectAccess({ projectId }) {
  const members = useWorkspacesStore((state) => state.members);
  const fetchMembers = useWorkspacesStore((state) => state.fetchMembers);
  const projectMembers = useBookingStore((state) => state.projectMembers);
  const setProjectMember = useBookingStore((state) => state.setProjectMember);

  useEffect(() => {
    fetchMembers().catch(() => {});
  }, [fetchMembers]);

  const nonAdmins = members.filter((m) => !isAdminRole(m.role));
  const hasAccess = (userId) =>
    projectMembers.some(
      (m) => m.project_id === projectId && m.user_id === userId,
    );

  const handleToggle = async (userId) => {
    try {
      await setProjectMember(projectId, userId, !hasAccess(userId));
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <>
      <h3 className="booking-card-title">Zugriff</h3>
      <p className="booking-sheet-hint">
        Admins sehen alle Projekte. Mitglieder ohne Admin-Rechte sehen nur die
        Projekte, die hier angewählt sind (als Public-Ansicht).
      </p>
      {nonAdmins.length === 0 ? (
        <p className="booking-sheet-hint">
          Alle Mitglieder dieses Workspaces sind Admins.
        </p>
      ) : (
        <div className="member-toggle-group">
          {nonAdmins.map((m) => (
            <button
              key={m.user_id}
              type="button"
              aria-pressed={hasAccess(m.user_id)}
              className={`member-toggle ${hasAccess(m.user_id) ? "member-toggle-selected" : ""}`}
              onClick={() => handleToggle(m.user_id)}
            >
              {m.name || m.email}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

export default function ProjectPanel({ project }) {
  const renameProject = useBookingStore((state) => state.renameProject);

  const handleRename = async (name) => {
    if (!name) {
      toast.error("Der Projektname darf nicht leer sein");
      return;
    }
    try {
      await renameProject(project.id, name);
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <section className="booking-sheet booking-project-panel">
      <hr className="booking-sheet-rule" />
      <h3 className="booking-card-title">Projekt</h3>
      <dl className="booking-facts">
        <div className="booking-fact">
          <dt>Name</dt>
          <dd>
            <EditableField
              value={project.name}
              label="Projektname"
              onSave={handleRename}
            />
          </dd>
        </div>
      </dl>
      <div className="booking-project-access">
        <ProjectAccess projectId={project.id} />
      </div>
    </section>
  );
}
