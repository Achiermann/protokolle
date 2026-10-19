import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/db/supabase-server";
import { cookies } from "next/headers";
import { attachCreatorNames } from "@/lib/changelog";

// POST /api/changelog/vorgaenge — create a Vorgang. Body: `name`, optional
// `topic` and an optional first `comment` (authored by the logged-in user).
// Returns the Vorgang and the comment, if any.
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

    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "name is required" } },
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

    const { data: vorgang, error } = await supabase
      .schema("protokoll_app")
      .from("vorgaenge")
      .insert([
        {
          workspace_id: workspaceId,
          name: body.name.trim(),
          topic:
            typeof body.topic === "string" && body.topic.trim()
              ? body.topic.trim()
              : null,
        },
      ])
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    let comment = null;
    const text = typeof body.comment === "string" ? body.comment.trim() : "";
    if (text) {
      const { data, error: commentError } = await supabase
        .schema("protokoll_app")
        .from("changelog_comments")
        .insert([
          {
            workspace_id: workspaceId,
            vorgang_id: vorgang.id,
            created_by: user.id,
            body: text,
          },
        ])
        .select("*")
        .single();
      if (commentError) {
        throw commentError;
      }
      [comment] = await attachCreatorNames(supabase, [data]);
    }

    return NextResponse.json({ item: vorgang, comment }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "CREATE_ERROR",
          message: error.message || "Failed to create Vorgang",
        },
      },
      { status: 500 },
    );
  }
}
