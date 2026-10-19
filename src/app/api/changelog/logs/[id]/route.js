import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/db/supabase-server";
import { cookies } from "next/headers";
import { attachCreatorNames, isIsoDate, resolveVorgang } from "@/lib/changelog";

// PATCH /api/changelog/logs/:id — update `change`, `log_date` and/or move the
// log to another Vorgang (`vorgang_id` or `new_vorgang`). The author stays.
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
    if ("change" in body) {
      if (!body.change || !body.change.trim()) {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Änderung ist erforderlich",
            },
          },
          { status: 400 },
        );
      }
      updates.change = body.change.trim();
    }
    if ("log_date" in body) {
      if (!isIsoDate(body.log_date)) {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "log_date (YYYY-MM-DD) is required",
            },
          },
          { status: 400 },
        );
      }
      updates.log_date = body.log_date;
    }

    const supabase = await createSupabaseServerClient();

    let newVorgang = null;
    if ("vorgang_id" in body || "new_vorgang" in body) {
      const resolved = await resolveVorgang(supabase, workspaceId, body);
      if (resolved.error) {
        return NextResponse.json(
          { error: { code: "VALIDATION_ERROR", message: resolved.error } },
          { status: 400 },
        );
      }
      updates.vorgang_id = resolved.vorgang.id;
      if (resolved.created) newVorgang = resolved.vorgang;
    }

    const { data, error } = await supabase
      .schema("protokoll_app")
      .from("changelog_logs")
      .update(updates)
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Log not found" } },
        { status: 404 },
      );
    }

    const [item] = await attachCreatorNames(supabase, [data]);

    return NextResponse.json({ item, vorgang: newVorgang });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "UPDATE_ERROR",
          message: error.message || "Failed to update log",
        },
      },
      { status: 500 },
    );
  }
}

// DELETE /api/changelog/logs/:id
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const workspaceId = cookieStore.get("workspace_id")?.value;

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .schema("protokoll_app")
      .from("changelog_logs")
      .delete()
      .eq("id", id)
      .eq("workspace_id", workspaceId);

    if (error) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Log not found" } },
        { status: 404 },
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "DELETE_ERROR",
          message: error.message || "Failed to delete log",
        },
      },
      { status: 500 },
    );
  }
}
