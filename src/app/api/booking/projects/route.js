import { NextResponse } from "next/server";
import { bookingContext, jsonError } from "@/lib/bookingApi";

// POST /api/booking/projects — { name, kind? } (admins only, via RLS)
export async function POST(request) {
  try {
    const ctx = await bookingContext();
    if (ctx.error) return ctx.error;
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const kind = body.kind === "other" ? "other" : "tour";

    if (!name) {
      return jsonError(400, "VALIDATION_ERROR", "Name fehlt");
    }

    const { data, error } = await ctx.db
      .from("booking_projects")
      .insert([{ workspace_id: ctx.workspaceId, name, kind }])
      .select("*")
      .single();

    if (error) throw error;
    return NextResponse.json({ item: data }, { status: 201 });
  } catch (error) {
    return jsonError(
      500,
      "CREATE_ERROR",
      error.message || "Projekt konnte nicht erstellt werden",
    );
  }
}
