# CLAUDE.md

This file is the architecture contract for ProjectFlow. All development must follow these rules.

## Commands

```bash
npm run dev       # Start dev server with HMR
npm run build     # Type-check then bundle for production (tsc -b && vite build)
npm run lint      # Run oxlint
npm run preview   # Preview production build locally
```

No test runner is configured yet.

## Stack

- **React 19** with TypeScript, bundled by **Vite 8**
- **@supabase/supabase-js** — direct client, no backend
- **react-router-dom** — client-side routing
- **vite-plugin-pwa** — service worker and PWA manifest
- **Oxlint** for linting (`.oxlintrc.json`); enforces React hooks rules and only-export-components
- TypeScript `strict: true`; targets ES2023; `verbatimModuleSyntax` enabled — use `import type` for type-only imports

## Directory structure

```
src/
├── main.tsx
├── App.tsx                      # Root router + providers
├── index.css                    # Global tokens + reset
├── lib/
│   ├── supabase.ts              # Supabase client (publishable key only)
│   └── database.types.ts        # Generated: supabase gen types typescript
├── types/
│   └── app.ts                   # Domain aliases over DB types + enums
├── hooks/
│   ├── useAuth.ts
│   ├── useProfile.ts
│   ├── useWorkspaces.ts
│   ├── useProjects.ts
│   └── useTasks.ts              # Includes Realtime subscription
├── context/
│   └── AuthContext.tsx
├── components/
│   ├── ui/                      # Button, Input, Badge, Modal, Avatar, Spinner
│   ├── layout/                  # AppShell, Sidebar, TopBar, MobileNav
│   ├── auth/                    # LoginForm, RegisterForm, ResetPasswordForm
│   ├── workspace/               # WorkspaceSwitcher, MemberList, WorkspaceForm
│   ├── project/                 # ProjectCard, ProjectForm, ProjectDashboard
│   ├── kanban/                  # KanbanBoard, KanbanColumn, TaskCard, TaskForm, TaskDetail, TaskListView, ProjectActivityView
│   └── comment/                 # CommentList, CommentForm
├── pages/
│   ├── LoginPage.tsx
│   ├── RegisterPage.tsx
│   ├── ResetPasswordPage.tsx
│   ├── ProfilePage.tsx
│   ├── WorkspacePage.tsx
│   ├── WorkspaceSettingsPage.tsx
│   ├── ProjectListPage.tsx
│   ├── ProjectDashboardPage.tsx
│   └── KanbanPage.tsx
└── router/
    ├── index.tsx
    └── ProtectedRoute.tsx
```

## Database schema

All tables in the `public` schema with RLS enabled.

