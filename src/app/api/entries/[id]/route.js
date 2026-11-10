import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/db/supabase-server";
import { cookies } from "next/headers";
import { reconcileEntryTodos, reconcileEntryZiele } from "@/lib/todoSync";
import { buildAusgangslage, hasVisibleText } from "@/lib/richText";

// GET /api/entries/:id
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const workspaceId = cookieStore.get("workspace_id")?.value;

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .schema("protokoll_app")
      .from("entries")
      .select("*")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Entry not found",
          },
        },
        { status: 404 },
      );
    }

    return NextResponse.json({ item: data });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "FETCH_ERROR",
          message: error.message || "Failed to fetch entry",
        },
      },
      { status: 500 },
    );
  }
}

// Fields whose change counts as editing the traktandum and so bumps its
// "Datum" (date_modified). Archiving, Posteingang moves and reordering don't.
const CONTENT_FIELDS = [
  "item_title",
  "topic",
  "scheduled",
  "content",
  "erlaeuterung",
];

// PATCH /api/entries/:id
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const cookieStore = await cookies();
    const workspaceId = cookieStore.get("workspace_id")?.value;

    const now = new Date().toISOString();
    const isContentEdit = CONTENT_FIELDS.some((field) => field in body);

    const supabase = await createSupabaseServerClient();

    if ("erlaeuterung" in body) {
      body.erlaeuterung =
        typeof body.erlaeuterung === "string" && body.erlaeuterung.trim()
          ? body.erlaeuterung.trim()
          : null;
    }

    // First notes on an open traktandum: put its Erläuterung on top as
    // "Ausgangslage: …". Only when the stored notes are still empty, so later
    // saves never add it twice.
    if ("content" in body && hasVisibleText(body.content)) {
      const { data: current } = await supabase
        .schema("protokoll_app")
        .from("entries")
        .select("content, erlaeuterung")
        .eq("id", id)
        .eq("workspace_id", workspaceId)
        .single();
      const erlaeuterung =
        "erlaeuterung" in body ? body.erlaeuterung : current?.erlaeuterung;
      if (current && !hasVisibleText(current.content) && erlaeuterung) {
        body.content = `${buildAusgangslage(erlaeuterung)}<div><br></div>${body.content}`;
      }
    }

    const { data, error } = await supabase
      .schema("protokoll_app")
      .from("entries")
      .update({
        ...body,
        updated_at: now,
        ...(isContentEdit && { date_modified: now }),
      })
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Entry not found",
          },
        },
        { status: 404 },
      );
    }

    // Re-sync todos whenever the notes changed. Non-fatal: a failed sync must
    // not fail the entry update.
    if ("content" in body) {
      try {
        await reconcileEntryTodos(supabase, {
          entryId: data.id,
          workspaceId,
          content: data.content,
          dateCreated: data.date_created,
        });
        await reconcileEntryZiele(supabase, {
          entryId: data.id,
          workspaceId,
          content: data.content,
        });
      } catch (syncError) {
        console.error("Todo sync failed on entry update:", syncError);
      }
    }

    return NextResponse.json({ item: data });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "UPDATE_ERROR",
          message: error.message || "Failed to update entry",
        },
      },
      { status: 500 },
    );
  }
}

// DELETE /api/entries/:id
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const workspaceId = cookieStore.get("workspace_id")?.value;

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .schema("protokoll_app")
      .from("entries")
      .delete()
      .eq("id", id)
      .eq("workspace_id", workspaceId);

    if (error) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Entry not found",
          },
        },
        { status: 404 },
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "DELETE_ERROR",
          message: error.message || "Failed to delete entry",
        },
      },
      { status: 500 },
    );
  }
}
