-- Migration 0019: optional "Erläuterung" for a traktandum — a short plain-text
-- explanation entered when the traktandum is created. While the traktandum is
-- still open (no notes) it shows in italics after the title; when notes are
-- saved for the first time the API puts it on top of them as
-- "<b>Ausgangslage: </b>…". The column is kept afterwards but no longer shown.

ALTER TABLE protokoll_app.entries ADD COLUMN IF NOT EXISTS erlaeuterung TEXT;