```sql
-- profiles extends auth.users (created via trigger on signup)
create table profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text not null,
  avatar_url   text,
  updated_at   timestamptz default now()
);

create table workspaces (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,           -- alphanumeric + hyphens only
  created_by uuid not null references auth.users,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create type workspace_role as enum ('owner', 'admin', 'member');

create table workspace_members (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces on delete cascade,
  user_id      uuid not null references auth.users on delete cascade,
  role         workspace_role not null default 'member',
  joined_at    timestamptz default now(),
  unique (workspace_id, user_id)
);

create table projects (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces on delete cascade,
  name         text not null,
  description  text,
  created_by   uuid not null references auth.users,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create type task_status   as enum ('backlog', 'todo', 'in_progress', 'done');
create type task_priority as enum ('low', 'medium', 'high', 'urgent');

create table tasks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects on delete cascade,
  title       text not null,
  description text,
  status      task_status   not null default 'backlog',
  priority    task_priority not null default 'medium',
  assignee_id uuid references auth.users,
  due_date    date,
  position    float8 not null default 0,    -- ordering within a column
  created_by  uuid not null references auth.users,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references tasks on delete cascade,
  author_id  uuid not null references auth.users on delete cascade,
  body       text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### RLS policy contract

| Table | Read | Insert | Update | Delete |
|---|---|---|---|---|
| `profiles` | Any workspace co-member | Trigger on signup only | Own row | — |
| `workspaces` | Workspace members | Any authenticated user | Owner / admin | Owner |
| `workspace_members` | Workspace members | Owner / admin | Owner / admin | Owner / admin or self |
| `projects` | Workspace members | Workspace members | Workspace members | Owner / admin |
| `tasks` | Workspace members | Workspace members | Workspace members | Creator or owner / admin |
| `comments` | Workspace members | Workspace members | Own comment | Own comment or owner / admin |

Use a helper SQL function `is_workspace_member(workspace_id uuid)` in policies to avoid repeated sub-selects.

## Architecture constraints — non-negotiable

1. **No backend.** No Express, Node, Next.js, or separate API server. Frontend talks directly to Supabase.
2. **Publishable key only in browser.** Env var: `VITE_SUPABASE_PUBLISHABLE_KEY`. Never expose the service-role key in `src/`.
3. **RLS is the authorisation boundary.** UI hiding is cosmetic. Every table must have RLS enabled. Default-deny.
4. **TypeScript `strict: true` must stay on.**
5. **No unnecessary dependencies.** No UI component library. No drag-and-drop library — use status selects and move buttons on the Kanban board.
6. **PWA service worker must not cache Supabase responses.** Use `NetworkOnly` for all `*.supabase.co` requests. Only pre-cache the app shell (JS, CSS, HTML).
7. **XSS prevention.** Task descriptions and comments are plain text. No `dangerouslySetInnerHTML`. No markdown renderer in MVP.
8. **Small, focused components.** Prefer splitting over abstraction. No premature generics.

## Account identity — non-negotiable

- **Supabase Auth user UUID is the stable user identity.**
- **Email is editable account metadata** and must never be the primary key for workspace membership, task assignment, ownership, or authorization.
- **Account email changes are online-only** — never queue in IndexedDB/outbox.
- **Current behavior: immediate server-side email change without confirmation email.** Implemented via the `change-account-email` Edge Function which uses `supabaseAdmin.auth.admin.updateUserById(caller.id, { email, email_confirm: true })`. The admin credential (`SUPABASE_SERVICE_ROLE_KEY`) is auto-injected into the Edge Function runtime and never exposed to the browser.
- If email verification is added later, replace this immediate-change behavior deliberately rather than layering both flows.
- The Edge Function derives the target UUID exclusively from the verified caller JWT — a user cannot supply another user's ID to change their email.
- After success, the frontend calls `supabase.auth.refreshSession()` so `user.email` in AuthContext updates immediately without sign-out.
- Workspace membership, task assignment, and ownership remain tied to UUID; they are unaffected by email changes.
- The `profiles` table has no email column — `user.email` from the Auth session is the sole display source.

## Security rules

- Workspace slugs: validate as `/^[a-z0-9-]+$/` before write; reject path traversal characters.
- Role escalation: RLS policies must verify `workspace_members.role` server-side — a user cannot promote themselves.
- Realtime channels: subscribe only to rows the user is authorised to see; filter by `workspace_id` or `project_id`.
- No Edge Functions with service-role key in MVP.
- Never use service-role credentials in `src/` for account operations; `supabase.auth.updateUser` with the user's own JWT is sufficient.

## Implementation phases

| Phase | Scope |
|---|---|
| 0 — Setup | Install deps, env vars, `strict: true`, Cloudflare Pages `_redirects` |
| 1 — Auth | Login, register, password reset, `AuthContext`, `ProtectedRoute` |
| 2 — Schema | Supabase SQL migrations, RLS policies, generated TS types |
| 3 — Layout | App shell, sidebar, mobile nav, routing skeleton |
| 4 — Workspaces | Create / view / switch workspaces, member list |
| 5 — Projects | Project CRUD, project list, dashboard with task counts |
| 6 — Kanban | Board columns, task CRUD, task detail drawer |
| 7 — Comments + Realtime | Comment thread, Supabase Realtime on tasks and comments |
| 8 — Profile + PWA | Profile page, PWA manifest / icons, mobile audit |
| 9 — Project tabs | List and Activity tabs on the project board page |

## Project board tabs (KanbanPage)

Three tabs on `KanbanPage`: **Board**, **List**, **Activity**. All share the same `tasks` state from `useTasks` — no additional Supabase queries.

### Board
Existing Kanban board. Unchanged.

### List (`TaskListView`)
- Alternative flat view of all project tasks.
- Desktop: 5-column CSS grid — title / status / priority / assignee / due date.
- Mobile: stacked rows — title, then a flex meta row (status chip, priority dot + label, assignee avatar + name, due date).
- Default sort: incomplete tasks first → by due date (nulls last) → by position.
- Clicking a row opens the existing TaskDetail drawer (`setDetailTaskId`). No second editor.
- Empty state uses `EmptyState` component with an "Add task" button.

### Activity (`ProjectActivityView`)
- Lightweight timeline derived purely from existing task fields — no audit table, no DB triggers.
- Each task produces one entry: if `updated_at − created_at > 10 s` → "Task updated" at `updated_at`; otherwise → "Task created" at `created_at`.
- Sorted newest first, grouped into Today / Yesterday / older date labels.
- Wording is conservative — only states "created" or "updated", never "status changed" / "reassigned" / etc.
- Desktop: constrained to `max-width: 680px`. Mobile: full width, titles wrap.
- Empty state: "No activity yet."

### Do not add
- Audit/activity database table or triggers.
- Additional Realtime subscriptions.
- Filtering, grouping, saved views, CSV export, bulk editing, drag-and-drop in List.

## Linting notes

To enable type-aware lint rules, install `oxlint-tsgolint` and add `"options": { "typeAware": true }` to `.oxlintrc.json`.

---

## UI / Design system

### Visual language
- **Warm neutral** backgrounds and surfaces — not pure white or cold grey
- **Coral / orange-red** primary action color (`#f97316` light, adjust for dark)
- Rounded cards, pill-shaped controls and badges
- Soft low-contrast borders, subtle shadows only where useful
- Minimal, friendly, lightweight — not enterprise/corporate
- No glassmorphism, no dense Bootstrap-style UI, no excessive gradients

