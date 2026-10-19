-- Migration 0018: "Als ungelesen markieren". A changelog_seen row now holds
-- the user's explicit state for a comment: unread = false (seen) or
-- unread = true (marked unread by hand, which works for any comment, own or
-- older than the user's baseline). Without a row the default rule applies.

BEGIN;

ALTER TABLE protokoll_app.changelog_seen
    ADD COLUMN unread BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;
