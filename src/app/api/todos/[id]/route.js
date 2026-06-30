import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/db/supabase-server";
import { cookies } from "next/headers";

// PATCH /api/todos/:id
// The table owns `done` and `comment`; toggling done here does NOT rewrite the
// `/todo` marker in the entry's notes (notes record what was decided, the
// todo's live status lives here).
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

    const supabase = await createSupabaseServerClient();
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
        topic: entry?.topic ?? null,
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
