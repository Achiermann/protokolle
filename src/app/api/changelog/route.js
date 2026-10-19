import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/db/supabase-server";
import { cookies } from "next/headers";
import { attachCreatorNames } from "@/lib/changelog";

// GET /api/changelog — all Vorgänge of the workspace plus all their logs and
// the comments on those logs.
// The client groups them (Thema → Vorgang → Logs), so one round trip suffices.
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
    const [vorgaengeResult, logsResult, commentsResult] = await Promise.all([
      supabase
        .schema("protokoll_app")
        .from("vorgaenge")
        .select("*")
        .eq("workspace_id", workspaceId),
      supabase
        .schema("protokoll_app")
        .from("changelog_logs")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("log_date", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .schema("protokoll_app")
        .from("changelog_comments")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true }),
    ]);

    if (vorgaengeResult.error) throw vorgaengeResult.error;
    if (logsResult.error) throw logsResult.error;
    if (commentsResult.error) throw commentsResult.error;

    const [logs, comments] = await Promise.all([
      attachCreatorNames(supabase, logsResult.data || []),
      attachCreatorNames(supabase, commentsResult.data || []),
    ]);

    return NextResponse.json({
      vorgaenge: vorgaengeResult.data || [],
      logs,
      comments,
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
