-- Migration 0017: drop the log level. Comments now hang directly off a
-- Vorgang (Thema → Vorgang → Kommentare). Every existing log becomes a
-- comment in its Vorgang, keeping its id (so "seen" rows carry over), author
-- and date: its creation time when logged the same day, else the log date
-- (midnight Zurich). That puts it ahead of the comments that were written on
-- it. Then changelog_logs is dropped.

BEGIN;

ALTER TABLE protokoll_app.changelog_comments
    ADD COLUMN vorgang_id UUID REFERENCES protokoll_app.vorgaenge(id) ON DELETE CASCADE;

UPDATE protokoll_app.changelog_comments c
SET vorgang_id = l.vorgang_id
FROM protokoll_app.changelog_logs l
WHERE l.id = c.log_id;

ALTER TABLE protokoll_app.changelog_comments DROP COLUMN log_id;

INSERT INTO protokoll_app.changelog_comments
    (id, workspace_id, vorgang_id, created_by, body, created_at, updated_at)
SELECT l.id,
       l.workspace_id,
       l.vorgang_id,
       l.created_by,
       l.change,
       CASE
           WHEN l.log_date = (l.created_at AT TIME ZONE 'Europe/Zurich')::date
               THEN l.created_at
           ELSE l.log_date::timestamp AT TIME ZONE 'Europe/Zurich'
       END,
       l.updated_at
FROM protokoll_app.changelog_logs l;

ALTER TABLE protokoll_app.changelog_comments ALTER COLUMN vorgang_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_changelog_comments_vorgang_id ON protokoll_app.changelog_comments(vorgang_id);

DROP TABLE protokoll_app.changelog_logs;

COMMIT;
