-- Migration: move todos out of entries into their own table.
-- Apply via Supabase SQL editor or `psql`.

BEGIN;

ALTER TABLE protokoll_app.entries DROP COLUMN IF EXISTS todo;

CREATE TABLE IF NOT EXISTS protokoll_app.todos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    topic VARCHAR(255),
    project VARCHAR(255),
    date_created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_todos_date_created ON protokoll_app.todos(date_created);
CREATE INDEX IF NOT EXISTS idx_todos_topic ON protokoll_app.todos(topic);
CREATE INDEX IF NOT EXISTS idx_todos_project ON protokoll_app.todos(project);

DROP TRIGGER IF EXISTS update_todos_updated_at ON protokoll_app.todos;
CREATE TRIGGER update_todos_updated_at
    BEFORE UPDATE ON protokoll_app.todos
    FOR EACH ROW
    EXECUTE FUNCTION protokoll_app.update_updated_at_column();

COMMIT;
