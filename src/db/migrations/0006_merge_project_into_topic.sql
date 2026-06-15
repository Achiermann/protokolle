-- Migration: merge "projekte" into "themen".
-- Every project value moves into topic (where topic is empty), then the
-- project column is dropped entirely. No entry has both topic and project
-- set, so this is conflict-free. Apply via Supabase SQL editor or `psql`.

BEGIN;

UPDATE protokoll_app.entries
SET topic = project
WHERE (topic IS NULL OR topic = '')
  AND project IS NOT NULL
  AND project <> '';

DROP INDEX IF EXISTS protokoll_app.idx_entries_project;
ALTER TABLE protokoll_app.entries DROP COLUMN IF EXISTS project;

-- todos.project / its index may already be gone on this DB; guard with IF EXISTS.
DROP INDEX IF EXISTS protokoll_app.idx_todos_project;
ALTER TABLE protokoll_app.todos DROP COLUMN IF EXISTS project;

COMMIT;
