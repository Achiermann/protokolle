import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/db/supabase-server";
import { cookies } from "next/headers";

// PATCH /api/changelog/vorgaenge/:id — rename and/or change the Thema.
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
    if ("topic" in body) {
      updates.topic =
        typeof body.topic === "string" && body.topic.trim()
          ? body.topic.trim()
          : null;
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .schema("protokoll_app")
      .from("vorgaenge")
      .update(updates)
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Vorgang not found" } },
        { status: 404 },
      );
    }

    return NextResponse.json({ item: data });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "UPDATE_ERROR",
          message: error.message || "Failed to update Vorgang",
        },
      },
      { status: 500 },
    );
  }
}

// DELETE /api/changelog/vorgaenge/:id — its logs go with it (ON DELETE CASCADE).
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const workspaceId = cookieStore.get("workspace_id")?.value;

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .schema("protokoll_app")
      .from("vorgaenge")
      .delete()
      .eq("id", id)
      .eq("workspace_id", workspaceId);

    if (error) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Vorgang not found" } },
        { status: 404 },
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "DELETE_ERROR",
          message: error.message || "Failed to delete Vorgang",
        },
      },
      { status: 500 },
    );
  }
}
