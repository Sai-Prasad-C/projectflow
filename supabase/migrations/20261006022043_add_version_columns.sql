-- Add monotonic version columns to collaboratively-edited entities.
-- Used by the offline outbox for optimistic concurrency checks:
--   UPDATE tasks SET ... WHERE id = $1 AND version = $base_version
-- The trigger increments version on every UPDATE so stale clients detect conflicts.

-- ── tasks ────────────────────────────────────────────────────────────

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION public.tasks_bump_version()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_version_trigger ON public.tasks;
CREATE TRIGGER tasks_version_trigger
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.tasks_bump_version();

-- ── task_comments ─────────────────────────────────────────────────────

ALTER TABLE public.task_comments
  ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION public.task_comments_bump_version()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS task_comments_version_trigger ON public.task_comments;
CREATE TRIGGER task_comments_version_trigger
  BEFORE UPDATE ON public.task_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.task_comments_bump_version();
