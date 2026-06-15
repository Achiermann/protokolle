# DECISIONS

> Single source of truth for the project. If any other doc disagrees with this file, follow THIS file.

## Non-negotiables

- Language: **JavaScript everywhere** (no TypeScript).
- Styling: **CSS Modules + design tokens** only. **No Tailwind. No CSS-in-JS.**
- Toaster: mounted in **`src/app/layout.js`** (client boundary). Do not mount elsewhere.
- Data access: **Server-only** via Next Route Handlers → repository → adapter. No Supabase client in React components.
- Auth: Supabase Auth. Authenticated users can CRUD **only their own** events (via RLS). `owner_id` is attached server-side.
- Pagination: `pageSize = 20` default. API returns `{ items, total, page, pageSize }`.
- Sorting (lists and Prev/Next): `(date ASC, time ASC, name ASC, id ASC)`.
- Search: case-insensitive on `name` + `location`; combined with filters via **AND**. 250ms client debounce.
- Errors: JSON envelope `{ error: { code, message } }` with appropriate HTTP status.
- Time: Store **UTC** (combine date+time on the server). Render in user’s locale/timezone on the client.
- Feature flags (client): prefix with `NEXT_PUBLIC_`. Example: `NEXT_PUBLIC_PERSIST`, `NEXT_PUBLIC_SEED`.
- **MCP first**: Before selecting any external SDK/library/service, **enumerate available MCP servers/tools** and prefer an MCP integration when it provides the required capability. Only use a non-MCP library if no suitable MCP is available or it lacks required features; document the rationale.
- **Commit discipline**: **Commit directly to `main`.** This is a solo project — no branch/PR workflow. Make cohesive commits with Conventional Commit messages and push to `main`.

## Behaviour

- When you think my commands lead to a suboptimal result **ALWAYS** let me know, and make a better suggestion. Suboptimal results meaning inefficent code, bad-practice, redundant code, ect.

- **NEVER** assume code or context, always look it up or ask me for context!

### Commits

- Commit messages: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, etc.) with a concise imperative subject and a short body when useful.
- Push directly to `main` (`git add -A && git commit && git push`). Branches and PRs are optional and not required for solo work.
- The git repo root is `my-app/` (the real `.git`). Do not run `git init` or commit from `my-app/src/`.
