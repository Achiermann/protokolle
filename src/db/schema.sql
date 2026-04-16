-- Protokoll App Database Schema
-- Schema: protokoll_app

CREATE SCHEMA IF NOT EXISTS protokoll_app;

-- Protokoll entries table
CREATE TABLE protokoll_app.entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date_created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    item_title VARCHAR(255) NOT NULL,
    content TEXT,
    topic VARCHAR(255),
    project VARCHAR(255),
    members TEXT[],
    in_posteingang BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Todos table (title IS the description; no description column)
CREATE TABLE protokoll_app.todos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    topic VARCHAR(255),
    project VARCHAR(255),
    date_created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_todos_date_created ON protokoll_app.todos(date_created);
CREATE INDEX idx_todos_topic ON protokoll_app.todos(topic);
CREATE INDEX idx_todos_project ON protokoll_app.todos(project);

CREATE TRIGGER update_todos_updated_at
    BEFORE UPDATE ON protokoll_app.todos
    FOR EACH ROW
    EXECUTE FUNCTION protokoll_app.update_updated_at_column();

-- Index on date_created for chronological queries
CREATE INDEX idx_entries_date_created
ON protokoll_app.entries(date_created);

-- Index on project for filtering by project
CREATE INDEX idx_entries_project
ON protokoll_app.entries(project);

-- Index on topic for filtering by topic
CREATE INDEX idx_entries_topic
ON protokoll_app.entries(topic);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION protokoll_app.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_entries_updated_at
    BEFORE UPDATE ON protokoll_app.entries
    FOR EACH ROW
    EXECUTE FUNCTION protokoll_app.update_updated_at_column();
