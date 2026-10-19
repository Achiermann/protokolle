import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/db/supabase-server";
import { cookies } from "next/headers";
import { attachCreatorNames } from "@/lib/changelog";

// Only the author may edit or delete a comment. RLS enforces this too; the
// explicit created_by filter turns a foreign comment into a clean 404.
const getUserId = async (supabase) => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id || null;
};

// PATCH /api/changelog/comments/:id — change the text.
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
    if (!body.body || !body.body.trim()) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "body is required" } },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerClient();
    const userId = await getUserId(supabase);
    if (!userId) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Nicht angemeldet" } },
        { status: 401 },
      );
    }

    const { data, error } = await supabase
      .schema("protokoll_app")
      .from("changelog_comments")
      .update({ body: body.body.trim(), updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .eq("created_by", userId)
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Comment not found" } },
        { status: 404 },
      );
    }

    const [item] = await attachCreatorNames(supabase, [data]);

    return NextResponse.json({ item });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "UPDATE_ERROR",
          message: error.message || "Failed to update comment",
        },
      },
      { status: 500 },
    );
  }
}

// DELETE /api/changelog/comments/:id
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const workspaceId = cookieStore.get("workspace_id")?.value;

    const supabase = await createSupabaseServerClient();
    const userId = await getUserId(supabase);
    if (!userId) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Nicht angemeldet" } },
        { status: 401 },
      );
    }

    const { data, error } = await supabase
      .schema("protokoll_app")
      .from("changelog_comments")
      .delete()
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .eq("created_by", userId)
      .select("id");

    if (error || !data || data.length === 0) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Comment not found" } },
        { status: 404 },
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "DELETE_ERROR",
          message: error.message || "Failed to delete comment",
        },
      },
      { status: 500 },
    );
  }
}
