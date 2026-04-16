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
- **Commit discipline**: **Always commit directly to a new branch** in GitHub for each cohesive change. Do not commit to `main`/`trunk`. Create a descriptive branch (see naming below) and push commits incrementally.

## Behaviour

- When you think my commands lead to a suboptimal result **ALWAYS** let me know, and make a better suggestion. Suboptimal results meaning inefficent code, bad-practice, redundant code, ect.

- **NEVER** assume code or context, always look it up or ask me for context!

### Branch naming & commits

- Branch: `feat/<scope>-<short-slug>` or `chore/<scope>-<short-slug>` or `fix/<scope>-<short-slug>`
  - e.g., `feat/events-api-pagination`, `fix/ui-focus-ring`, `chore/ci-vitest`.
- Commit messages: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, etc.) with a concise imperative subject and a short body when useful.
- After pushing the first commit on a new branch, **open a PR** targeting `main` with a clear title/description.
