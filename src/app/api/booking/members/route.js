import { NextResponse } from "next/server";
import { bookingContext, jsonError } from "@/lib/bookingApi";

// Who (besides admins) may see a booking project. Admins only, via RLS.

// POST /api/booking/members — { project_id, user_id }
export async function POST(request) {
  try {
    const ctx = await bookingContext();
    if (ctx.error) return ctx.error;
    const { project_id, user_id } = await request.json();
    if (!project_id || !user_id) {
      return jsonError(400, "VALIDATION_ERROR", "project_id und user_id nötig");
    }

    const { data, error } = await ctx.db
      .from("booking_project_members")
      .upsert([{ project_id, user_id, workspace_id: ctx.workspaceId }], {
        onConflict: "project_id,user_id",
      })
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ item: data }, { status: 201 });
  } catch (error) {
    return jsonError(
      500,
      "CREATE_ERROR",
      error.message || "Hinzufügen fehlgeschlagen",
    );
  }
}

// DELETE /api/booking/members — { project_id, user_id }
export async function DELETE(request) {
  try {
    const ctx = await bookingContext();
    if (ctx.error) return ctx.error;
    const { project_id, user_id } = await request.json();
    if (!project_id || !user_id) {
      return jsonError(400, "VALIDATION_ERROR", "project_id und user_id nötig");
    }

    const { error } = await ctx.db
      .from("booking_project_members")
      .delete()
      .eq("project_id", project_id)
      .eq("user_id", user_id)
      .eq("workspace_id", ctx.workspaceId);

    if (error) throw error;
    return new Response(null, { status: 204 });
  } catch (error) {
    return jsonError(
      500,
      "DELETE_ERROR",
      error.message || "Entfernen fehlgeschlagen",
    );
  }
}
