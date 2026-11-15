-- Migration 0023: structured gig schedule.
--
-- schedule_items replaces the free-text booking_shows.schedule: an ordered
-- list of { id, time, text } where time is "HH:MM" (24h) or null for an
-- untimed line ("Danach Barbetrieb"). Order is the array order (set by drag &
-- drop in the Intern sheet), not the time.
--
-- The existing free-text schedules were converted once when this migration
-- was applied (one-off script: first time → HH:MM, AM/PM → 24h, a range end
-- or "ca." folded into the text). The old `schedule` column is kept untouched
-- as a backup and is no longer read.

ALTER TABLE protokoll_app.booking_shows
    ADD COLUMN IF NOT EXISTS schedule_items JSONB NOT NULL DEFAULT '[]'::jsonb;
