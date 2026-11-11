import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/db/supabase-server";
import { cookies } from "next/headers";
import { REACTION_EMOJIS } from "@/lib/changelogReactions";

// The caller's own reaction on a comment: one per user and comment, so PUT
// sets or replaces it and DELETE removes it. Both are idempotent.
async function getContext() {
  const cookieStore = await cookies();
  const workspaceId = cookieStore.get("workspace_id")?.value;
  if (!workspaceId) {
    return {
      response: NextResponse.json(
        {
          error: { code: "NO_WORKSPACE", message: "Kein Workspace ausgewählt" },
        },
        { status: 400 },
      ),
    };
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return {
      response: NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Nicht angemeldet" } },
        { status: 401 },
      ),
    };
  }
  return { supabase, workspaceId, userId: user.id };
}

// PUT /api/changelog/comments/:id/reaction — body: `emoji` (one of
// REACTION_EMOJIS).
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    if (!REACTION_EMOJIS.includes(body.emoji)) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Unbekanntes Emoji" } },
        { status: 400 },
      );
    }

    const context = await getContext();
    if (context.response) return context.response;
    const { supabase, workspaceId, userId } = context;

    // The comment must belong to the active workspace.
    const { data: comment } = await supabase
      .schema("protokoll_app")
      .from("changelog_comments")
      .select("id")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!comment) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Comment not found" } },
        { status: 404 },
      );
    }

    const { data, error } = await supabase
      .schema("protokoll_app")
      .from("changelog_reactions")
      .upsert(
        {
          comment_id: id,
          user_id: userId,
          workspace_id: workspaceId,
          emoji: body.emoji,
          created_at: new Date().toISOString(),
        },
        { onConflict: "comment_id,user_id" },
      )
      .select("comment_id, user_id, emoji, created_at")
      .single();
    if (error) throw error;

    return NextResponse.json({ item: data });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "UPDATE_ERROR",
          message: error.message || "Failed to save reaction",
        },
      },
      { status: 500 },
    );
  }
}

// DELETE /api/changelog/comments/:id/reaction
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const context = await getContext();
    if (context.response) return context.response;
    const { supabase, workspaceId, userId } = context;

    const { error } = await supabase
      .schema("protokoll_app")
      .from("changelog_reactions")
      .delete()
      .eq("comment_id", id)
      .eq("user_id", userId)
      .eq("workspace_id", workspaceId);
    if (error) throw error;

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "DELETE_ERROR",
          message: error.message || "Failed to remove reaction",
        },
      },
      { status: 500 },
    );
  }
}
