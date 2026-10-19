import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/db/supabase-server";
import { cookies } from "next/headers";

// Workspace projects: a named span of time (start_date → end_date, both
// inclusive), shown as a bar across the top of the timeline.

const isIsoDate = (value) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

// GET /api/projects
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
      .from("projects")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("start_date", { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({ items: data || [] });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "FETCH_ERROR",
          message: error.message || "Failed to fetch projects",
        },
      },
      { status: 500 },
    );
  }
}

// POST /api/projects — create a project (name + start/end date).
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
    if (
      !isIsoDate(body.start_date) ||
      !isIsoDate(body.end_date) ||
      body.end_date < body.start_date
    ) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message:
              "start_date and end_date (YYYY-MM-DD, end ≥ start) are required",
          },
        },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .schema("protokoll_app")
      .from("projects")
      .insert([
        {
          workspace_id: workspaceId,
          name: body.name.trim(),
          start_date: body.start_date,
          end_date: body.end_date,
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
          message: error.message || "Failed to create project",
        },
      },
      { status: 500 },
    );
  }
}
