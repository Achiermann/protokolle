import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/db/supabase-server";
import { cookies } from "next/headers";

// Themen are free text on three tables — there is no topics table. Listing
// collects the distinct values; renaming rewrites the value on every row.
const TOPIC_TABLES = ["entries", "todos", "vorgaenge"];

async function getContext() {
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
  return { supabase, workspaceId };
}

async function listTopics(supabase, workspaceId) {
  const set = new Set();
  for (const table of TOPIC_TABLES) {
    const { data, error } = await supabase
      .schema("protokoll_app")
      .from(table)
      .select("topic")
      .eq("workspace_id", workspaceId)
      .not("topic", "is", null);
    if (error) throw error;
    for (const row of data) if (row.topic?.trim()) set.add(row.topic);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "de"));
}

// GET /api/topics — all Themen of the active workspace (archived included)
export async function GET() {
  try {
    const ctx = await getContext();
    if (ctx.response) return ctx.response;
    const items = await listTopics(ctx.supabase, ctx.workspaceId);
    return NextResponse.json({ items });
  } catch (error) {
    console.error("[GET /api/topics]", error);
    return NextResponse.json(
      {
        error: {
          code: "FETCH_ERROR",
          message: error.message || "Themen konnten nicht geladen werden",
        },
      },
      { status: 500 },
    );
  }
}

// PATCH /api/topics — { from, to }: rename a Thema everywhere in the workspace.
// If `to` already exists the two Themen simply merge (the client confirms
// that beforehand). Deliberately does not bump entries.date_modified: a bulk
// rename is not a content edit.
export async function PATCH(request) {
  try {
    const ctx = await getContext();
    if (ctx.response) return ctx.response;
    const { supabase, workspaceId } = ctx;

    const body = await request.json();
    const from = typeof body.from === "string" ? body.from : "";
    const to = typeof body.to === "string" ? body.to.trim() : "";
    if (!from || !to) {
      return NextResponse.json(
        { error: { code: "INVALID", message: "Name darf nicht leer sein" } },
        { status: 400 },
      );
    }
    if (from === to) {
      return NextResponse.json({
        items: await listTopics(supabase, workspaceId),
      });
    }

    const now = new Date().toISOString();
    for (const table of TOPIC_TABLES) {
      const { error } = await supabase
        .schema("protokoll_app")
        .from(table)
        .update({ topic: to, updated_at: now })
        .eq("workspace_id", workspaceId)
        .eq("topic", from);
      if (error) throw error;
    }

    return NextResponse.json({
      items: await listTopics(supabase, workspaceId),
    });
  } catch (error) {
    console.error("[PATCH /api/topics]", error);
    return NextResponse.json(
      {
        error: {
          code: "UPDATE_ERROR",
          message: error.message || "Thema konnte nicht umbenannt werden",
        },
      },
      { status: 500 },
    );
  }
}
