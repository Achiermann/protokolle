import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/db/supabase-server";
import { cookies } from "next/headers";

// Booking app: everything the b-app shows for the active workspace in one
// round trip — venues, booking projects and all their shows.

// GET /api/booking
export async function GET() {
  try {
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

    const supabase = await createSupabaseServerClient();
    const db = supabase.schema("protokoll_app");
    // RLS scopes every query: admins get the whole workspace, members only
    // the projects they were added to (and those projects' venues).
    const [venues, projects, shows, members] = await Promise.all([
      db
        .from("booking_venues")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("name", { ascending: true }),
      db
        .from("booking_projects")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true }),
      db
        .from("booking_shows")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("show_date", { ascending: true }),
      db
        .from("booking_project_members")
        .select("project_id, user_id")
        .eq("workspace_id", workspaceId),
    ]);

    const error =
      venues.error || projects.error || shows.error || members.error;
    if (error) {
      throw error;
    }

    return NextResponse.json({
      venues: venues.data || [],
      projects: projects.data || [],
      shows: shows.data || [],
      projectMembers: members.data || [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "FETCH_ERROR",
          message: error.message || "Failed to fetch booking data",
        },
      },
      { status: 500 },
    );
  }
}
