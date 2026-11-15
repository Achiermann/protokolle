import { NextResponse } from "next/server";
import {
  bookingContext,
  isIsoDate,
  jsonError,
  pickTextFields,
} from "@/lib/bookingApi";
import { CHECKLIST_KEYS, SHOW_TEXT_FIELDS } from "@/lib/bookingFields";

// PATCH /api/booking/shows/:id — edit one gig (admins only, via RLS).
// Accepts any of SHOW_TEXT_FIELDS plus:
//   show_date    YYYY-MM-DD
//   travel_party integer or null
//   venue_id     uuid or null
//   project_id   uuid — moves the gig to another project of this workspace
//   checklist    { key: text|null } for CHECKLIST_KEYS, merged into the row
//   schedule_items [{ id, time: "HH:MM"|null, text }] in display order
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const ctx = await bookingContext();
    if (ctx.error) return ctx.error;
    const body = await request.json();

    const { updates, error } = pickTextFields(body, SHOW_TEXT_FIELDS);
    if (error) return jsonError(400, "VALIDATION_ERROR", error);

    if ("show_date" in body) {
      if (!isIsoDate(body.show_date)) {
        return jsonError(400, "VALIDATION_ERROR", "Datum (YYYY-MM-DD) fehlt");
      }
      updates.show_date = body.show_date;
    }
    if ("travel_party" in body) {
      const raw = body.travel_party;
      if (raw === null || raw === "") {
        updates.travel_party = null;
      } else {
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 0 || n > 999) {
          return jsonError(400, "VALIDATION_ERROR", "Travel Party: ganze Zahl");
        }
        updates.travel_party = n;
      }
    }
    if ("venue_id" in body) {
      updates.venue_id = body.venue_id || null;
    }
    if ("project_id" in body) {
      // The target must be a project of the same workspace.
      const { data: target } = await ctx.db
        .from("booking_projects")
        .select("id")
        .eq("id", body.project_id)
        .eq("workspace_id", ctx.workspaceId)
        .maybeSingle();
      if (!target) {
        return jsonError(400, "VALIDATION_ERROR", "Projekt nicht gefunden");
      }
      updates.project_id = target.id;
    }
    if ("checklist" in body) {
      const patch = body.checklist;
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
        return jsonError(400, "VALIDATION_ERROR", "checklist: Objekt");
      }
      const { data: current } = await ctx.db
        .from("booking_shows")
        .select("checklist")
        .eq("id", id)
        .eq("workspace_id", ctx.workspaceId)
        .maybeSingle();
      const merged = { ...(current?.checklist || {}) };
      for (const key of CHECKLIST_KEYS) {
        if (!(key in patch)) continue;
        const value = patch[key];
        merged[key] =
          typeof value === "string" && value.trim() ? value.trim() : null;
      }
      updates.checklist = merged;
    }
    if ("schedule_items" in body) {
      const items = body.schedule_items;
      if (!Array.isArray(items) || items.length > 200) {
        return jsonError(400, "VALIDATION_ERROR", "Schedule: Liste");
      }
      const clean = [];
      for (const item of items) {
        const time = item?.time ?? null;
        const text = typeof item?.text === "string" ? item.text.trim() : "";
        if (time !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
          return jsonError(400, "VALIDATION_ERROR", "Schedule: Zeit HH:MM");
        }
        if (text.length > 1000) {
          return jsonError(400, "VALIDATION_ERROR", "Schedule: Text zu lang");
        }
        if (!time && !text) continue; // fully empty rows are not stored
        const id =
          typeof item.id === "string" && item.id
            ? item.id
            : crypto.randomUUID();
        clean.push({ id, time, text });
      }
      updates.schedule_items = clean;
    }
    if (Object.keys(updates).length === 0) {
      return jsonError(400, "VALIDATION_ERROR", "Nichts zu speichern");
    }

    const { data, error: dbError } = await ctx.db
      .from("booking_shows")
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

// DELETE /api/booking/shows/:id — delete a gig (admins only, via RLS).
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const ctx = await bookingContext();
    if (ctx.error) return ctx.error;

    const { data, error } = await ctx.db
      .from("booking_shows")
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
