-- Enable Postgres Change streaming for the two tables that have live
-- collaborative views in the UI. All other tables (workspaces, projects,
-- workspace_members, profiles) are only fetched on mount and do not
-- need real-time updates in this phase.
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;
