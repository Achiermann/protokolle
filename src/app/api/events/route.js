import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/db/supabase-server";
import { cookies } from "next/headers";

// Workspace events ("Ziele"): scheduled goals that belong to the workspace as
// a whole — no member, no entry. Shown on the timeline.

const isIsoDate = (value) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

// GET /api/events
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
      .from("events")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("scheduled", { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({ items: data || [] });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "FETCH_ERROR",
          message: error.message || "Failed to fetch events",
        },
      },
      { status: 500 },
    );
  }
}

// POST /api/events — create a workspace event (title + scheduled date).
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
    if (!isIsoDate(body.scheduled)) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "scheduled (YYYY-MM-DD) is required",
          },
        },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .schema("protokoll_app")
      .from("events")
      .insert([
        {
          workspace_id: workspaceId,
          title: body.title.trim(),
          scheduled: body.scheduled,
        },
      ])
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ item: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "CREATE_ERROR",
          message: error.message || "Failed to create event",
        },
      },
      { status: 500 },
    );
  }
}
