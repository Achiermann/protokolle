-- Migration 0009: link events ("Ziele") to the traktandum they were authored
-- in. Ziele now live as `/ziel@01.10.2026 Titel` markers inside entry notes
-- (parsed on save, like todos); those rows carry the entry_id. Ziele created
-- from the timeline stay workspace-only (entry_id NULL) and are the only ones
-- editable directly on the timeline — linked ones are owned by their marker.
--
-- Applied via the Supabase MCP.

ALTER TABLE protokoll_app.events ADD COLUMN IF NOT EXISTS entry_id UUID REFERENCES protokoll_app.entries(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_events_entry_id ON protokoll_app.events(entry_id);
