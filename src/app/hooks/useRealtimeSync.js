import { useEffect } from "react";
import { useAuthStore } from "../stores/useAuthStore";
import { useEntriesStore } from "../stores/useEntriesStore";
import { useTodosStore } from "../stores/useTodosStore";
import { useEventsStore } from "../stores/useEventsStore";
import { useProjectsStore } from "../stores/useProjectsStore";
import { useChangelogStore } from "../stores/useChangelogStore";
import {
  getSupabaseBrowserClient,
  isRealtimeConfigured,
  setWorkspaceChannel,
} from "@/db/supabase-browser";

// Realtime "doorbell": every client in a workspace joins the same broadcast
// channel. After a successful mutation the stores send a tiny ping (see
// pingWorkspaceChange in supabase-browser.js); everyone else reacts by
// silently refetching entries and todos through the normal API routes. No app
// data travels over the channel, and our own pings are not echoed back
// (broadcast.self = false) — the local store is already up to date after a
// mutation. If the websocket is unavailable, the app degrades to the slow
// fallback poll and on-focus refetch in useEntriesSync.
export function useRealtimeSync() {
  const workspaceId = useAuthStore((state) => state.workspace?.id);

  useEffect(() => {
    if (!workspaceId) return undefined;
    if (!isRealtimeConfigured()) {
      console.warn(
        "Realtime sync disabled: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set.",
      );
      return undefined;
    }

    const supabase = getSupabaseBrowserClient();
    const refetchAll = () => {
      // Always all of them: entry edits can also create or change todos via the
      // server-side /todo marker sync, and events and projects feed the
      // timeline. The changelog only refetches once it has been opened.
      useEntriesStore.getState().fetchEntries({ silent: true });
      useTodosStore.getState().fetchTodos({ silent: true });
      useEventsStore.getState().fetchEvents({ silent: true });
      useProjectsStore.getState().fetchProjects({ silent: true });
      if (useChangelogStore.getState().loaded) {
        useChangelogStore.getState().fetchChangelog({ silent: true });
      }
    };

    // Refetch on every (re)subscribe except the very first, which coincides
    // with the mount fetches from useEntriesSync / ensureTodos. A resubscribe
    // means the websocket was down and pings may have been missed meanwhile.
    let hasSubscribedOnce = false;

    const channel = supabase.channel(`workspace:${workspaceId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "change" }, refetchAll)
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        if (hasSubscribedOnce) refetchAll();
        hasSubscribedOnce = true;
      });

    setWorkspaceChannel(channel);

    return () => {
      setWorkspaceChannel(null);
      supabase.removeChannel(channel);
    };
  }, [workspaceId]);
}
