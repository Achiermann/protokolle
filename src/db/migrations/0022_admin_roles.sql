-- Migration 0022: admin roles + booking project access.
--
-- Roles in workspace_members.role:
--   owner  — created the workspace; always admin, cannot be demoted
--   admin  — full access to every app (Protokolle, Finanzen, Booking)
--   member — sees only the Booking projects they were added to (read-only)
--
-- Every existing member becomes admin. From now on the content tables are
-- admin-only; non-admins reach booking data only through
-- booking_project_members.

BEGIN;

-- *** ROLES ***
UPDATE protokoll_app.workspace_members SET role = 'admin' WHERE role = 'member';

ALTER TABLE protokoll_app.workspace_members
    DROP CONSTRAINT IF EXISTS workspace_members_role_check;
ALTER TABLE protokoll_app.workspace_members
    ADD CONSTRAINT workspace_members_role_check CHECK (role IN ('owner', 'admin', 'member'));

CREATE OR REPLACE FUNCTION protokoll_app.is_workspace_admin(ws_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'protokoll_app', 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM protokoll_app.workspace_members
    WHERE workspace_id = ws_id AND user_id = auth.uid() AND role IN ('owner', 'admin')
  );
$$;

-- *** BOOKING PROJECT MEMBERS ***
CREATE TABLE IF NOT EXISTS protokoll_app.booking_project_members (
    project_id UUID NOT NULL REFERENCES protokoll_app.booking_projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES protokoll_app.workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (project_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_booking_project_members_user
    ON protokoll_app.booking_project_members(user_id);

GRANT ALL ON TABLE protokoll_app.booking_project_members TO anon, authenticated, service_role;
GRANT SELECT ON TABLE protokoll_app.booking_project_members TO authenticator;
ALTER TABLE protokoll_app.booking_project_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION protokoll_app.is_booking_project_member(p_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'protokoll_app', 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM protokoll_app.booking_project_members m
    JOIN protokoll_app.workspace_members wm
      ON wm.workspace_id = m.workspace_id AND wm.user_id = m.user_id
    WHERE m.project_id = p_id AND m.user_id = auth.uid()
  );
$$;

-- A venue is visible to a member when it hosts a show of one of their projects.
CREATE OR REPLACE FUNCTION protokoll_app.is_booking_venue_visible(v_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'protokoll_app', 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM protokoll_app.booking_shows s
    WHERE s.venue_id = v_id AND protokoll_app.is_booking_project_member(s.project_id)
  );
$$;

CREATE POLICY booking_project_members_admin ON protokoll_app.booking_project_members
    FOR ALL USING (protokoll_app.is_workspace_admin(workspace_id))
    WITH CHECK (protokoll_app.is_workspace_admin(workspace_id));
CREATE POLICY booking_project_members_own ON protokoll_app.booking_project_members
    FOR SELECT USING (user_id = auth.uid());

-- *** CONTENT TABLES → ADMIN ONLY ***
-- Swap is_workspace_member for is_workspace_admin in every policy of these
-- tables, keeping the rest of each expression (e.g. created_by = auth.uid()).
DO $$
DECLARE
    pol record;
    stmt text;
BEGIN
    FOR pol IN
        SELECT tablename, policyname, qual, with_check
        FROM pg_policies
        WHERE schemaname = 'protokoll_app'
          AND tablename IN (
            'entries', 'todos', 'events', 'projects', 'vorgaenge',
            'changelog_comments', 'changelog_reactions', 'changelog_readers',
            'changelog_seen', 'booking_venues', 'booking_projects', 'booking_shows'
          )
    LOOP
        stmt := format('ALTER POLICY %I ON protokoll_app.%I', pol.policyname, pol.tablename);
        IF pol.qual IS NOT NULL THEN
            stmt := stmt || ' USING (' || replace(pol.qual, 'is_workspace_member(', 'is_workspace_admin(') || ')';
        END IF;
        IF pol.with_check IS NOT NULL THEN
            stmt := stmt || ' WITH CHECK (' || replace(pol.with_check, 'is_workspace_member(', 'is_workspace_admin(') || ')';
        END IF;
        EXECUTE stmt;
    END LOOP;
END $$;

-- Read access for project members (writes stay admin-only).
CREATE POLICY booking_projects_member_select ON protokoll_app.booking_projects
    FOR SELECT USING (protokoll_app.is_booking_project_member(id));
CREATE POLICY booking_shows_member_select ON protokoll_app.booking_shows
    FOR SELECT USING (protokoll_app.is_booking_project_member(project_id));
CREATE POLICY booking_venues_member_select ON protokoll_app.booking_venues
    FOR SELECT USING (protokoll_app.is_booking_venue_visible(id));

-- *** WORKSPACE MEMBERS ***
-- Admins manage membership; the owner row is untouchable. Self-insert is only
-- allowed as owner of a workspace you just created (closes a hole where any
-- user could join any workspace by id).
ALTER POLICY workspace_members_insert ON protokoll_app.workspace_members
    WITH CHECK (
        protokoll_app.is_workspace_admin(workspace_id)
        OR (
            user_id = auth.uid() AND role = 'owner'
            AND EXISTS (
                SELECT 1 FROM protokoll_app.workspaces w
                WHERE w.id = workspace_id AND w.created_by = auth.uid()
            )
        )
    );
ALTER POLICY workspace_members_update ON protokoll_app.workspace_members
    USING (protokoll_app.is_workspace_admin(workspace_id) AND role <> 'owner')
    WITH CHECK (protokoll_app.is_workspace_admin(workspace_id) AND role IN ('admin', 'member'));
ALTER POLICY workspace_members_delete ON protokoll_app.workspace_members
    USING (
        (user_id = auth.uid() AND role <> 'owner')
        OR (protokoll_app.is_workspace_admin(workspace_id) AND role <> 'owner')
    );

COMMIT;
