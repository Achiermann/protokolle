import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/db/supabase-server";
import { cookies } from "next/headers";
import { attachCreatorNames } from "@/lib/changelog";

// POST /api/changelog/comments — comment on a log. Body: `log_id`, `body`.
// The author is the logged-in user.
export async function POST(request) {
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

    const body = await request.json();

    if (!body.log_id || !body.body || !body.body.trim()) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "log_id and body are required",
          },
        },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Nicht angemeldet" } },
        { status: 401 },
      );
    }

    // The log must belong to the active workspace.
    const { data: log } = await supabase
      .schema("protokoll_app")
      .from("changelog_logs")
      .select("id")
      .eq("id", body.log_id)
      .eq("workspace_id", workspaceId)
      .single();

    if (!log) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Log not found" } },
        { status: 404 },
      );
    }

    const { data, error } = await supabase
      .schema("protokoll_app")
      .from("changelog_comments")
      .insert([
        {
          workspace_id: workspaceId,
          log_id: log.id,
          created_by: user.id,
          body: body.body.trim(),
        },
      ])
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    const [item] = await attachCreatorNames(supabase, [data]);

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "CREATE_ERROR",
          message: error.message || "Failed to create comment",
        },
      },
      { status: 500 },
    );
  }
}
