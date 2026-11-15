import { NextResponse } from "next/server";
import { bookingContext, isIsoDate, jsonError } from "@/lib/bookingApi";
import { CHECKLIST_KEYS, NEW_VENUE_NAME } from "@/lib/bookingFields";

// POST /api/booking/shows — { project_id, show_date? } (admins only, via RLS)
// Creates a new gig inside a project from the gig footprint: its own empty
// venue (so the venue fields are there to fill in), every show field empty and
// the full checklist with empty values. Returns { item, venue }.
export async function POST(request) {
  try {
    const ctx = await bookingContext();
    if (ctx.error) return ctx.error;
    const { project_id, show_date } = await request.json();

    if (!project_id) {
      return jsonError(
        400,
        "VALIDATION_ERROR",
        "Ein Gig gehört in ein Projekt",
      );
    }
    if (show_date !== undefined && !isIsoDate(show_date)) {
      return jsonError(400, "VALIDATION_ERROR", "Datum (YYYY-MM-DD)");
    }

    const { data: project } = await ctx.db
      .from("booking_projects")
      .select("id")
      .eq("id", project_id)
      .eq("workspace_id", ctx.workspaceId)
      .maybeSingle();
    if (!project) {
      return jsonError(404, "NOT_FOUND", "Projekt nicht gefunden");
    }

    const { data: venue, error: venueError } = await ctx.db
      .from("booking_venues")
      .insert([{ workspace_id: ctx.workspaceId, name: NEW_VENUE_NAME }])
      .select("*")
      .single();
    if (venueError) throw venueError;

    const checklist = Object.fromEntries(CHECKLIST_KEYS.map((k) => [k, null]));
    const { data: show, error: showError } = await ctx.db
      .from("booking_shows")
      .insert([
        {
          workspace_id: ctx.workspaceId,
          project_id: project.id,
          venue_id: venue.id,
          show_date: show_date || new Date().toISOString().slice(0, 10),
          checklist,
        },
      ])
      .select("*")
      .single();

    if (showError) {
      // Don't leave the fresh venue behind when the gig itself failed.
      await ctx.db.from("booking_venues").delete().eq("id", venue.id);
      throw showError;
    }

    return NextResponse.json({ item: show, venue }, { status: 201 });
  } catch (error) {
    return jsonError(
      500,
      "CREATE_ERROR",
      error.message || "Gig konnte nicht erstellt werden",
    );
  }
}