### Design tokens (CSS custom properties in `src/index.css`)
All theme values must use tokens — no raw hex values scattered in component CSS.
Required tokens: `--color-bg`, `--color-surface`, `--color-surface-2`, `--color-border`,
`--color-text`, `--color-text-2`, `--color-text-3`, `--color-primary`, `--color-primary-hover`,
`--color-primary-subtle`, `--color-danger`, `--color-success`, `--color-warning`,
`--radius-sm/md/lg/xl/pill`, `--space-1` through `--space-12`, `--shadow-sm/md/lg`,
`--transition`, `--sidebar-width`, `--bottomnav-height`.

### Theming
Three modes: **Light / Dark / System** (default).  
Apply via `data-theme="light|dark"` on `<html>`. System follows `prefers-color-scheme`.  
Persist explicit user choice to `localStorage` key `pf-theme`.

### Breakpoints
- Mobile: `< 768px`
- Tablet: `768px – 1199px`
- Desktop: `≥ 1200px`

### Navigation
- **Desktop (≥ 768px):** Persistent left sidebar (240px). Content offset accordingly.
- **Mobile (< 768px):** Floating bottom navigation bar (pill shape, ~64px), coral circular FAB in center for primary create action. No sidebar.
- **Tablet:** Compact icon-rail sidebar, or mobile bottom-nav — choose what's least cramped.
- Bottom nav must sit above `env(safe-area-inset-bottom)`.
- Page content must have enough bottom padding to clear the fixed bottom nav.

### Responsive layout
- This is NOT a desktop UI shrunk for mobile, nor a mobile UI stretched for desktop.
- Kanban board: on mobile, columns scroll horizontally with `scroll-snap-type: x mandatory`, each column `min(280px, 85vw)` wide. On desktop, columns sit side-by-side.
- Forms (auth, settings, profile): max-width ~480px, centered.
- Project/task lists: responsive grid — 3 cols desktop, 2 cols tablet, 1 col mobile.
- Content areas (boards, lists) use available width; do not center in a narrow column.

### Secondary workflows (dialogs / sheets)
- **Mobile (< 768px):** Use bottom sheets — full width, rounded top corners, drag handle, dimmed backdrop.
- **Desktop (≥ 768px):** Use centered modals or right-side panels (480px) as appropriate.
- Never show a giant full-width mobile sheet on a desktop screen.
- All sheets/modals: `role="dialog"`, `aria-modal="true"`, `Escape` closes, focus trap, restore focus on close.

### Icons
Use **`lucide-react`** consistently. Do not use random emoji as primary UI icons.

### Touch and accessibility
- Minimum tap target: 44 × 44px on mobile.
- Global focus-visible: `2px solid var(--color-primary)`, `outline-offset: 2px`.
- `*:focus:not(:focus-visible) { outline: none }` — no outline on mouse click.
- Never encode task state by color alone — always include a text label.
- Respect `prefers-reduced-motion` — skip or minimize transitions when set.
- Use `100dvh` (not `100vh`) for full-height containers — handles mobile browser chrome.
- Account for `env(safe-area-inset-*)` on fixed bottom elements.
- Semantic HTML, accessible labels, `aria` attributes on interactive regions.

### Testing viewports
Verify UI at: **360px, 390px, 430px, 768px, 1024px, 1280px, 1440px, 1920px**.  
Check: no horizontal overflow, bottom nav not clipped, content not hidden behind nav,
dialogs usable, no excessive whitespace, Kanban usable, text not truncated, tap targets adequate.

### Do not
- Copy brand-specific artwork, illustrations, or proprietary assets from any visual reference.
- Use indigo as the primary color (was pre-redesign; coral is the new primary).
- Add heavyweight component libraries (no MUI, Chakra, Ant Design, etc.).

