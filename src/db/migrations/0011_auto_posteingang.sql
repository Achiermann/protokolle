-- Migration 0011: a scheduled traktandum that still has no notes moves itself
-- into the Posteingang once its date arrives (see sweepDueEntries in
-- src/lib/posteingangSweep.js, run from the entries GET route).
--
-- `auto_posteingang_at` records when that happened, so the sweep is one-shot:
-- taking such a traktandum back out of the Posteingang by hand sticks, instead
-- of it being pushed back in on the next load.
--
-- Applied via the Supabase MCP.

ALTER TABLE protokoll_app.entries ADD COLUMN IF NOT EXISTS auto_posteingang_at TIMESTAMPTZ;
