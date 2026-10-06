-- Make accept_workspace_invitation idempotent for the same authenticated user.
--
-- Previously the function raised 'Invitation already accepted' whenever
-- accepted_at was set, even if the SAME user was re-submitting their own
-- accepted token (e.g. clicking the link again after already joining).
--
-- New behaviour:
--   accepted_by = auth.uid()  →  return workspace_id (idempotent, safe)
--   accepted_by ≠ auth.uid()  →  raise 'Invitation already accepted' (unchanged)
--
-- Security notes:
--   • workspace_id is only returned to the user who already accepted this
--     exact invitation (verified via accepted_by = auth.uid()).
--   • A different authenticated user still sees the original error and receives
--     no workspace information.
--   • All other validations (revoked, expiry, email match) are unchanged for
--     new acceptances.

CREATE OR REPLACE FUNCTION public.accept_workspace_invitation(p_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_inv        public.workspace_invitations%ROWTYPE;
  v_token_hash TEXT;
  v_user_email TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

  SELECT * INTO v_inv
  FROM public.workspace_invitations
  WHERE token_hash = v_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid invitation token';
  END IF;

  IF v_inv.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invitation has been revoked';
  END IF;

  IF v_inv.accepted_at IS NOT NULL THEN
    -- Same authenticated user re-submitting their own accepted invitation.
    -- Safe to return the workspace_id — they already belong to it.
    IF v_inv.accepted_by = auth.uid() THEN
      RETURN v_inv.workspace_id;
    END IF;
    RAISE EXCEPTION 'Invitation already accepted';
  END IF;

  IF v_inv.expires_at < now() THEN
    RAISE EXCEPTION 'Invitation has expired';
  END IF;

  -- Verify email matches the authenticated user.
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  IF lower(trim(v_user_email)) != v_inv.email THEN
    RAISE EXCEPTION 'This invitation was sent to a different email address';
  END IF;

  -- Add to workspace. ON CONFLICT DO NOTHING makes this safe for users who
  -- were already added via a different path (e.g. directly by an admin).
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_inv.workspace_id, auth.uid(), v_inv.role)
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  -- Mark the invitation as accepted.
  UPDATE public.workspace_invitations
  SET accepted_at = now(), accepted_by = auth.uid()
  WHERE id = v_inv.id;

  RETURN v_inv.workspace_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_workspace_invitation(TEXT)
  TO authenticated;
