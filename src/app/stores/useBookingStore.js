import { create } from "zustand";

// Client source of truth for the booking app (b): venues, booking projects
// and shows of the active workspace, fetched together from /api/booking.
export const useBookingStore = create((set, get) => ({
  // *** VARIABLES ***
  venues: [],
  projects: [],
  shows: [],
  // { project_id, user_id } — non-admins who may see a project.
  projectMembers: [],
  loaded: false,
  loading: false,
  error: null,

  // *** FUNCTIONS/HANDLERS ***
  fetchBooking: async ({ silent = false } = {}) => {
    if (!silent) set({ loading: true, error: null });
    try {
      const response = await fetch("/api/booking");
      if (!response.ok) {
        throw new Error("Failed to fetch booking data");
      }
      const data = await response.json();
      set({
        venues: data.venues || [],
        projects: data.projects || [],
        shows: data.shows || [],
        projectMembers: data.projectMembers || [],
        loaded: true,
        loading: false,
      });
    } catch (error) {
      if (silent) return;
      set({ error: error.message, loading: false });
    }
  },

  // Spinner only on the first ever load; afterwards revalidate silently.
  ensureBooking: () => {
    if (get().loaded) {
      return get().fetchBooking({ silent: true });
    }
    return get().fetchBooking();
  },

  resetBooking: () =>
    set({
      venues: [],
      projects: [],
      shows: [],
      projectMembers: [],
      loaded: false,
      loading: false,
      error: null,
    }),

  // Inline edits from the Intern sheet: applied locally at once, replaced by
  // the server's row on success, rolled back on failure.
  updateShow: (id, updates) =>
    patchRow(set, get, "shows", "shows", id, updates),
  updateVenue: (id, updates) =>
    patchRow(set, get, "venues", "venues", id, updates),

  createProject: async (name) => {
    const data = await request("/api/booking/projects", "POST", { name });
    set((state) => ({ projects: [...state.projects, data.item] }));
    return data.item;
  },

  renameProject: (id, name) =>
    patchRow(set, get, "projects", "projects", id, { name }),

  // A new gig arrives together with its own (empty) venue.
  createShow: async (projectId, showDate) => {
    const data = await request("/api/booking/shows", "POST", {
      project_id: projectId,
      show_date: showDate,
    });
    set((state) => ({
      shows: [...state.shows, data.item],
      venues: [...state.venues, data.venue],
    }));
    return data.item;
  },

  deleteShow: async (id) => {
    await request(`/api/booking/shows/${id}`, "DELETE");
    set((state) => ({ shows: state.shows.filter((s) => s.id !== id) }));
  },

  deleteVenue: async (id) => {
    await request(`/api/booking/venues/${id}`, "DELETE");
    set((state) => ({ venues: state.venues.filter((v) => v.id !== id) }));
  },

  setProjectMember: async (projectId, userId, member) => {
    const previous = get().projectMembers;
    set({
      projectMembers: member
        ? [...previous, { project_id: projectId, user_id: userId }]
        : previous.filter(
            (m) => !(m.project_id === projectId && m.user_id === userId),
          ),
    });
    try {
      const response = await fetch("/api/booking/members", {
        method: member ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, user_id: userId }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error?.message || "Speichern fehlgeschlagen");
      }
    } catch (error) {
      set({ projectMembers: previous });
      throw error;
    }
  },
}));

// Only the edited row is rolled back, so a failed save never undoes other
// edits made in the meantime.
async function patchRow(set, get, key, endpoint, id, updates) {
  const previousRow = get()[key].find((row) => row.id === id);
  const replaceRow = (next) =>
    set((state) => ({
      [key]: state[key].map((row) => (row.id === id ? next : row)),
    }));
  replaceRow({ ...previousRow, ...updates });
  try {
    const response = await fetch(`/api/booking/${endpoint}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error?.message || "Speichern fehlgeschlagen");
    }
    replaceRow(data.item);
    return data.item;
  } catch (error) {
    replaceRow(previousRow);
    throw error;
  }
}

async function request(url, method, body) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.message || "Speichern fehlgeschlagen");
  }
  return data;
}
