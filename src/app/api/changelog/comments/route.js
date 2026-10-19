import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/db/supabase-server";
import { cookies } from "next/headers";
import { attachCreatorNames, resolveVorgang } from "@/lib/changelog";

// POST /api/changelog/comments — comment on a Vorgang. Body: `body` and
// either `vorgang_id` or `new_vorgang: { name, topic }`. The author is the
// logged-in user. Returns the comment and, when one was created, the Vorgang.
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

    if (!body.body || !body.body.trim()) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "body is required" } },
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

    const resolved = await resolveVorgang(supabase, workspaceId, body);
    if (resolved.error) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: resolved.error } },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .schema("protokoll_app")
      .from("changelog_comments")
      .insert([
        {
          workspace_id: workspaceId,
          vorgang_id: resolved.vorgang.id,
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

    return NextResponse.json(
      { item, vorgang: resolved.created ? resolved.vorgang : null },
      { status: 201 },
    );
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
