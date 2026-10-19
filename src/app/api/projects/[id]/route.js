import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/db/supabase-server";
import { cookies } from "next/headers";

const isIsoDate = (value) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

// PATCH /api/projects/:id — update name and/or dates. When only one date is
// sent, the DB check constraint still guards end ≥ start.
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
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

    const updates = { updated_at: new Date().toISOString() };
    if ("name" in body) {
      if (!body.name || !body.name.trim()) {
        return NextResponse.json(
          { error: { code: "VALIDATION_ERROR", message: "name is required" } },
          { status: 400 },
        );
      }
      updates.name = body.name.trim();
    }
    for (const field of ["start_date", "end_date"]) {
      if (!(field in body)) continue;
      if (!isIsoDate(body[field])) {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: `${field} (YYYY-MM-DD) is required`,
            },
          },
          { status: 400 },
        );
      }
      updates[field] = body[field];
    }
    if (
      updates.start_date &&
      updates.end_date &&
      updates.end_date < updates.start_date
    ) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "end_date must not be before start_date",
          },
        },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .schema("protokoll_app")
      .from("projects")
      .update(updates)
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Project not found" } },
        { status: 404 },
      );
    }

    return NextResponse.json({ item: data });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "UPDATE_ERROR",
          message: error.message || "Failed to update project",
        },
      },
      { status: 500 },
    );
  }
}

// DELETE /api/projects/:id
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const workspaceId = cookieStore.get("workspace_id")?.value;

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .schema("protokoll_app")
      .from("projects")
      .delete()
      .eq("id", id)
      .eq("workspace_id", workspaceId);

    if (error) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Project not found" } },
        { status: 404 },
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "DELETE_ERROR",
          message: error.message || "Failed to delete project",
        },
      },
      { status: 500 },
    );
  }
}
