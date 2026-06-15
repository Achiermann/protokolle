-- 0005_drop_members_table.sql
--
-- App rule: only authenticated accounts (linked to an email) may access or be
-- mentioned in a workspace. The assignable "people" in the UI already come from
-- workspace_members ⋈ profiles, so the standalone protokoll_app.members table
-- (free-form name/email participants) is redundant and unused by app code.
--
-- 1. Repoint todos.assigned_to from members -> profiles, so a todo can only be
--    assigned to an authenticated workspace user. ON DELETE SET NULL keeps todos
--    when a user is removed.
-- 2. Drop the now-orphaned members table (0 rows, no remaining inbound FK).
--
-- Safe: members has 0 rows and no todo currently has an assignee.

ALTER TABLE protokoll_app.todos DROP CONSTRAINT IF EXISTS todos_assigned_to_fkey;

ALTER TABLE protokoll_app.todos
  ADD CONSTRAINT todos_assigned_to_fkey
  FOREIGN KEY (assigned_to)
  REFERENCES protokoll_app.profiles (id)
  ON DELETE SET NULL;

DROP TABLE IF EXISTS protokoll_app.members;
