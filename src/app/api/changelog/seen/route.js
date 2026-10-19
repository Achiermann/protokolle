import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/db/supabase-server";
import { cookies } from "next/headers";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/changelog/seen — set the caller's read state for comments.
// Body: `ids` (array of comment ids) and optional `unread` (true = mark
// unread by hand, default false = seen). Idempotent.
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
    const ids = Array.isArray(body.ids)
      ? [...new Set(body.ids.filter((id) => UUID_RE.test(id)))]
      : [];
    if (ids.length === 0) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "ids are required" } },
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

    const { error } = await supabase
      .schema("protokoll_app")
      .from("changelog_seen")
      .upsert(
        ids.map((itemId) => ({
          user_id: user.id,
          workspace_id: workspaceId,
          item_id: itemId,
          unread: body.unread === true,
          seen_at: new Date().toISOString(),
        })),
        { onConflict: "user_id,item_id" },
      );

    if (error) {
      throw error;
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "UPDATE_ERROR",
          message: error.message || "Failed to mark as seen",
        },
      },
      { status: 500 },
    );
  }
}
