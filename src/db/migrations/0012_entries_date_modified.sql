-- Migration 0012: the "Datum" column of a traktandum shows when its content
-- last changed, not when it was created. `date_modified` is bumped by the API
-- only on content edits (title, topic, scheduled, notes, or a todo rewriting
-- the notes) — unlike `updated_at`, which also moves on archive, Posteingang
-- moves and reordering. `date_created` stays untouched.
--
-- Existing rows start out at their creation date.

ALTER TABLE protokoll_app.entries ADD COLUMN IF NOT EXISTS date_modified TIMESTAMPTZ;
UPDATE protokoll_app.entries SET date_modified = date_created WHERE date_modified IS NULL;
ALTER TABLE protokoll_app.entries ALTER COLUMN date_modified SET DEFAULT NOW();
ALTER TABLE protokoll_app.entries ALTER COLUMN date_modified SET NOT NULL;
