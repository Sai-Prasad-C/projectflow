-- pgTAP tests for workspace / membership RLS policies.
-- Run with: npx supabase test db (requires local Supabase stack with Docker)

BEGIN;

SELECT plan(18);

-- ── Fixtures ─────────────────────────────────────────────────────────────────

-- Create test users directly in auth.users (test harness bypasses auth email)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, role)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'owner@test.local',  crypt('pass', gen_salt('bf')), now(), '{}', '{}', 'authenticated'),
  ('00000000-0000-0000-0000-000000000002', 'member@test.local', crypt('pass', gen_salt('bf')), now(), '{}', '{}', 'authenticated'),
  ('00000000-0000-0000-0000-000000000003', 'outsider@test.local', crypt('pass', gen_salt('bf')), now(), '{}', '{}', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, display_name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Owner'),
  ('00000000-0000-0000-0000-000000000002', 'Member'),
  ('00000000-0000-0000-0000-000000000003', 'Outsider')
ON CONFLICT (id) DO NOTHING;

-- Create a workspace as the owner
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

INSERT INTO public.workspaces (id, name, created_by) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Test Workspace', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'owner'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'member')
ON CONFLICT (workspace_id, user_id) DO NOTHING;

INSERT INTO public.projects (id, workspace_id, name, created_by) VALUES
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Test Project', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tasks (id, project_id, title, status, priority, created_by, position) VALUES
  ('cccccccc-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001', 'Test Task', 'todo', 'medium', '00000000-0000-0000-0000-000000000001', 1)
ON CONFLICT (id) DO NOTHING;

-- ── Test: Owner can read workspace ────────────────────────────────────────────

SET LOCAL "request.jwt.claims" TO '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

SELECT results_eq(
  'SELECT count(*)::int FROM public.workspaces WHERE id = ''aaaaaaaa-0000-0000-0000-000000000001''',
  ARRAY[1],
  'Owner can read their workspace'
);

SELECT results_eq(
  'SELECT count(*)::int FROM public.projects WHERE workspace_id = ''aaaaaaaa-0000-0000-0000-000000000001''',
  ARRAY[1],
  'Owner can read projects in workspace'
);

SELECT results_eq(
  'SELECT count(*)::int FROM public.tasks WHERE project_id = ''bbbbbbbb-0000-0000-0000-000000000001''',
  ARRAY[1],
  'Owner can read tasks in project'
);

-- ── Test: Member can read workspace ──────────────────────────────────────────

SET LOCAL "request.jwt.claims" TO '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';

SELECT results_eq(
  'SELECT count(*)::int FROM public.workspaces WHERE id = ''aaaaaaaa-0000-0000-0000-000000000001''',
  ARRAY[1],
  'Member can read workspace they belong to'
);

SELECT results_eq(
  'SELECT count(*)::int FROM public.projects WHERE workspace_id = ''aaaaaaaa-0000-0000-0000-000000000001''',
  ARRAY[1],
  'Member can read projects in their workspace'
);

SELECT results_eq(
  'SELECT count(*)::int FROM public.tasks WHERE project_id = ''bbbbbbbb-0000-0000-0000-000000000001''',
  ARRAY[1],
  'Member can read tasks in their workspace'
);

-- ── Test: Outsider cannot read workspace ─────────────────────────────────────

SET LOCAL "request.jwt.claims" TO '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}';

SELECT results_eq(
  'SELECT count(*)::int FROM public.workspaces WHERE id = ''aaaaaaaa-0000-0000-0000-000000000001''',
  ARRAY[0],
  'Outsider cannot read workspace they are not a member of'
);

SELECT results_eq(
  'SELECT count(*)::int FROM public.projects WHERE workspace_id = ''aaaaaaaa-0000-0000-0000-000000000001''',
  ARRAY[0],
  'Outsider cannot read projects in another workspace'
);

SELECT results_eq(
  'SELECT count(*)::int FROM public.tasks WHERE project_id = ''bbbbbbbb-0000-0000-0000-000000000001''',
  ARRAY[0],
  'Outsider cannot read tasks in another workspace'
);

-- ── Test: Unauthenticated user cannot read anything ──────────────────────────

SET LOCAL ROLE anon;

SELECT results_eq(
  'SELECT count(*)::int FROM public.workspaces',
  ARRAY[0],
  'Anon cannot read any workspaces'
);

SELECT results_eq(
  'SELECT count(*)::int FROM public.projects',
  ARRAY[0],
  'Anon cannot read any projects'
);

SELECT results_eq(
  'SELECT count(*)::int FROM public.tasks',
  ARRAY[0],
  'Anon cannot read any tasks'
);

-- ── Test: Member cannot promote themselves ───────────────────────────────────

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';

SELECT throws_ok(
  'UPDATE public.workspace_members SET role = ''owner'' WHERE user_id = ''00000000-0000-0000-0000-000000000002'' AND workspace_id = ''aaaaaaaa-0000-0000-0000-000000000001''',
  'Member cannot promote themselves to owner (RLS blocks update)'
);

-- ── Test: Member cannot manage membership ────────────────────────────────────

-- Member should not be able to insert a new member row
SELECT throws_ok(
  'INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES (''aaaaaaaa-0000-0000-0000-000000000001'', ''00000000-0000-0000-0000-000000000003'', ''member'')',
  'Member cannot add others to workspace'
);

-- ── Test: Owner/admin CAN manage membership ──────────────────────────────────

SET LOCAL "request.jwt.claims" TO '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

SELECT lives_ok(
  'INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES (''aaaaaaaa-0000-0000-0000-000000000001'', ''00000000-0000-0000-0000-000000000003'', ''member'')',
  'Owner can add new workspace member'
);

-- ── Test: Invitation RLS ─────────────────────────────────────────────────────

-- Outsider cannot view invitations
SET LOCAL "request.jwt.claims" TO '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}';

SELECT results_eq(
  'SELECT count(*)::int FROM public.workspace_invitations WHERE workspace_id = ''aaaaaaaa-0000-0000-0000-000000000001''',
  ARRAY[0],
  'Non-member cannot view workspace invitations'
);

-- Member cannot create invitations
SELECT throws_ok(
  'INSERT INTO public.workspace_invitations (workspace_id, email, role, invited_by, token_hash) VALUES (''aaaaaaaa-0000-0000-0000-000000000001'', ''new@test.local'', ''member'', ''00000000-0000-0000-0000-000000000002'', ''deadbeef'')',
  'Member cannot create invitations directly'
);

-- Owner can create invitations via RPC
SET LOCAL "request.jwt.claims" TO '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

SELECT isnt_empty(
  'SELECT public.create_workspace_invitation(''aaaaaaaa-0000-0000-0000-000000000001'', ''newuser@test.local'', ''member'')',
  'Owner can create invitation via RPC and receives token'
);

-- ── Cleanup ───────────────────────────────────────────────────────────────────

SELECT * FROM finish();

ROLLBACK;
