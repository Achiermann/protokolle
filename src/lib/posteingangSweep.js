// Server-only: moves due traktanden into the Posteingang.
//
// A traktandum with a planned date that is still sitting unprepared in "Offene
// Traktanden" (no notes yet) belongs on the table once its date arrives. The
// sweep runs whenever the entry list is fetched, so every member sees the same
// Posteingang without anyone having to open a particular view.
//
// It is one-shot per traktandum: `auto_posteingang_at` records the move, and a
// row that carries it is never swept again. Taking a traktandum back out of
// the Posteingang by hand therefore sticks.

// Today as a local YYYY-MM-DD string, matching how `scheduled` (a DATE) comes
// back from PostgREST — comparing the two as strings avoids timezone drift.
const todayIso = () => {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
};

// Sweep the given workspace's rows. `entries` is the list just fetched, so no
// extra read is needed; returns the ids that were moved (empty when none), and
// the caller patches its response copy accordingly.
export async function sweepDueEntries(supabase, { workspaceId, entries }) {
  const today = todayIso();
  const due = (entries || []).filter(
    (entry) =>
      entry.scheduled &&
      entry.scheduled <= today &&
      !entry.content &&
      !entry.archived &&
      !entry.in_posteingang &&
      !entry.auto_posteingang_at,
  );
  if (due.length === 0) return [];

  // New arrivals go to the end of the Posteingang, keeping their planned order
  // among themselves.
  let nextPosition =
    (entries || []).reduce(
      (max, entry) =>
        entry.in_posteingang && typeof entry.posteingang_position === "number"
          ? Math.max(max, entry.posteingang_position)
          : max,
      -1,
    ) + 1;

  const movedAt = new Date().toISOString();
  const moved = [];
  for (const entry of due.sort((a, b) =>
    a.scheduled.localeCompare(b.scheduled),
  )) {
    const { error } = await supabase
      .schema("protokoll_app")
      .from("entries")
      .update({
        in_posteingang: true,
        posteingang_position: nextPosition,
        auto_posteingang_at: movedAt,
        updated_at: movedAt,
      })
      .eq("id", entry.id)
      .eq("workspace_id", workspaceId)
      // Only claim rows that are still untouched, so two clients sweeping at
      // the same time can't both move the same traktandum.
      .is("auto_posteingang_at", null);
    if (error) throw error;
    moved.push({ id: entry.id, position: nextPosition, movedAt });
    nextPosition += 1;
  }
  return moved;
}
