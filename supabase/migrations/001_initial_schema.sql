-- ============================================================
-- ProjectFlow – Initial Schema
-- ============================================================
-- IMPORTANT: Review this file carefully before running it.
--
-- How to apply:
--   Option A – Supabase CLI:
--     supabase db push               (applies to linked remote project)
--     supabase db reset              (applies locally with the CLI stack)
--   Option B – Supabase Dashboard:
--     Open SQL Editor → paste contents → Run
--
-- This migration is intentionally idempotent where safe
-- (CREATE TYPE … IF NOT EXISTS, CREATE OR REPLACE FUNCTION).
-- Tables are NOT created with IF NOT EXISTS because a partial
-- previous run should surface as an error, not silently skip.
--
-- Prerequisites: Supabase Auth must be enabled (auth.users exists).
-- ============================================================


-- ============================================================
-- 1. ENUMS
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.workspace_role AS ENUM ('owner', 'admin', 'member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.task_status AS ENUM ('backlog', 'todo', 'in_progress', 'done');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- 2. TABLES
-- ============================================================

-- Extends auth.users. Cascade-deleted when the auth user is removed.
CREATE TABLE public.profiles (
  id           UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT        NOT NULL
                           CHECK (char_length(display_name) BETWEEN 1 AND 100),
  avatar_url   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.profiles IS
  'One row per auth user. Created automatically via trigger.';


CREATE TABLE public.workspaces (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  created_by UUID        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.workspaces IS
  'Top-level organisational unit. Creator is automatically added as owner.';


CREATE TABLE public.workspace_members (
  -- Surrogate key included for convenience with Supabase client .from().update()
  id           UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID                  NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      UUID                  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         public.workspace_role NOT NULL DEFAULT 'member',
  joined_at    TIMESTAMPTZ           NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);
COMMENT ON TABLE public.workspace_members IS
  'Membership and role within a workspace.';


CREATE TABLE public.projects (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  description  TEXT,
  created_by   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at  TIMESTAMPTZ            -- NULL = active; NOT NULL = archived
);
COMMENT ON TABLE public.projects IS
  'Projects belong to a workspace. archived_at is set instead of deletion.';


CREATE TABLE public.tasks (
  id          UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID                  NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title       TEXT                  NOT NULL CHECK (char_length(title) BETWEEN 1 AND 500),
  description TEXT,
  status      public.task_status    NOT NULL DEFAULT 'backlog',
  priority    public.task_priority  NOT NULL DEFAULT 'medium',
  assignee_id UUID                  REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date    DATE,
  -- Fractional index for ordering within a Kanban column (project_id, status).
  -- Insert between two items by averaging their positions.
  -- Renormalise periodically if gaps shrink to < 2^-32.
  position    FLOAT8                NOT NULL DEFAULT 0,
  created_by  UUID                  NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ           NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ           NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.tasks IS
  'Tasks within a project, displayed on the Kanban board.';


CREATE TABLE public.task_comments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID        NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body       TEXT        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 10000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.task_comments IS
  'Comments on individual tasks.';


-- ============================================================
-- 3. INDEXES
-- ============================================================

-- workspace_members – used heavily by every RLS helper function
CREATE INDEX idx_workspace_members_user_id
  ON public.workspace_members(user_id);

CREATE INDEX idx_workspace_members_workspace_id
  ON public.workspace_members(workspace_id);

-- Partial index on role for admin/owner lookups
CREATE INDEX idx_workspace_members_admins
  ON public.workspace_members(workspace_id, user_id)
  WHERE role IN ('owner', 'admin');

-- projects
CREATE INDEX idx_projects_workspace_id
  ON public.projects(workspace_id);

-- tasks – Kanban board queries filter by (project_id, status) and order by position
CREATE INDEX idx_tasks_project_id
  ON public.tasks(project_id);

CREATE INDEX idx_tasks_project_status_position
  ON public.tasks(project_id, status, position);

-- Partial index – tasks with an assignee (for "my tasks" view)
CREATE INDEX idx_tasks_assignee_id
  ON public.tasks(assignee_id)
  WHERE assignee_id IS NOT NULL;

-- task_comments
CREATE INDEX idx_task_comments_task_id
  ON public.task_comments(task_id);

CREATE INDEX idx_task_comments_author_id
  ON public.task_comments(author_id);


-- ============================================================
-- 4. SECURITY-DEFINER HELPER FUNCTIONS
-- ============================================================
-- These functions run as the database owner and therefore bypass
-- RLS on the tables they query.  This is intentional: it breaks
-- the recursive RLS chain that would otherwise occur when a
-- policy on workspace_members references workspace_members.
--
-- All functions explicitly set search_path = public to prevent
-- search_path injection attacks.
-- ============================================================

-- Returns the set of workspace IDs the current user belongs to.
-- Used by other policies and functions; caches well within a transaction.
CREATE OR REPLACE FUNCTION public.get_user_workspace_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT workspace_id
  FROM   workspace_members
  WHERE  user_id = auth.uid()
$$;


-- TRUE if auth.uid() has any role in the given workspace.
CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE  workspace_id = p_workspace_id
      AND  user_id      = auth.uid()
  )
$$;


-- TRUE if auth.uid() holds owner or admin role in the given workspace.
CREATE OR REPLACE FUNCTION public.is_workspace_admin(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE  workspace_id = p_workspace_id
      AND  user_id      = auth.uid()
      AND  role IN ('owner', 'admin')
  )
$$;


-- TRUE if auth.uid() is the sole-owner role in the given workspace.
CREATE OR REPLACE FUNCTION public.is_workspace_owner(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE  workspace_id = p_workspace_id
      AND  user_id      = auth.uid()
      AND  role         = 'owner'
  )
$$;


-- TRUE if auth.uid() is a member of the workspace that owns p_project_id.
CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   projects        p
    JOIN   workspace_members wm ON wm.workspace_id = p.workspace_id
    WHERE  p.id        = p_project_id
      AND  wm.user_id  = auth.uid()
  )
$$;


-- TRUE if auth.uid() has owner or admin role over p_project_id's workspace.
CREATE OR REPLACE FUNCTION public.is_project_admin(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   projects        p
    JOIN   workspace_members wm ON wm.workspace_id = p.workspace_id
    WHERE  p.id       = p_project_id
      AND  wm.user_id = auth.uid()
      AND  wm.role IN ('owner', 'admin')
  )
$$;


-- TRUE if auth.uid() is a member of the workspace for p_task_id's project.
CREATE OR REPLACE FUNCTION public.can_access_task(p_task_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   tasks           t
    JOIN   projects        p  ON p.id  = t.project_id
    JOIN   workspace_members wm ON wm.workspace_id = p.workspace_id
    WHERE  t.id        = p_task_id
      AND  wm.user_id  = auth.uid()
  )
$$;


-- TRUE if auth.uid() has owner or admin over p_task_id's workspace.
CREATE OR REPLACE FUNCTION public.is_task_admin(p_task_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   tasks           t
    JOIN   projects        p  ON p.id  = t.project_id
    JOIN   workspace_members wm ON wm.workspace_id = p.workspace_id
    WHERE  t.id       = p_task_id
      AND  wm.user_id = auth.uid()
      AND  wm.role IN ('owner', 'admin')
  )
$$;


-- ============================================================
-- 5. TRIGGER FUNCTIONS
-- ============================================================

-- Sets updated_at to now() on every UPDATE.
-- Not SECURITY DEFINER – only touches the modified row.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- Creates a profile row when a new auth user is created.
-- SECURITY DEFINER needed because profiles has no INSERT policy
-- (the trigger is the only authorised insert path).
-- Derives display_name from user metadata → email prefix → 'User' fallback.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'display_name'), ''),
      NULLIF(split_part(NEW.email, '@', 1), ''),
      'User'
    )
  );
  RETURN NEW;
