-- Migration 0013: workspace projects — a named span of time (start → end,
-- both inclusive) drawn as a horizontal bar across the top of the timeline.
-- Like free Ziele (events) they belong to the workspace as a whole.

BEGIN;

CREATE TABLE IF NOT EXISTS protokoll_app.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES protokoll_app.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT projects_dates_ordered CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_projects_workspace_id ON protokoll_app.projects(workspace_id);

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON protokoll_app.projects
    FOR EACH ROW
    EXECUTE FUNCTION protokoll_app.update_updated_at_column();

GRANT ALL ON TABLE protokoll_app.projects TO anon, authenticated, service_role;
GRANT SELECT ON TABLE protokoll_app.projects TO authenticator;

ALTER TABLE protokoll_app.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY projects_select ON protokoll_app.projects
    FOR SELECT USING (protokoll_app.is_workspace_member(workspace_id));
CREATE POLICY projects_insert ON protokoll_app.projects
    FOR INSERT WITH CHECK (protokoll_app.is_workspace_member(workspace_id));
CREATE POLICY projects_update ON protokoll_app.projects
    FOR UPDATE USING (protokoll_app.is_workspace_member(workspace_id))
    WITH CHECK (protokoll_app.is_workspace_member(workspace_id));
CREATE POLICY projects_delete ON protokoll_app.projects
    FOR DELETE USING (protokoll_app.is_workspace_member(workspace_id));

COMMIT;
