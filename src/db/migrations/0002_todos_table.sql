-- Migration 0002: give todos a dedicated table (single source of truth) and
-- drop the unused inline `todo` column from entries.
--
-- Todos used to be virtual: derived at render time by scanning each entry's
-- `content` for `/todo@Name task` markers. They now live in their own table.
-- The `/todo@Name` marker stays the authoring affordance inside an entry's
-- notes; the API parses those markers on entry save and upserts rows here.
-- `done` and `comment` are owned exclusively by this table.
--
-- Apply via the Supabase MCP / SQL editor.

BEGIN;

-- Legacy, never used by the app (todos were derived from `content`).
ALTER TABLE protokoll_app.entries DROP COLUMN IF EXISTS todo;

CREATE TABLE IF NOT EXISTS protokoll_app.todos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Nullable: standalone todos (created from the todo panel) have no traktandum.
    entry_id UUID REFERENCES protokoll_app.entries(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES protokoll_app.workspaces(id) ON DELETE CASCADE,
    assignee TEXT,
    title TEXT NOT NULL,
    -- Own topic for standalone todos; marker-todos inherit their entry's topic.
    topic VARCHAR(255),
    done BOOLEAN NOT NULL DEFAULT FALSE,
    comment TEXT,
    date_created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_todos_workspace_id ON protokoll_app.todos(workspace_id);
CREATE INDEX IF NOT EXISTS idx_todos_entry_id ON protokoll_app.todos(entry_id);
CREATE INDEX IF NOT EXISTS idx_todos_done ON protokoll_app.todos(done);

-- Table-level grants (the protokoll_app schema isn't auto-granted like public).
-- Mirrors entries; RLS below still restricts which rows each role can see.
GRANT ALL ON TABLE protokoll_app.todos TO anon, authenticated, service_role;
GRANT SELECT ON TABLE protokoll_app.todos TO authenticator;

-- RLS mirrors entries: any member of the workspace can read/write its todos.
ALTER TABLE protokoll_app.todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY todos_select ON protokoll_app.todos
    FOR SELECT USING (protokoll_app.is_workspace_member(workspace_id));
CREATE POLICY todos_insert ON protokoll_app.todos
    FOR INSERT WITH CHECK (protokoll_app.is_workspace_member(workspace_id));
CREATE POLICY todos_update ON protokoll_app.todos
    FOR UPDATE USING (protokoll_app.is_workspace_member(workspace_id))
    WITH CHECK (protokoll_app.is_workspace_member(workspace_id));
CREATE POLICY todos_delete ON protokoll_app.todos
    FOR DELETE USING (protokoll_app.is_workspace_member(workspace_id));

-- One-time backfill of existing inline todos. The regex mirrors
-- createTodoRegex() in src/lib/richText.js: /(todo|done)@<assignee> <title>.
-- Underscores in the assignee tag map back to spaces, the title is trimmed.
INSERT INTO protokoll_app.todos (entry_id, workspace_id, assignee, title, done, date_created)
SELECT e.id,
       e.workspace_id,
       replace(m[2], '_', ' ') AS assignee,
       btrim(m[3]) AS title,
       (m[1] = 'done') AS done,
       e.date_created
FROM protokoll_app.entries e,
     LATERAL regexp_matches(e.content, '/(todo|done)@([^\s<]+)[ \t]+([^<\n]+)', 'g') AS m
WHERE e.content IS NOT NULL;

COMMIT;
