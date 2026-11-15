-- Migration 0023: pending workspace invitations.
--
-- Admins can invite an email that has no Protokolle account yet. The invite
-- waits here until someone signs in with that (confirmed) email; the app then
-- turns it into a workspace_members row and deletes it
-- (src/lib/claimInvitations.js, runs with the service role).
--
-- No trigger on auth.users: that table is shared with other apps.

BEGIN;

CREATE TABLE IF NOT EXISTS protokoll_app.workspace_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES protokoll_app.workspaces(id) ON DELETE CASCADE,
    email TEXT NOT NULL CHECK (email = lower(btrim(email)) AND email <> ''),
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, email)
);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_email
    ON protokoll_app.workspace_invitations(email);

GRANT ALL ON TABLE protokoll_app.workspace_invitations TO anon, authenticated, service_role;
ALTER TABLE protokoll_app.workspace_invitations ENABLE ROW LEVEL SECURITY;

-- Only workspace admins see and manage invitations.
CREATE POLICY workspace_invitations_admin ON protokoll_app.workspace_invitations
    FOR ALL USING (protokoll_app.is_workspace_admin(workspace_id))
    WITH CHECK (protokoll_app.is_workspace_admin(workspace_id));

COMMIT;
