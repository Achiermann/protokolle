-- Migration 0008: scheduling for the timeline view.
--
-- 1. `todos.scheduled` — optional planned date. Marker-todos carry it inline in
--    the notes text (`/todo@Anna+Ben@01.10.2026 Aufgabe`); the server parses it
--    on entry save. Standalone todos get it from the create form.
-- 2. `events` — workspace-level scheduled goals ("Ziele"). Not tied to a member
--    or an entry; shown on the timeline next to the scheduled todos.
--
-- Apply via the Supabase MCP / SQL editor.

BEGIN;

ALTER TABLE protokoll_app.todos ADD COLUMN IF NOT EXISTS scheduled DATE;
CREATE INDEX IF NOT EXISTS idx_todos_scheduled ON protokoll_app.todos(scheduled);

CREATE TABLE IF NOT EXISTS protokoll_app.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES protokoll_app.workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    scheduled DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_workspace_id ON protokoll_app.events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_events_scheduled ON protokoll_app.events(scheduled);

-- The helper from schema.sql never made it into the live database; create it
-- here so the trigger below has something to call.
CREATE OR REPLACE FUNCTION protokoll_app.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_events_updated_at
    BEFORE UPDATE ON protokoll_app.events
    FOR EACH ROW
    EXECUTE FUNCTION protokoll_app.update_updated_at_column();

-- Table-level grants (the protokoll_app schema isn't auto-granted like public).
GRANT ALL ON TABLE protokoll_app.events TO anon, authenticated, service_role;
GRANT SELECT ON TABLE protokoll_app.events TO authenticator;

-- RLS mirrors todos: any member of the workspace can read/write its events.
ALTER TABLE protokoll_app.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY events_select ON protokoll_app.events
    FOR SELECT USING (protokoll_app.is_workspace_member(workspace_id));
CREATE POLICY events_insert ON protokoll_app.events
    FOR INSERT WITH CHECK (protokoll_app.is_workspace_member(workspace_id));
CREATE POLICY events_update ON protokoll_app.events
    FOR UPDATE USING (protokoll_app.is_workspace_member(workspace_id))
    WITH CHECK (protokoll_app.is_workspace_member(workspace_id));
CREATE POLICY events_delete ON protokoll_app.events
    FOR DELETE USING (protokoll_app.is_workspace_member(workspace_id));

COMMIT;
