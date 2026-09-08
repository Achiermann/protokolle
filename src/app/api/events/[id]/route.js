import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/db/supabase-server";
import { cookies } from "next/headers";

const isIsoDate = (value) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

// PATCH /api/events/:id — update title and/or scheduled date.
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
    if ("title" in body) {
      if (!body.title || !body.title.trim()) {
        return NextResponse.json(
          { error: { code: "VALIDATION_ERROR", message: "title is required" } },
          { status: 400 },
        );
      }
      updates.title = body.title.trim();
    }
    if ("scheduled" in body) {
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
      updates.scheduled = body.scheduled;
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .schema("protokoll_app")
      .from("events")
      .update(updates)
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Event not found" } },
        { status: 404 },
      );
    }

    return NextResponse.json({ item: data });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "UPDATE_ERROR",
          message: error.message || "Failed to update event",
        },
      },
      { status: 500 },
    );
  }
}

// DELETE /api/events/:id
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const workspaceId = cookieStore.get("workspace_id")?.value;

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .schema("protokoll_app")
      .from("events")
      .delete()
      .eq("id", id)
      .eq("workspace_id", workspaceId);

    if (error) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Event not found" } },
        { status: 404 },
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "DELETE_ERROR",
          message: error.message || "Failed to delete event",
        },
      },
      { status: 500 },
    );
  }
}