END;
$$;


-- Inserts the workspace creator as owner in workspace_members.
-- SECURITY DEFINER needed because at the moment of workspace creation
-- the creator has no membership row yet, so is_workspace_admin() = FALSE.
CREATE OR REPLACE FUNCTION public.handle_new_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner');
  RETURN NEW;
END;
$$;


-- ============================================================
-- 6. TRIGGERS
-- ============================================================

-- updated_at maintenance
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_task_comments_updated_at
  BEFORE UPDATE ON public.task_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Profile auto-creation (fires on auth.users INSERT)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Owner membership auto-creation (fires on workspaces INSERT)
CREATE TRIGGER on_workspace_created
  AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_workspace();


-- ============================================================
-- 7. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments     ENABLE ROW LEVEL SECURITY;

-- By default Supabase service-role bypasses RLS.
-- The publishable (anon/authenticated) key does NOT bypass RLS.
-- No FORCE ROW LEVEL SECURITY is required because we never connect
-- as the table owner from the browser.


-- ---- profiles -----------------------------------------------

-- Own profile always visible; other profiles only if sharing a workspace.
-- The inner query on workspace_members is covered by its own SELECT policy
-- (which uses get_user_workspace_ids, a SECURITY DEFINER function) so
-- there is no recursive RLS evaluation.
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT
  USING (
    id = auth.uid()
    OR id IN (
      SELECT user_id FROM workspace_members
      WHERE  workspace_id IN (SELECT public.get_user_workspace_ids())
    )
  );

