import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/db/supabase-server";
import { cookies } from "next/headers";

// GET /api/todos
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
    const { data, error } = await supabase
      .schema("protokoll_app")
      .from("todos")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("date_created", { ascending: false });

    if (error) {
      throw error;
    }

    const todos = data || [];

    // Marker-todos inherit their parent entry's live topic/title; standalone
    // todos carry their own topic. Fetched in a second query (not a join embed)
    // to stay robust to PostgREST's schema cache.
    const entryIds = [...new Set(todos.map((t) => t.entry_id).filter(Boolean))];
    let entryMap = new Map();
    if (entryIds.length > 0) {
      const { data: entries } = await supabase
        .schema("protokoll_app")
        .from("entries")
        .select("id, topic, item_title")
        .in("id", entryIds);
      entryMap = new Map((entries || []).map((e) => [e.id, e]));
    }

    const items = todos.map((todo) => {
      const entry = entryMap.get(todo.entry_id);
      return {
        ...todo,
        topic: todo.topic ?? entry?.topic ?? null,
        entry_title: entry?.item_title ?? null,
      };
    });

    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "FETCH_ERROR",
          message: error.message || "Failed to fetch todos",
        },
      },
      { status: 500 },
    );
  }
}

// POST /api/todos — create a standalone todo (no linked traktandum).
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

    if (!body.title || !body.title.trim()) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "title is required" } },
        { status: 400 },
      );
    }
    if (!body.assignee || !body.assignee.trim()) {
      return NextResponse.json(
        {
          error: { code: "VALIDATION_ERROR", message: "assignee is required" },
        },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .schema("protokoll_app")
      .from("todos")
      .insert([
        {
          entry_id: null,
          workspace_id: workspaceId,
          assignee: body.assignee.trim(),
          title: body.title.trim(),
          topic: body.topic?.trim() || null,
        },
      ])
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(
      { item: { ...data, entry_title: null } },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "CREATE_ERROR",
          message: error.message || "Failed to create todo",
        },
      },
      { status: 500 },
    );
  }
}
