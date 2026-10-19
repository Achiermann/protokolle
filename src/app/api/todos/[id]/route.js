import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/db/supabase-server";
import { cookies } from "next/headers";
import { rewriteTodoMarker } from "@/lib/richText";

const isIsoDate = (value) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

// PATCH /api/todos/:id
// The table owns `done` and `comment`; toggling done does NOT rewrite the
// `/todo` marker in the entry's notes (notes record what was decided, the
// todo's live status lives here).
//
// Editing `title`, `assignee` or `scheduled` is different: those three are
// reconciled out of the marker text on every entry save, so the marker has to
// be rewritten along with the row or the edit would be undone. See
// rewriteTodoMarker.
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const cookieStore = await cookies();
    const workspaceId = cookieStore.get("workspace_id")?.value;

    if (!workspaceId) {
      return NextResponse.json(
        {
          error: { code: "NO_WORKSPACE", message: "Kein Workspace ausgewählt" },
        },
        { status: 400 },
      );
    }

    const updates = { updated_at: new Date().toISOString() };
    if ("done" in body) updates.done = body.done;
    if ("comment" in body) updates.comment = body.comment;
    if ("title" in body) {
      if (!body.title || !body.title.trim()) {
        return NextResponse.json(
          { error: { code: "VALIDATION_ERROR", message: "title is required" } },
          { status: 400 },
        );
      }
      updates.title = body.title.trim();
    }
    if ("assignee" in body) {
      if (!body.assignee || !body.assignee.trim()) {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "assignee is required",
            },
          },
          { status: 400 },
        );
      }
      updates.assignee = body.assignee.trim();
    }
    if ("scheduled" in body) {
      if (body.scheduled && !isIsoDate(body.scheduled)) {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "scheduled must be YYYY-MM-DD",
            },
          },
          { status: 400 },
        );
      }
      updates.scheduled = body.scheduled || null;
    }

    const supabase = await createSupabaseServerClient();

    // The row as it stands identifies its marker (assignee + title).
    const { data: before } = await supabase
      .schema("protokoll_app")
      .from("todos")
      .select("entry_id, assignee, title, scheduled")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .single();

    const { data, error } = await supabase
      .schema("protokoll_app")
      .from("todos")
      .update(updates)
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Todo not found" } },
        { status: 404 },
      );
    }

    // Keep the parent traktandum's notes in step. Non-fatal: the row is
    // already saved, and a stale marker is corrected on the next edit.
    const markerChanged =
      before &&
      before.entry_id &&
      (("title" in updates && updates.title !== before.title) ||
        ("assignee" in updates && updates.assignee !== before.assignee) ||
        ("scheduled" in updates && updates.scheduled !== before.scheduled));
    if (markerChanged) {
      try {
        const { data: parent } = await supabase
          .schema("protokoll_app")
          .from("entries")
          .select("content")
          .eq("id", before.entry_id)
          .single();
        const rewritten = rewriteTodoMarker(
          parent?.content,
          { assignee: before.assignee, title: before.title },
          {
            assignee: data.assignee,
            title: data.title,
            scheduled: data.scheduled,
          },
        );
        if (rewritten !== null) {
          const now = new Date().toISOString();
          await supabase
            .schema("protokoll_app")
            .from("entries")
            .update({
              content: rewritten,
              updated_at: now,
              date_modified: now,
            })
            .eq("id", before.entry_id)
            .eq("workspace_id", workspaceId);
        }
      } catch (markerError) {
        console.error("Todo marker rewrite failed:", markerError);
      }
    }

    // Re-attach the parent entry's topic/title so the client row stays shaped
    // like the GET list response.
    const { data: entry } = await supabase
      .schema("protokoll_app")
      .from("entries")
      .select("topic, item_title")
      .eq("id", data.entry_id)
      .single();

    return NextResponse.json({
      item: {
        ...data,
        // Same fallback order as the GET list: a standalone todo keeps its own
        // topic, a marker-todo inherits its traktandum's.
        topic: data.topic ?? entry?.topic ?? null,
        entry_title: entry?.item_title ?? null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "UPDATE_ERROR",
          message: error.message || "Failed to update todo",
        },
      },
      { status: 500 },
    );
  }
}

// DELETE /api/todos/:id
// Removes the row. A marker-todo deleted this way reappears if its parent entry
// is saved again (the /todo marker still lives in the notes); standalone todos
// are gone for good.
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const workspaceId = cookieStore.get("workspace_id")?.value;

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .schema("protokoll_app")
      .from("todos")
      .delete()
      .eq("id", id)
      .eq("workspace_id", workspaceId);

    if (error) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Todo not found" } },
        { status: 404 },
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "DELETE_ERROR",
          message: error.message || "Failed to delete todo",
        },
      },
      { status: 500 },
    );
  }
}
