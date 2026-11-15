-- Migration 0024: Parkplätze + Übernachtung section for booking gigs.
--   parking                → "Parkplätze" in Sonstige Infos (free text)
--   accommodation_label    → left side of the Übernachtung row ("Hotel", …)
--   accommodation_address  → right side: the address
-- The existing `accommodation` text stays and is shown as "Info" in the new
-- Übernachtung section.

ALTER TABLE protokoll_app.booking_shows
    ADD COLUMN IF NOT EXISTS parking TEXT,
    ADD COLUMN IF NOT EXISTS accommodation_label TEXT,
    ADD COLUMN IF NOT EXISTS accommodation_address TEXT;
