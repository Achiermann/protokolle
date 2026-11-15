-- Migration 0021: Booking app (b) — venues, booking projects (e.g. a tour)
-- and the shows/dates inside a project.
--
-- Split along "what belongs to the place" vs. "what belongs to this night":
--   booking_venues   — stable facts about a venue: address, contact, tech specs.
--                      Reused across tours.
--   booking_projects — a tour or other booking project ("Herbsttour 2027").
--                      Separate from protokoll_app.projects (timeline bars).
--   booking_shows    — one date of a project. venue_id is optional so held or
--                      placeholder dates ("Livesession?") can exist without a venue.
--                      Every gigfile column is a real column; only the two
--                      checklists (Tech / Promo), whose items will keep
--                      changing, live in a JSONB object.

BEGIN;

CREATE TABLE IF NOT EXISTS protokoll_app.booking_venues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES protokoll_app.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    city TEXT,
    address TEXT,
    contact_name TEXT,
    contact_email TEXT,
    tech_specs TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS protokoll_app.booking_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES protokoll_app.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'tour' CHECK (kind IN ('tour', 'other')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS protokoll_app.booking_shows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES protokoll_app.workspaces(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES protokoll_app.booking_projects(id) ON DELETE CASCADE,
    venue_id UUID REFERENCES protokoll_app.booking_venues(id) ON DELETE SET NULL,
    show_date DATE NOT NULL,
    label TEXT,              -- placeholder title when there is no venue yet
    event_name TEXT,         -- Veranstaltung
    hosting TEXT,
    deal TEXT,
    ticket_price TEXT,       -- Eintritt
    schedule TEXT,
    set_length TEXT,         -- Setlänge
    line_up TEXT,
    dinner TEXT,
    travel_party INTEGER,
    accommodation TEXT,      -- Übernachtung
    tech_person TEXT,
    merch_person TEXT,
    tech_notes TEXT,         -- show-specific Pult / Tech Specs (overrides venue)
    notes TEXT,              -- Sonstige Notizen
    payout TEXT,             -- Gagen Auszahlung
    checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_venues_workspace_id ON protokoll_app.booking_venues(workspace_id);
CREATE INDEX IF NOT EXISTS idx_booking_projects_workspace_id ON protokoll_app.booking_projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_booking_shows_project_date ON protokoll_app.booking_shows(project_id, show_date);
CREATE INDEX IF NOT EXISTS idx_booking_shows_venue_id ON protokoll_app.booking_shows(venue_id);

CREATE TRIGGER update_booking_venues_updated_at
    BEFORE UPDATE ON protokoll_app.booking_venues
    FOR EACH ROW EXECUTE FUNCTION protokoll_app.update_updated_at_column();
CREATE TRIGGER update_booking_projects_updated_at
    BEFORE UPDATE ON protokoll_app.booking_projects
    FOR EACH ROW EXECUTE FUNCTION protokoll_app.update_updated_at_column();
CREATE TRIGGER update_booking_shows_updated_at
    BEFORE UPDATE ON protokoll_app.booking_shows
    FOR EACH ROW EXECUTE FUNCTION protokoll_app.update_updated_at_column();

GRANT ALL ON TABLE protokoll_app.booking_venues, protokoll_app.booking_projects, protokoll_app.booking_shows
    TO anon, authenticated, service_role;
GRANT SELECT ON TABLE protokoll_app.booking_venues, protokoll_app.booking_projects, protokoll_app.booking_shows
    TO authenticator;

ALTER TABLE protokoll_app.booking_venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE protokoll_app.booking_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE protokoll_app.booking_shows ENABLE ROW LEVEL SECURITY;

CREATE POLICY booking_venues_all ON protokoll_app.booking_venues
    FOR ALL USING (protokoll_app.is_workspace_member(workspace_id))
    WITH CHECK (protokoll_app.is_workspace_member(workspace_id));
CREATE POLICY booking_projects_all ON protokoll_app.booking_projects
    FOR ALL USING (protokoll_app.is_workspace_member(workspace_id))
    WITH CHECK (protokoll_app.is_workspace_member(workspace_id));
CREATE POLICY booking_shows_all ON protokoll_app.booking_shows
    FOR ALL USING (protokoll_app.is_workspace_member(workspace_id))
    WITH CHECK (protokoll_app.is_workspace_member(workspace_id));

COMMIT;
