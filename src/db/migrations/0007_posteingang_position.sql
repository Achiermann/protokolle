-- 0007: Manual ordering for the Posteingang section
-- Adds posteingang_position to entries. NULL = never manually ordered; the UI
-- sorts NULLs last (by date_created DESC) and assigns real positions on the
-- first drag. The backfill gives existing Posteingang items their current
-- display order (date_created DESC, the default list order), per workspace.

ALTER TABLE protokoll_app.entries
  ADD COLUMN IF NOT EXISTS posteingang_position INTEGER;

WITH ordered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY workspace_id
      ORDER BY date_created DESC
    ) - 1 AS pos
  FROM protokoll_app.entries
  WHERE in_posteingang = true OR topic = 'posteingang'
)
UPDATE protokoll_app.entries e
SET posteingang_position = o.pos
FROM ordered o
WHERE e.id = o.id;