-- Users may only update their own profile row.
-- Column-level: the application must not expose id/created_at for edit;
-- see security notes below.
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE
  USING     (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- No INSERT policy: handle_new_user trigger (SECURITY DEFINER) is the
-- only authorised path.  Default-deny INSERT is intentional.

-- No DELETE policy: auth.users ON DELETE CASCADE handles removal.


-- ---- workspaces ---------------------------------------------

CREATE POLICY "workspaces_select" ON public.workspaces
  FOR SELECT
  USING (public.is_workspace_member(id));

-- Any authenticated user may create a workspace; created_by must be themselves.
CREATE POLICY "workspaces_insert" ON public.workspaces
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- Owner or admin may update workspace metadata.
CREATE POLICY "workspaces_update" ON public.workspaces
  FOR UPDATE
  USING     (public.is_workspace_admin(id))
  WITH CHECK (public.is_workspace_admin(id));

-- Only the owner may delete the workspace (cascades to all child data).
CREATE POLICY "workspaces_delete" ON public.workspaces
  FOR DELETE
  USING (public.is_workspace_owner(id));


-- ---- workspace_members --------------------------------------

-- Members can see all members in any workspace they belong to.
CREATE POLICY "workspace_members_select" ON public.workspace_members
  FOR SELECT
  USING (workspace_id IN (SELECT public.get_user_workspace_ids()));

-- Owner/admin can add new members.
-- Privilege escalation prevention: only an existing owner may assign the
-- 'owner' role; admins can only assign 'admin' or 'member'.
CREATE POLICY "workspace_members_insert" ON public.workspace_members
  FOR INSERT
  WITH CHECK (
    public.is_workspace_admin(workspace_id)
    AND (
      role <> 'owner'::public.workspace_role
      OR public.is_workspace_owner(workspace_id)
    )
  );

-- Owner/admin can change roles; same escalation rules apply.
CREATE POLICY "workspace_members_update" ON public.workspace_members
  FOR UPDATE
  USING     (public.is_workspace_admin(workspace_id))
  WITH CHECK (
    public.is_workspace_admin(workspace_id)
    AND (
      role <> 'owner'::public.workspace_role
      OR public.is_workspace_owner(workspace_id)
    )
  );

-- Any member may leave (delete own row); owner/admin may remove others.
-- Gap: removing the last owner is currently permitted at the DB layer;
-- enforce the invariant in application code (see security notes).
CREATE POLICY "workspace_members_delete" ON public.workspace_members
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR public.is_workspace_admin(workspace_id)
  );


-- ---- projects -----------------------------------------------

CREATE POLICY "projects_select" ON public.projects
  FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "projects_insert" ON public.projects
  FOR INSERT
  WITH CHECK (
    public.is_workspace_member(workspace_id)
    AND created_by = auth.uid()
  );

-- Any workspace member may update project metadata.
CREATE POLICY "projects_update" ON public.projects
  FOR UPDATE
  USING     (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

-- Only owner/admin may delete a project.
CREATE POLICY "projects_delete" ON public.projects
  FOR DELETE
  USING (public.is_workspace_admin(workspace_id));


-- ---- tasks --------------------------------------------------

CREATE POLICY "tasks_select" ON public.tasks
  FOR SELECT
  USING (public.is_project_member(project_id));

CREATE POLICY "tasks_insert" ON public.tasks
  FOR INSERT
  WITH CHECK (
    public.is_project_member(project_id)
    AND created_by = auth.uid()
  );

-- Any workspace member may update tasks (status changes, assignments, etc.).
CREATE POLICY "tasks_update" ON public.tasks
  FOR UPDATE
  USING     (public.is_project_member(project_id))
  WITH CHECK (public.is_project_member(project_id));

-- Task creator or workspace owner/admin may delete a task.
CREATE POLICY "tasks_delete" ON public.tasks
  FOR DELETE
  USING (
    created_by = auth.uid()
    OR public.is_project_admin(project_id)
  );


-- ---- task_comments ------------------------------------------

CREATE POLICY "task_comments_select" ON public.task_comments
  FOR SELECT
  USING (public.can_access_task(task_id));

CREATE POLICY "task_comments_insert" ON public.task_comments
  FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND public.can_access_task(task_id)
  );

-- Authors may only edit their own comment body.
CREATE POLICY "task_comments_update" ON public.task_comments
  FOR UPDATE
  USING     (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- Authors or workspace owner/admin may delete a comment.
CREATE POLICY "task_comments_delete" ON public.task_comments
  FOR DELETE
  USING (
    author_id = auth.uid()
    OR public.is_task_admin(task_id)
  );