---

## Database development (Supabase CLI)

### Rules — non-negotiable
- **Schema changes ONLY through migration files** in `supabase/migrations/`. Never modify production schema directly via the Dashboard SQL editor.
- **Supabase CLI is authoritative** for local and remote schema management.
- **Regenerate DB types** after every migration: `supabase gen types typescript --linked > src/lib/database.types.ts`
- **RLS required** on every table. Default-deny. No "disable RLS to debug" shortcuts.
- **pgTAP tests** required for any RLS policy changes — add to `supabase/tests/`.
- **NEVER run** `supabase db reset --linked` — destroys production data.
- **Never expose** service-role key, database password, or JWT secret in `src/` or `VITE_*` variables.
- **Dry-run before push**: `supabase db push --dry-run` — review output, stop if destructive.

### Workflow
```bash
supabase migration new <name>   # create migration file
# edit the .sql file
supabase db push --dry-run       # verify
supabase db push                 # deploy to linked remote
supabase gen types typescript --linked > src/lib/database.types.ts
```

### Edge Functions
- Functions live in `supabase/functions/<name>/index.ts`
- Deploy: `supabase functions deploy <name>`
- Secrets (never commit): `supabase secrets set KEY=value`
- Local dev (requires Docker): `supabase functions serve`
- Server secrets MUST NOT use `VITE_` prefix — they are not browser env vars.
- Edge Functions must verify JWT (`Deno.serve` default) — never use `--no-verify-jwt` unless the endpoint is intentionally public and that decision has been reviewed.

---

## Offline architecture

### IndexedDB (`src/lib/idb.ts`)
- Stores: `tasks`, `comments`, `outbox`, `conflicts`, `sync_meta`
- `getDB()` lazily opens the DB; `clearUserData()` called on sign-out to isolate private data.
- IDB is a UX cache — Supabase/RLS remains authoritative when online.

### Sync manager (`src/lib/sync.ts`)
- `syncManager.sync()` processes the outbox: create/update/delete against Supabase.
- Retries with bounded exponential backoff (30s → 60s → 120s → … → 600s + jitter).
- Does NOT retry 401/403/RLS-permanent failures — marks them failed and surfaces in UI.
- Three-way merge on update conflicts: base + local + remote comparison.
  - Non-overlapping field changes merge automatically.
  - Same-field conflicts (both changed differently) are stored in the `conflicts` store and surfaced via `SyncIndicator`.

### Offline writes (outbox pattern)
1. Validate locally
2. Write to IDB optimistically
3. Create an `OutboxEntry` (with `baseSnapshot` and `baseVersion`)
4. Update React state immediately
5. Call `syncManager.sync()` — processes if online, queues if offline

### Security constraint
- Login, registration, password reset, email changes, workspace membership admin, invitation creation/acceptance — **remain online-only**.
- Do NOT pretend security-sensitive remote operations succeeded while offline.
- Email change: show an error if offline. Do NOT queue in outbox.

### Hooks pattern
Hooks read IDB first (fast), then hydrate from network. Realtime events also write through to IDB.

---

## Invitation system

### Database
- Table: `workspace_invitations` — stores token_hash (SHA-256 hex), email (normalised), role, expiry, accepted_at, revoked_at.
- Only token hash is stored — plaintext token travels only in the invite URL.

### RPCs (SECURITY DEFINER)
- `create_workspace_invitation(p_workspace_id, p_email, p_role)` — validates caller is owner/admin, generates 32-byte token, stores hash, returns plaintext token.
- `accept_workspace_invitation(p_token)` — hashes token, validates expiry/revoke/email match, atomically adds membership, marks accepted. Idempotent.

### Edge Function
- `send-workspace-invite`: JWT-verified POST; calls the RPC to create invite; returns `{ inviteUrl, emailSent: false, sharingMode: "link" }`. No email provider dependency.
- Only required secret: `APP_URL` (production: `https://projectflow-41w.pages.dev`). Set via `supabase secrets set APP_URL=https://projectflow-41w.pages.dev`.
- Token is NOT returned in the Edge Function response — it exists only in the invite URL.
- Deploy without Docker: `supabase functions deploy send-workspace-invite`.

### Frontend flow
- Owner/admin sees invite form in MemberList sheet.
- On success, invite link is shown for copy/share (Web Share API when available).
- `/invite/:token` → `InvitePage` handles all states: loading, success, expired, revoked, wrong-account, invalid.
- If unauthenticated on `/invite/:token`: token stored in `sessionStorage`, redirected to login, acceptance resumes after auth.
