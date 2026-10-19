import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/db/supabase-server";
import { cookies } from "next/headers";
import { attachCreatorNames } from "@/lib/changelog";

// GET /api/changelog — all Vorgänge of the workspace plus all their logs.
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
    const [vorgaengeResult, logsResult] = await Promise.all([
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
    ]);

    if (vorgaengeResult.error) throw vorgaengeResult.error;
    if (logsResult.error) throw logsResult.error;

    const logs = await attachCreatorNames(supabase, logsResult.data || []);

    return NextResponse.json({ vorgaenge: vorgaengeResult.data || [], logs });
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
