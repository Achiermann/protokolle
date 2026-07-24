import { createClient } from '@supabase/supabase-js';

// Browser-side Supabase client, used ONLY for the realtime "doorbell" channel
// (see useRealtimeSync). All data reads and writes keep going through the Next
// API routes; this client never queries tables, so the publishable anon key
// without a user session is all it needs.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let browserClient = null;

export function isRealtimeConfigured() {
  return Boolean(supabaseUrl && supabaseKey);
}

// Lazy singleton so importing this module during SSR of client components
// never constructs a client or throws on missing env vars.
export function getSupabaseBrowserClient() {
  if (!browserClient) {
    browserClient = createClient(supabaseUrl, supabaseKey);
  }
  return browserClient;
}

// The active workspace channel, registered by useRealtimeSync while it is
// subscribed. Stores use it to announce successful mutations to the other
// clients in the workspace.
let workspaceChannel = null;

export function setWorkspaceChannel(channel) {
  workspaceChannel = channel;
}

// Fire-and-forget: a lost ping only means the partner falls back to the slow
// poll / on-focus refetch, so a failure here must never affect the mutation
// that triggered it. The payload is intentionally empty — receivers just
// refetch through the normal authenticated API routes.
export function pingWorkspaceChange() {
  if (!workspaceChannel) return;
  workspaceChannel
    .send({ type: 'broadcast', event: 'change', payload: {} })
    .catch(() => {});
}
