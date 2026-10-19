-- Migration 0016: per-user "seen" state for changelog logs and comments.
-- changelog_readers holds, per user and workspace, the moment they first
-- loaded the changelog: everything created before counts as seen, so nobody
-- starts with a flood of "new" items. changelog_seen records each log or
-- comment (by id; uuids don't collide across tables) a user has since seen.

BEGIN;

CREATE TABLE IF NOT EXISTS protokoll_app.changelog_readers (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES protokoll_app.workspaces(id) ON DELETE CASCADE,
    since TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, workspace_id)
);

CREATE TABLE IF NOT EXISTS protokoll_app.changelog_seen (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES protokoll_app.workspaces(id) ON DELETE CASCADE,
    item_id UUID NOT NULL,
    seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_changelog_seen_user_workspace ON protokoll_app.changelog_seen(user_id, workspace_id);

GRANT ALL ON TABLE protokoll_app.changelog_readers TO anon, authenticated, service_role;
GRANT SELECT ON TABLE protokoll_app.changelog_readers TO authenticator;
GRANT ALL ON TABLE protokoll_app.changelog_seen TO anon, authenticated, service_role;
GRANT SELECT ON TABLE protokoll_app.changelog_seen TO authenticator;

ALTER TABLE protokoll_app.changelog_readers ENABLE ROW LEVEL SECURITY;
ALTER TABLE protokoll_app.changelog_seen ENABLE ROW LEVEL SECURITY;

-- Each user only ever sees and writes their own rows.
CREATE POLICY changelog_readers_own ON protokoll_app.changelog_readers
    FOR ALL USING (
        user_id = auth.uid()
        AND protokoll_app.is_workspace_member(workspace_id)
    )
    WITH CHECK (
        user_id = auth.uid()
        AND protokoll_app.is_workspace_member(workspace_id)
    );
CREATE POLICY changelog_seen_own ON protokoll_app.changelog_seen
    FOR ALL USING (
        user_id = auth.uid()
        AND protokoll_app.is_workspace_member(workspace_id)
    )
    WITH CHECK (
        user_id = auth.uid()
        AND protokoll_app.is_workspace_member(workspace_id)
    );

COMMIT;
