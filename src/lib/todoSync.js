// Server-only helpers that keep the `todos` table in step with the `/todo@Name`
// markers authored inside an entry's notes (`content`).
//
// Authoring stays inline: the editor inserts `/todo@Name task` text. On entry
// save the API parses those markers and reconciles the rows for that entry —
// inserting new todos and removing ones whose marker was deleted. `done` and
// `comment` are owned by the table, so reconciliation never touches them on
// rows that already exist. This module must stay server-only (it is imported by
// route handlers, never by a React component).

import { createTodoRegex } from "./richText";

// Parse every `/todo@Name task` / `/done@Name task` marker out of entry content.
// Mirrors TodoList's parsing: underscores in the assignee tag map back to
// spaces, the title is trimmed. `done` reflects the marker only at first sight
// (used when inserting a brand-new row); the table owns it afterwards.
export function parseTodoMarkers(content) {
  const out = [];
  if (!content) return out;
  const regex = createTodoRegex();
  let match;
  while ((match = regex.exec(content)) !== null) {
    out.push({
      assignee: match[2].replace(/_/g, " "),
      title: match[3].trim(),
      done: match[1] === "done",
    });
  }
  return out;
}

// A todo's identity within an entry: its assignee + title, normalised so casing
// and surrounding whitespace don't spawn duplicate rows. Editing a todo's text
// in the notes therefore reads as "old one removed, new one added".
const todoKey = (assignee, title) =>
  `${(assignee || "").trim().toLowerCase()}::${(title || "").trim().toLowerCase()}`;

// Reconcile the rows for one entry against its current markers. Inserts markers
// that have no row yet; deletes rows whose marker is gone. Matched rows are left
// untouched so their `done`/`comment` survive entry edits.
export async function reconcileEntryTodos(
  supabase,
  { entryId, workspaceId, content, dateCreated },
) {
  const markers = parseTodoMarkers(content);

  const { data: existing, error } = await supabase
    .schema("protokoll_app")
    .from("todos")
    .select("id, assignee, title")
    .eq("entry_id", entryId);
  if (error) throw error;

  const existingRows = existing || [];
  const existingKeys = new Set(
    existingRows.map((r) => todoKey(r.assignee, r.title)),
  );
  const markerKeys = new Set(markers.map((m) => todoKey(m.assignee, m.title)));

  // Insert markers that have no row yet (dedup within the same entry).
  const seen = new Set();
  const toInsert = [];
  for (const marker of markers) {
    const key = todoKey(marker.assignee, marker.title);
    if (existingKeys.has(key) || seen.has(key)) continue;
    seen.add(key);
    toInsert.push({
      entry_id: entryId,
      workspace_id: workspaceId,
      assignee: marker.assignee,
      title: marker.title,
      done: marker.done,
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

  // Delete rows whose marker was removed from the notes.
  const toDelete = existingRows
    .filter((r) => !markerKeys.has(todoKey(r.assignee, r.title)))
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
