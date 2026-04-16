# CLAUDE PROJECT RULES

## About the project

This is "Protokolle APP". The idea of the app is to create, store and manage agenda items for meetings and write and save whatever is decided on the agenda item.

example:

Traktandum: "Who will make the finances for this job?"
"Kevin: Thinks Andreas should do them.
Andreas agrees"

There will be a list of all agenda items "Traktanden" on a front page. 
The agenda items can be filtered and or sorted by date, topic or project.
So each item when created keeps a current date date, and a topic can be added. 
Topics can be added via a dropdown containing previous created topics, or as a new one that can
be created on the spot.

For each agenda item there can be a todo that can be linked to a person in the meeting group.
There will also be a todo-list on a separate to-do pannel, showing all todos for each meeting group member.

There will be a settings pannel where meeting members can be added.

## Setup

Next is pre installed in this project.

## Tech stack (hard constraints)

- Next.js **App Router**, in `src/app`.
- Language: **JavaScript only**. **No TypeScript**.
- Styling: **plain CSS** and **CSS Modules**. **No Tailwind**. **No CSS-in-JS**.
- State: **Zustand** (`useItemsStore`) as the single source of truth.
- Notifications: **react-hot-toast** via a global `<Toaster />` in the layout.
- UI library: prefer UI-libraries that can be used without Tailwind or Typescript, and that include MCPs (if possible).

## Project structure

- Use the **`src/`** directory:
- API routes under `src/app/api/*/route.js`
- <Toaster /> lives in src/app/layout.js

## writing style

- for dynamic renders in JSX always prefer the pattern {state && <>} ex. {isAdmin && <div className="admin-options">...}

## Hard rules

- <Toaster /> lives in src/app/layout.js (client). Do not mount it elsewhere.
- Database via Supabase adapter, **server-only env**.
- Do not import Supabase client in any React component.
- If any doc conflicts with this one, follow `DECISIONS.md`.
- **MCP first**: Before selecting any external SDK/library/service, **enumerate available MCP servers/tools** and prefer an MCP integration when it provides the required capability. Only use a non-MCP library if no suitable MCP is available or it lacks required features; document the rationale.
- **Commit discipline**: **Always commit directly to a new branch** in GitHub for each cohesive change. Do not commit to `main`/`trunk`. Create a descriptive branch (see naming below) and push commits incrementally.

### Branch naming & commits

- Branch: `feat/<scope>-<short-slug>` or `chore/<scope>-<short-slug>` or `fix/<scope>-<short-slug>`
  - e.g., `feat/events-api-pagination`, `fix/ui-focus-ring`, `chore/ci-vitest`.
- Commit messages: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, etc.) with a concise imperative subject and a short body when useful.
- After pushing the first commit on a new branch, **open a PR** targeting `main` with a clear title/description.

## Rendering

- `src/app/page.js` is **SSR** for shell only; interactive parts are client-side via a **ClientWrapper** 
- Zustand store hydrates **client-side**. If persistence is enabled, use `localStorage`.

## Coding order in every component

1. `'use client'` (if client component)
2. imports
3. **\*\*\* VARIABLES \*\*\*** (hooks, constants)
4. **\*\*\* FUNCTIONS/HANDLERS \*\*\***
5. return (JSX)

## CSS

- `styles/main.css` contains tokens (`:root`), element resets, and global utility classes.
- Each component/page has a corresponding `.css` file in the `/styles` folder (e.g., `styles/gigs-list.css`, `styles/admin-panel.css`).
- All CSS files **must** live in the `/styles` folder.
- classNames **kebab-case**, prefixed with the component name (e.g., `gigs-list`, `gigs-list-item`, `admin-panel-header`).

## CSS rules (strict)

- Import **global CSS** only in `app/layout.js` via `styles/main.css`.
- `styles/main.css` may `@import` other **global `.css` files**.
- **ALL CSS files must be in the `/styles` folder** - never create `.css` files next to components.
- Components import their CSS from the `/styles` folder (e.g., `import '../styles/gigs-list.css'` or `import '../../styles/admin-panel.css'`).
- **No CSS Modules** (no `.module.css` files). Use plain CSS only.
- Use regular className strings, not styles objects (e.g., `className="gigs-list"` not `className={styles['gigs-list']}`).
- **Do NOT** define styling in JSX ever.
- Buttons / forms should be styled in main.css and all children should inherit the styling. Don`t style them individually.

## Linting & formatting (non-negotiable)

- Run ESLint and Prettier on all changes.
- Follow `.eslintrc.json` and `.prettierrc`.
- If a rule conflicts with formatting, Prettier wins (ESLint extends `prettier`).
- Before submitting diffs, apply `eslint --fix` and `prettier --write`.

## DATABASE & API (HARD RULES)

- Use **Supabase** for auth and Postgres, but keep app code **DB-agnostic**.
- Use the **supabase MCP**.

## DO`s & DONT`s

You are operating on an existing Next.js repo. Hard rules:

**DO NOT** delete, rename, or overwrite any of these (if exist):

- .env\*, .env.local, .env.production, .env.development
- node_modules/, .next/, .vercel/, .git/, .gitignore
- lockfiles: pnpm-lock.yaml, package-lock.json, yarn.lock
- config: next.config._, tsconfig.json, .eslintrc._, postcss.config._, tailwind.config._
- project meta: README.md, LICENSE
- scripts in package.json unless I explicitly approve

Scope of changes:

- If a needed file is missing, propose it in the output; DO NOT auto-delete or mass-rewrite directories.

When producing shell commands:

- Output commands only; do not describe deletions of protected files.
- Assume npm (or my chosen manager). Do not run create-next-app or re-init the project.

## Preferred response style

- Show a short plan, then the changes (file-by-file), then verification steps.
- Include any commands to run (install, build, test) and expected outputs.
- Call out risks and follow-ups explicitly.

## Events domain model

```js
// src/app/stores/useEventsStore.js
{
id: "uuid",
}

```
