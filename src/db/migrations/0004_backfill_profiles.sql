-- 0004_backfill_profiles.sql
--
-- Hybrid auth model: Supabase Auth (auth.users) remains the credential store,
-- but every Protokolle user must be tracked inside the app schema via
-- protokoll_app.profiles. New users are already mirrored into profiles by the
-- application (api/auth/signup upserts the profile; api/workspaces/invite refuses
-- to add anyone who has no profile yet), so profiles stays complete going forward.
--
-- The one gap is legacy auth.users rows that predate the profiles mechanism
-- (e.g. the original owner account). This migration backfills profiles for those
-- users — and ONLY for users affiliated with a Protokolle workspace, so that
-- users belonging to other apps sharing this Supabase project (e.g. horse_ms)
-- are NOT pulled into protokoll_app.
--
-- Intentionally NO trigger on auth.users: auth is shared across apps, so a blanket
-- mirror would copy every other app's signups into protokoll_app.profiles. App
-- membership is owned at the application layer (signup + workspace invite).
--
-- Idempotent: safe to re-run (ON CONFLICT DO NOTHING).

INSERT INTO protokoll_app.profiles (id, email, name)
SELECT
  u.id,
  COALESCE(u.email, ''),
  COALESCE(
    u.raw_user_meta_data->>'name',
    u.raw_user_meta_data->>'full_name',
    split_part(u.email, '@', 1)
  )
FROM auth.users u
WHERE u.id IN (
  SELECT user_id FROM protokoll_app.workspace_members
  UNION
  SELECT created_by FROM protokoll_app.workspaces WHERE created_by IS NOT NULL
)
ON CONFLICT (id) DO NOTHING;
