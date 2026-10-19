// Server-side helpers shared by the changelog route handlers.

// Attach `created_by_name` (profile name, else the local part of the email)
// to each comment row, mirroring how entries resolve their creator.
export async function attachCreatorNames(supabase, rows) {
  const creatorIds = [
    ...new Set(rows.map((row) => row.created_by).filter(Boolean)),
  ];
  let profileMap = new Map();
  if (creatorIds.length > 0) {
    const { data: profiles } = await supabase
      .schema("protokoll_app")
      .from("profiles")
      .select("id, name, email")
      .in("id", creatorIds);
    profileMap = new Map((profiles || []).map((p) => [p.id, p]));
  }
  return rows.map((row) => {
    const profile = profileMap.get(row.created_by);
    return {
      ...row,
      created_by_name:
        profile?.name || (profile?.email ? profile.email.split("@")[0] : null),
    };
  });
}

// A comment names its Vorgang either by `vorgang_id` (existing) or by
// `new_vorgang: { name, topic }`, which is created on the spot. Returns
// { vorgang, created } or { error } with a user-facing message.
export async function resolveVorgang(supabase, workspaceId, body) {
  if (body.new_vorgang) {
    const name = body.new_vorgang.name?.trim();
    if (!name) return { error: "Vorgang-Name ist erforderlich" };
    const { data, error } = await supabase
      .schema("protokoll_app")
      .from("vorgaenge")
      .insert([
        {
          workspace_id: workspaceId,
          name,
          topic: body.new_vorgang.topic?.trim() || null,
        },
      ])
      .select("*")
      .single();
    if (error) throw error;
    return { vorgang: data, created: true };
  }

  if (!body.vorgang_id) return { error: "Vorgang ist erforderlich" };
  const { data } = await supabase
    .schema("protokoll_app")
    .from("vorgaenge")
    .select("*")
    .eq("id", body.vorgang_id)
    .eq("workspace_id", workspaceId)
    .single();
  if (!data) return { error: "Vorgang nicht gefunden" };
  return { vorgang: data, created: false };
}
