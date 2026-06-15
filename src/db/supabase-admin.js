import { createClient } from "@supabase/supabase-js";

// Server-only admin client. Uses the service-role key, so it bypasses RLS and
// can call the auth admin API (generateLink, createUser, ...). NEVER import this
// from a React component or expose the service-role key to the client.
export function createSupabaseAdminClient() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
