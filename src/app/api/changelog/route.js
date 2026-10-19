import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/db/supabase-server";
import { cookies } from "next/headers";
import { attachCreatorNames } from "@/lib/changelog";

// The caller's seen state: `since` (their first changelog load in this
// workspace — older items count as seen; registered on the first call) and
// the ids of comments they have seen since.
async function loadSeenState(supabase, workspaceId) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { since: null, ids: [] };

  await supabase
    .schema("protokoll_app")
    .from("changelog_readers")
    .upsert(
      { user_id: user.id, workspace_id: workspaceId },
      { onConflict: "user_id,workspace_id", ignoreDuplicates: true },
    );

  const [readerResult, seenResult] = await Promise.all([
    supabase
      .schema("protokoll_app")
      .from("changelog_readers")
      .select("since")
      .eq("user_id", user.id)
      .eq("workspace_id", workspaceId)
      .single(),
    supabase
      .schema("protokoll_app")
      .from("changelog_seen")
      .select("item_id")
      .eq("user_id", user.id)
      .eq("workspace_id", workspaceId),
  ]);

  return {
    since: readerResult.data?.since ?? null,
    ids: (seenResult.data || []).map((row) => row.item_id),
  };
}

// GET /api/changelog — all Vorgänge of the workspace, their comments (oldest
// first) and the caller's "seen" state. The client groups them
// (Thema → Vorgang → Kommentare), so one round trip suffices.
export async function GET() {
  try {
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

    const supabase = await createSupabaseServerClient();
    const [vorgaengeResult, commentsResult] = await Promise.all([
      supabase
        .schema("protokoll_app")
        .from("vorgaenge")
        .select("*")
        .eq("workspace_id", workspaceId),
      supabase
        .schema("protokoll_app")
        .from("changelog_comments")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true }),
    ]);

    if (vorgaengeResult.error) throw vorgaengeResult.error;
    if (commentsResult.error) throw commentsResult.error;

    const comments = await attachCreatorNames(
      supabase,
      commentsResult.data || [],
    );

    const seen = await loadSeenState(supabase, workspaceId);

    return NextResponse.json({
      vorgaenge: vorgaengeResult.data || [],
      comments,
      seen,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "FETCH_ERROR",
          message: error.message || "Failed to fetch changelog",
        },
      },
      { status: 500 },
    );
  }
}
