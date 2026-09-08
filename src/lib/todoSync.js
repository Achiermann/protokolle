// Server-only helpers that keep the `todos` table in step with the `/todo@Name`
// markers authored inside an entry's notes (`content`).
//
// Authoring stays inline: the editor inserts `/todo@Anna+Ben@01.10.2026 task`
// text (members joined by `+`, optional planned date). On entry save the API
// parses those markers and reconciles the rows for that entry — inserting new
// todos, removing ones whose marker was deleted, and updating `scheduled` when
// a marker's date changed. `done` and `comment` are owned by the table, so
// reconciliation never touches them on rows that already exist. This module
// must stay server-only (it is imported by route handlers, never by a React
// component); the pure marker parsing lives in richText.js so client code (the
// sidebar count) can share it.

import { parseTodoMarkers, parseZielMarkers } from "./richText";

// A todo's identity within an entry: its assignee + title, normalised so casing
// and surrounding whitespace don't spawn duplicate rows. Editing a todo's text
// in the notes therefore reads as "old one removed, new one added"; changing
// only the date keeps the row (and its done/comment) and updates `scheduled`.
const todoKey = (assignee, title) =>
  `${(assignee || "").trim().toLowerCase()}::${(title || "").trim().toLowerCase()}`;

// Reconcile the rows for one entry against its current markers. Inserts markers
// that have no row yet; deletes rows whose marker is gone; syncs `scheduled` on
// matched rows. Matched rows keep their `done`/`comment` across entry edits.
export async function reconcileEntryTodos(
  supabase,
  { entryId, workspaceId, content, dateCreated },
) {
  const markers = parseTodoMarkers(content);

  const { data: existing, error } = await supabase
    .schema("protokoll_app")
    .from("todos")
    .select("id, assignee, title, scheduled")
    .eq("entry_id", entryId);
  if (error) throw error;

  const existingRows = existing || [];
  const existingKeys = new Set(
    existingRows.map((r) => todoKey(r.assignee, r.title)),
  );
  // First marker wins when the same assignee+title appears twice.
  const markerByKey = new Map();
  for (const marker of markers) {
    const key = todoKey(marker.assignee, marker.title);
    if (!markerByKey.has(key)) markerByKey.set(key, marker);
  }

  // Insert markers that have no row yet (dedup within the same entry).
  const toInsert = [];
  for (const [key, marker] of markerByKey) {
    if (existingKeys.has(key)) continue;
    toInsert.push({
      entry_id: entryId,
      workspace_id: workspaceId,
      assignee: marker.assignee,
      title: marker.title,
      done: marker.done,
      scheduled: marker.scheduled,
      date_created: dateCreated,
    });
  }
  if (toInsert.length > 0) {
    const { error: insertError } = await supabase
      .schema("protokoll_app")
      .from("todos")
      .insert(toInsert);
    if (insertError) throw insertError;
  }

  // Sync `scheduled` on rows whose marker date changed (both directions,
  // including a removed date).
  for (const row of existingRows) {
    const marker = markerByKey.get(todoKey(row.assignee, row.title));
    if (!marker) continue;
    if ((marker.scheduled || null) !== (row.scheduled || null)) {
      const { error: updateError } = await supabase
        .schema("protokoll_app")
        .from("todos")
        .update({ scheduled: marker.scheduled })
        .eq("id", row.id);
      if (updateError) throw updateError;
    }
  }

  // Delete rows whose marker was removed from the notes.
  const toDelete = existingRows
    .filter((r) => !markerByKey.has(todoKey(r.assignee, r.title)))
    .map((r) => r.id);
  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .schema("protokoll_app")
      .from("todos")
      .delete()
      .in("id", toDelete);
    if (deleteError) throw deleteError;
  }
}

// Reconcile the events ("Ziele") linked to one entry against its current
// `/ziel@Datum Titel` markers, mirroring reconcileEntryTodos. A Ziel's identity
// within its entry is its title; editing the date in the notes updates the row,
// editing the title reads as "old one removed, new one added". Workspace-only
// Ziele (entry_id NULL, created from the timeline) are never touched here.
export async function reconcileEntryZiele(
  supabase,
  { entryId, workspaceId, content },
) {
  const markers = parseZielMarkers(content);

  const { data: existing, error } = await supabase
    .schema("protokoll_app")
    .from("events")
    .select("id, title, scheduled")
    .eq("entry_id", entryId);
  if (error) throw error;

  const existingRows = existing || [];
  const zielKey = (title) => (title || "").trim().toLowerCase();
  // First marker wins when the same title appears twice.
  const markerByKey = new Map();
  for (const marker of markers) {
    const key = zielKey(marker.title);
    if (!markerByKey.has(key)) markerByKey.set(key, marker);
  }
  const existingKeys = new Set(existingRows.map((r) => zielKey(r.title)));

  const toInsert = [];
  for (const [key, marker] of markerByKey) {
    if (existingKeys.has(key)) continue;
    toInsert.push({
      entry_id: entryId,
      workspace_id: workspaceId,
      title: marker.title,
      scheduled: marker.scheduled,
    });
  }
  if (toInsert.length > 0) {
    const { error: insertError } = await supabase
      .schema("protokoll_app")
      .from("events")
      .insert(toInsert);
    if (insertError) throw insertError;
  }

  for (const row of existingRows) {
    const marker = markerByKey.get(zielKey(row.title));
    if (!marker) continue;
    if (marker.scheduled !== row.scheduled) {
      const { error: updateError } = await supabase
        .schema("protokoll_app")
        .from("events")
        .update({ scheduled: marker.scheduled })
        .eq("id", row.id);
      if (updateError) throw updateError;
    }
  }

  const toDelete = existingRows
    .filter((r) => !markerByKey.has(zielKey(r.title)))
    .map((r) => r.id);
  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .schema("protokoll_app")
      .from("events")
      .delete()
      .in("id", toDelete);
    if (deleteError) throw deleteError;
  }
}
