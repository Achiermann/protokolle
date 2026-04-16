BEGIN;

ALTER TABLE protokoll_app.entries
  ADD COLUMN IF NOT EXISTS in_posteingang BOOLEAN NOT NULL DEFAULT false;

COMMIT;
