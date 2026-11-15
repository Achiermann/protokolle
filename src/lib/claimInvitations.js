import { createSupabaseAdminClient } from "@/db/supabase-admin";

// Turns pending workspace invitations for the signed-in user's email into
// memberships, then deletes them. Only for confirmed emails, so nobody can
// claim an invite by registering someone else's address. Idempotent and best
// effort: a failure is logged and never blocks the caller.
export async function claimInvitations(user) {
  if (!user?.email || !user.email_confirmed_at) return;

  try {
    const db = createSupabaseAdminClient().schema("protokoll_app");
    const email = user.email.toLowerCase();

    const { data: invites, error } = await db
      .from("workspace_invitations")
      .select("id, workspace_id, role")
      .eq("email", email);
    if (error) throw error;
    if (!invites?.length) return;

    // Accounts created by another app on the shared auth have no profile yet.
    const { error: profileError } = await db
      .from("profiles")
      .upsert([{ id: user.id, email }], {
        onConflict: "id",
        ignoreDuplicates: true,
      });
    if (profileError) throw profileError;

    const { error: memberError } = await db.from("workspace_members").upsert(
      invites.map((i) => ({
        workspace_id: i.workspace_id,
        user_id: user.id,
        role: i.role,
      })),
      { onConflict: "workspace_id,user_id", ignoreDuplicates: true },
    );
    if (memberError) throw memberError;

    const { error: deleteError } = await db
      .from("workspace_invitations")
      .delete()
      .in(
        "id",
        invites.map((i) => i.id),
      );
    if (deleteError) throw deleteError;
  } catch (error) {
    console.error("[claimInvitations]", error);
  }
}
