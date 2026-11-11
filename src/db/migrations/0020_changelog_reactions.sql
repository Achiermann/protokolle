-- Migration 0020: emoji reactions on changelog comments, WhatsApp-style. Each
-- user has at most one reaction per comment (a new emoji replaces it), from a
-- fixed set. Any workspace member can see them; each user only sets, changes
-- and removes their own. Reactions are silent: they don't touch read state.

BEGIN;

CREATE TABLE IF NOT EXISTS protokoll_app.changelog_reactions (
    comment_id UUID NOT NULL REFERENCES protokoll_app.changelog_comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES protokoll_app.workspaces(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL CHECK (emoji IN ('👍', '👎', '❤️', '😂', '😮', '😢')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_changelog_reactions_workspace_id ON protokoll_app.changelog_reactions(workspace_id);

GRANT ALL ON TABLE protokoll_app.changelog_reactions TO anon, authenticated, service_role;
GRANT SELECT ON TABLE protokoll_app.changelog_reactions TO authenticator;

ALTER TABLE protokoll_app.changelog_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY changelog_reactions_select ON protokoll_app.changelog_reactions
    FOR SELECT USING (protokoll_app.is_workspace_member(workspace_id));
CREATE POLICY changelog_reactions_insert ON protokoll_app.changelog_reactions
    FOR INSERT WITH CHECK (
        protokoll_app.is_workspace_member(workspace_id)
        AND user_id = auth.uid()
    );
CREATE POLICY changelog_reactions_update ON protokoll_app.changelog_reactions
    FOR UPDATE USING (
        protokoll_app.is_workspace_member(workspace_id)
        AND user_id = auth.uid()
    )
    WITH CHECK (
        protokoll_app.is_workspace_member(workspace_id)
        AND user_id = auth.uid()
    );
CREATE POLICY changelog_reactions_delete ON protokoll_app.changelog_reactions
    FOR DELETE USING (
        protokoll_app.is_workspace_member(workspace_id)
        AND user_id = auth.uid()
    );

COMMIT;
