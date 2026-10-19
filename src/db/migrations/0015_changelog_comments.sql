-- Migration 0015: comments on changelog logs, shown under a log as a chat
-- thread. Any workspace member can read and write them; only the author may
-- edit or delete their own.

BEGIN;

CREATE TABLE IF NOT EXISTS protokoll_app.changelog_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES protokoll_app.workspaces(id) ON DELETE CASCADE,
    log_id UUID NOT NULL REFERENCES protokoll_app.changelog_logs(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_changelog_comments_workspace_id ON protokoll_app.changelog_comments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_changelog_comments_log_id ON protokoll_app.changelog_comments(log_id);

CREATE TRIGGER update_changelog_comments_updated_at
    BEFORE UPDATE ON protokoll_app.changelog_comments
    FOR EACH ROW
    EXECUTE FUNCTION protokoll_app.update_updated_at_column();

GRANT ALL ON TABLE protokoll_app.changelog_comments TO anon, authenticated, service_role;
GRANT SELECT ON TABLE protokoll_app.changelog_comments TO authenticator;

ALTER TABLE protokoll_app.changelog_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY changelog_comments_select ON protokoll_app.changelog_comments
    FOR SELECT USING (protokoll_app.is_workspace_member(workspace_id));
CREATE POLICY changelog_comments_insert ON protokoll_app.changelog_comments
    FOR INSERT WITH CHECK (
        protokoll_app.is_workspace_member(workspace_id)
        AND created_by = auth.uid()
    );
CREATE POLICY changelog_comments_update ON protokoll_app.changelog_comments
    FOR UPDATE USING (
        protokoll_app.is_workspace_member(workspace_id)
        AND created_by = auth.uid()
    )
    WITH CHECK (
        protokoll_app.is_workspace_member(workspace_id)
        AND created_by = auth.uid()
    );
CREATE POLICY changelog_comments_delete ON protokoll_app.changelog_comments
    FOR DELETE USING (
        protokoll_app.is_workspace_member(workspace_id)
        AND created_by = auth.uid()
    );

COMMIT;
