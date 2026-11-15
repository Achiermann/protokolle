import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/db/supabase-server";

// Shared plumbing for the /api/booking/* write routes. Authorization is the
// database's job (RLS: booking writes are admin-only); these helpers only
// resolve the workspace and shape errors.

export const jsonError = (status, code, message) =>
  NextResponse.json({ error: { code, message } }, { status });

export async function bookingContext() {
  const cookieStore = await cookies();
  const workspaceId = cookieStore.get("workspace_id")?.value;
  if (!workspaceId) {
    return {
      error: jsonError(400, "NO_WORKSPACE", "Kein Workspace ausgewählt"),
    };
  }
  const supabase = await createSupabaseServerClient();
  return { workspaceId, db: supabase.schema("protokoll_app"), supabase };
}

// Picks the whitelisted text fields from a request body: trimmed strings,
// empty → null. Unknown keys are ignored.
export function pickTextFields(body, fields) {
  const updates = {};
  for (const field of fields) {
    if (!(field in body)) continue;
    const value = body[field];
    if (value === null || value === undefined) {
      updates[field] = null;
    } else if (typeof value === "string") {
      const trimmed = value.trim();
      updates[field] = trimmed || null;
    } else {
      return { error: `${field} must be text` };
    }
  }
  return { updates };
}

export const isIsoDate = (value) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
