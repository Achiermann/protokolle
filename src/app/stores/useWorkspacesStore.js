import { create } from "zustand";
import { useEntriesStore } from "./useEntriesStore";
import { useTodosStore } from "./useTodosStore";
import { useEventsStore } from "./useEventsStore";
import { useProjectsStore } from "./useProjectsStore";

export const useWorkspacesStore = create((set, get) => ({
  // *** VARIABLES ***
  workspaces: [],
  members: [],
  invitations: [],
  callerRole: null,
  loadingWorkspaces: false,
  loadingMembers: false,
  error: null,

  // *** FUNCTIONS/HANDLERS ***
  fetchWorkspaces: async () => {
    set({ loadingWorkspaces: true, error: null });
    try {
      const response = await fetch("/api/workspaces");
      if (!response.ok) throw new Error("Laden fehlgeschlagen");
      const data = await response.json();
      const items = data.items || [];
      set({ workspaces: items, loadingWorkspaces: false });
      return items;
    } catch (error) {
      set({ error: error.message, loadingWorkspaces: false });
      throw error;
    }
  },

  createWorkspace: async (name) => {
    set({ error: null });
    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || "Erstellen fehlgeschlagen");
      }
      set((state) => ({ workspaces: [...state.workspaces, data.item] }));
      return data.item;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  renameWorkspace: async (name) => {
    set({ error: null });
    try {
      const response = await fetch("/api/workspaces", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || "Umbenennen fehlgeschlagen");
      }
      set((state) => ({
        workspaces: state.workspaces.map((ws) =>
          ws.id === data.item.id ? { ...ws, name: data.item.name } : ws,
        ),
      }));
      return data.item;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  selectWorkspace: async (workspaceId) => {
    set({ error: null });
    try {
      const response = await fetch("/api/workspaces/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId }),
      });
      if (!response.ok) throw new Error("Auswahl fehlgeschlagen");
      // Entries, todos and events are scoped per workspace; drop the caches so
      // the next view loads the newly selected workspace's data fresh.
      useEntriesStore.getState().resetEntries();
      useTodosStore.getState().resetTodos();
      useEventsStore.getState().resetEvents();
      useProjectsStore.getState().resetProjects();
      return true;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  fetchMembers: async () => {
    set({ loadingMembers: true, error: null });
    try {
      const response = await fetch("/api/workspaces/members");
      if (!response.ok) throw new Error("Laden fehlgeschlagen");
      const data = await response.json();
      const items = data.items || [];
      set({
        members: items,
        invitations: data.invitations || [],
        callerRole: data.callerRole,
        loadingMembers: false,
      });
      return items;
    } catch (error) {
      set({ error: error.message, loadingMembers: false });
      throw error;
    }
  },

  inviteMember: async (email) => {
    set({ error: null });
    try {
      const response = await fetch("/api/workspaces/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || "Einladung fehlgeschlagen");
      }
      await get().fetchMembers();
      return data;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  // Optimistic: flip the switch at once, roll back if the server refuses.
  setMemberAdmin: async (memberId, admin) => {
    const previous = get().members;
    set({
      error: null,
      members: previous.map((m) =>
        m.id === memberId ? { ...m, role: admin ? "admin" : "member" } : m,
      ),
    });
    try {
      const response = await fetch("/api/workspaces/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: memberId, admin }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Ändern fehlgeschlagen");
      }
      return true;
    } catch (error) {
      set({ members: previous, error: error.message });
      throw error;
    }
  },

  removeInvitation: async (invitationId) => {
    set({ error: null });
    try {
      const response = await fetch("/api/workspaces/invite", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitation_id: invitationId }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Zurückziehen fehlgeschlagen");
      }
      await get().fetchMembers();
      return true;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },

  removeMember: async (memberId) => {
    set({ error: null });
    try {
      const response = await fetch("/api/workspaces/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: memberId }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Entfernen fehlgeschlagen");
      }
      await get().fetchMembers();
      return true;
    } catch (error) {
      set({ error: error.message });
      throw error;
    }
  },
}));
