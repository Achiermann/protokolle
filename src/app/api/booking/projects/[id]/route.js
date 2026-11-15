import { NextResponse } from "next/server";
import { bookingContext, jsonError } from "@/lib/bookingApi";

// PATCH /api/booking/projects/:id — { name } (admins only, via RLS)
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const ctx = await bookingContext();
    if (ctx.error) return ctx.error;
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!name) {
      return jsonError(400, "VALIDATION_ERROR", "Name darf nicht leer sein");
    }

    const { data, error } = await ctx.db
      .from("booking_projects")
      .update({ name })
      .eq("id", id)
      .eq("workspace_id", ctx.workspaceId)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return jsonError(403, "FORBIDDEN", "Keine Berechtigung");
    }
    return NextResponse.json({ item: data });
  } catch (error) {
    return jsonError(
      500,
      "UPDATE_ERROR",
      error.message || "Speichern fehlgeschlagen",
    );
  }
}
