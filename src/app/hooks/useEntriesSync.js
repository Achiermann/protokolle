import { useEffect } from "react";
import { useEntriesStore } from "../stores/useEntriesStore";

// Slow fallback poll. Partner changes normally arrive instantly via the
// realtime ping (see useRealtimeSync); this interval is only a safety net for
// a silently dead websocket, so it can be generous.
const POLL_INTERVAL_MS = 5 * 60 * 1000;

// Keeps the entries store warm for any view that reads entries.
// - Renders cached entries instantly; the spinner only appears on the first
//   ever load (see ensureEntries / fetchEntries silent mode).
// - Revalidates silently on mount, every POLL_INTERVAL_MS while the tab is
//   visible, and whenever the tab regains focus.
export function useEntriesSync() {
  useEffect(() => {
    const { ensureEntries, fetchEntries } = useEntriesStore.getState();
    const refetch = () => fetchEntries({ silent: true });

    ensureEntries();

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") refetch();
    }, POLL_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refetch();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);
}
