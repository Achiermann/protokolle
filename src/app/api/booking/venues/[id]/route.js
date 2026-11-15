import { NextResponse } from "next/server";
import { bookingContext, jsonError, pickTextFields } from "@/lib/bookingApi";
import { VENUE_TEXT_FIELDS } from "@/lib/bookingFields";

// PATCH /api/booking/venues/:id — edit a venue (admins only, via RLS). A venue
// is shared by every show played there, so edits apply to all of them.
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const ctx = await bookingContext();
    if (ctx.error) return ctx.error;
    const body = await request.json();

    const { updates, error } = pickTextFields(body, VENUE_TEXT_FIELDS);
    if (error) return jsonError(400, "VALIDATION_ERROR", error);
    if ("name" in updates && !updates.name) {
      return jsonError(400, "VALIDATION_ERROR", "Name darf nicht leer sein");
    }
    if (Object.keys(updates).length === 0) {
      return jsonError(400, "VALIDATION_ERROR", "Nichts zu speichern");
    }

    const { data, error: dbError } = await ctx.db
      .from("booking_venues")
      .update(updates)
      .eq("id", id)
      .eq("workspace_id", ctx.workspaceId)
      .select("*")
      .maybeSingle();

    if (dbError) throw dbError;
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

// DELETE /api/booking/venues/:id — only a venue no gig uses any more (e.g.
// the empty placeholder venue of a new gig after picking an existing one).
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const ctx = await bookingContext();
    if (ctx.error) return ctx.error;

    const { count, error: countError } = await ctx.db
      .from("booking_shows")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", id);
    if (countError) throw countError;
    if (count > 0) {
      return jsonError(409, "IN_USE", "Venue wird noch von Gigs verwendet");
    }

    const { data, error } = await ctx.db
      .from("booking_venues")
      .delete()
      .eq("id", id)
      .eq("workspace_id", ctx.workspaceId)
      .select("id");
    if (error) throw error;
    if (!data?.length) {
      return jsonError(403, "FORBIDDEN", "Keine Berechtigung");
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    return jsonError(
      500,
      "DELETE_ERROR",
      error.message || "Löschen fehlgeschlagen",
    );
  }
}
