-- RPC function that creates a workspace owned by the calling user.
--
-- Using SECURITY DEFINER so that auth.uid() is resolved from the caller's
-- JWT entirely on the server side, eliminating any client-side user-id
-- mismatch that would cause the RLS WITH CHECK to reject the insert.
--
-- The handle_new_workspace AFTER INSERT trigger still fires normally and
-- inserts the first workspace_members row (it is also SECURITY DEFINER /
-- postgres role with bypassrls, so it is unaffected).
CREATE OR REPLACE FUNCTION public.create_workspace(p_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Workspace name must not be empty';
  END IF;

  INSERT INTO public.workspaces (name, created_by)
  VALUES (trim(p_name), auth.uid())
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Only authenticated users may call this function
GRANT EXECUTE ON FUNCTION public.create_workspace(text) TO authenticated;
