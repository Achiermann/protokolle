-- Migration 0010: Traktanden are schedulable too. `entries.scheduled` is an
-- optional planned date set in the Traktandum form; scheduled entries show up
-- on the timeline (coloured by topic) alongside todos and Ziele. Archived
-- entries are filtered out of the timeline client-side.
--
-- Applied via the Supabase MCP.

ALTER TABLE protokoll_app.entries ADD COLUMN IF NOT EXISTS scheduled DATE;
CREATE INDEX IF NOT EXISTS idx_entries_scheduled ON protokoll_app.entries(scheduled);
