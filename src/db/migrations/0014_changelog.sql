-- Migration 0014: changelog. A Vorgang is a named strand of work (e.g.
-- "Filmer finden") filed under an optional Thema; its logs record what was
-- done and when ("01.02. Filmer angefragt"). Both belong to the workspace as
-- a whole. `created_by` is set server-side from the logged-in user.

BEGIN;

CREATE TABLE IF NOT EXISTS protokoll_app.vorgaenge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES protokoll_app.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    topic VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS protokoll_app.changelog_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES protokoll_app.workspaces(id) ON DELETE CASCADE,
    vorgang_id UUID NOT NULL REFERENCES protokoll_app.vorgaenge(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    change TEXT NOT NULL,
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vorgaenge_workspace_id ON protokoll_app.vorgaenge(workspace_id);
CREATE INDEX IF NOT EXISTS idx_changelog_logs_workspace_id ON protokoll_app.changelog_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_changelog_logs_vorgang_id ON protokoll_app.changelog_logs(vorgang_id);

CREATE TRIGGER update_vorgaenge_updated_at
    BEFORE UPDATE ON protokoll_app.vorgaenge
    FOR EACH ROW
    EXECUTE FUNCTION protokoll_app.update_updated_at_column();

CREATE TRIGGER update_changelog_logs_updated_at
    BEFORE UPDATE ON protokoll_app.changelog_logs
    FOR EACH ROW
    EXECUTE FUNCTION protokoll_app.update_updated_at_column();

GRANT ALL ON TABLE protokoll_app.vorgaenge TO anon, authenticated, service_role;
GRANT SELECT ON TABLE protokoll_app.vorgaenge TO authenticator;
GRANT ALL ON TABLE protokoll_app.changelog_logs TO anon, authenticated, service_role;
GRANT SELECT ON TABLE protokoll_app.changelog_logs TO authenticator;

ALTER TABLE protokoll_app.vorgaenge ENABLE ROW LEVEL SECURITY;
ALTER TABLE protokoll_app.changelog_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY vorgaenge_select ON protokoll_app.vorgaenge
    FOR SELECT USING (protokoll_app.is_workspace_member(workspace_id));
CREATE POLICY vorgaenge_insert ON protokoll_app.vorgaenge
    FOR INSERT WITH CHECK (protokoll_app.is_workspace_member(workspace_id));
CREATE POLICY vorgaenge_update ON protokoll_app.vorgaenge
    FOR UPDATE USING (protokoll_app.is_workspace_member(workspace_id))
    WITH CHECK (protokoll_app.is_workspace_member(workspace_id));
CREATE POLICY vorgaenge_delete ON protokoll_app.vorgaenge
    FOR DELETE USING (protokoll_app.is_workspace_member(workspace_id));

CREATE POLICY changelog_logs_select ON protokoll_app.changelog_logs
    FOR SELECT USING (protokoll_app.is_workspace_member(workspace_id));
CREATE POLICY changelog_logs_insert ON protokoll_app.changelog_logs
    FOR INSERT WITH CHECK (protokoll_app.is_workspace_member(workspace_id));
CREATE POLICY changelog_logs_update ON protokoll_app.changelog_logs
    FOR UPDATE USING (protokoll_app.is_workspace_member(workspace_id))
    WITH CHECK (protokoll_app.is_workspace_member(workspace_id));
CREATE POLICY changelog_logs_delete ON protokoll_app.changelog_logs
    FOR DELETE USING (protokoll_app.is_workspace_member(workspace_id));

COMMIT;
