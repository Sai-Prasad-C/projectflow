# ProjectFlow

Lightweight collaborative project management — built with React 19, TypeScript, and Supabase.

**Production:** https://projectflow-41w.pages.dev

---

## Features

- **Multi-workspace** — create multiple workspaces, switch between them from the sidebar (desktop) or top bar (mobile)
- **Projects & Kanban** — project list, Kanban board with Backlog / To Do / In Progress / Done columns
- **Task management** — title, description, status, priority, assignee, due date, ordering
- **Board · List · Activity tabs** — switch between Kanban board, flat list view, and activity timeline
- **Comments** — threaded comments per task
- **Realtime** — task and comment updates via Supabase Realtime
- **Workspace invitations** — link-based invite flow (no email provider required); secure token, hashed in DB, single-use
- **Profile** — display name, immediate email change (no confirmation email)
- **Offline-capable PWA** — IndexedDB cache, outbox for task mutations, conflict resolution, installable on mobile/desktop
- **Themes** — Light / Dark / System

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript (`strict: true`), Vite 8 |
| Routing | react-router-dom |
| Backend | Supabase (Postgres + Auth + Realtime + Edge Functions) |
| Offline | IndexedDB via `idb`, outbox/sync manager |
| PWA | vite-plugin-pwa, Workbox |
| Linting | Oxlint |
| Deploy | Cloudflare Pages |

---

## Local development

### Prerequisites

- Node.js 20+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for schema/migrations)

### Setup

```bash
# Install dependencies
npm install

# Copy env template and fill in your Supabase project values
cp .env.example .env.local
# VITE_SUPABASE_URL=https://<project>.supabase.co
# VITE_SUPABASE_PUBLISHABLE_KEY=<anon key>

# Start dev server
npm run dev
```

### Available scripts

```bash
npm run dev       # Start dev server with HMR
npm run build     # Type-check then bundle for production
npm run lint      # Run Oxlint
npm run preview   # Preview production build locally
```

---

## Database

Schema is managed via Supabase CLI migrations in `supabase/migrations/`.

```bash
# Create a new migration
supabase migration new <name>

# Preview what will be applied (always run first)
supabase db push --dry-run

# Apply to linked remote project
supabase db push

# Regenerate TypeScript types after schema changes
supabase gen types typescript --linked > src/lib/database.types.ts
```

> **Never** run `supabase db reset --linked` — it destroys production data.

---

## Edge Functions

Located in `supabase/functions/`. Deployed without Docker:

```bash
supabase functions deploy <function-name>
```

| Function | Purpose |
|---|---|
| `send-workspace-invite` | Creates invitation token, returns invite URL |
| `change-account-email` | Immediate email change via admin API (no confirmation) |

Required secrets (set once per project):

```bash
supabase secrets set APP_URL=https://projectflow-41w.pages.dev
```

---

## Architecture notes

- **No backend server** — frontend talks directly to Supabase; RLS is the authorization boundary
- **Publishable key only in browser** — service-role key lives exclusively in Edge Function runtime
- **UUID is the user identity** — email is editable metadata, never a foreign key
- **Offline writes** — tasks/comments use an outbox pattern with three-way merge conflict resolution
- **Security-sensitive ops are online-only** — email changes, workspace membership, invitations never queue offline

---

## Deployment

Hosted on Cloudflare Pages. The `public/_redirects` file routes all paths to `index.html` for SPA deep-link support.

Environment variables required in Cloudflare Pages settings:

```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```
