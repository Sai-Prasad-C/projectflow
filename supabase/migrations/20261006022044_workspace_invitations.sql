-- Workspace invitation system.
-- Tokens are generated as 32-byte random values by the RPC function;
-- only the SHA-256 hex hash is stored here — the plaintext token travels
-- only in the invite link and is never persisted in the DB.

CREATE TABLE public.workspace_invitations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email           TEXT        NOT NULL CHECK (char_length(email) BETWEEN 3 AND 255),
  role            public.workspace_role NOT NULL DEFAULT 'member',
  invited_by      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash      TEXT        NOT NULL UNIQUE,   -- SHA-256 hex of the plaintext token
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  accepted_at     TIMESTAMPTZ,
  accepted_by     UUID        REFERENCES auth.users(id),
  revoked_at      TIMESTAMPTZ,
  -- Prevent duplicate pending invites to the same address in the same workspace
  CONSTRAINT no_duplicate_pending UNIQUE NULLS NOT DISTINCT (workspace_id, email, accepted_at, revoked_at)
);

COMMENT ON TABLE public.workspace_invitations IS
  'One row per invitation. Token hash stored; plaintext token travels only in the invite URL.';

-- Index for token lookup during acceptance (hashed, so direct equality)
CREATE INDEX idx_invitations_token_hash ON public.workspace_invitations (token_hash);
-- Index for listing a workspace's invitations
CREATE INDEX idx_invitations_workspace_id ON public.workspace_invitations (workspace_id);

-- ── RLS ──────────────────────────────────────────────────────────────

ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;

-- Members can view invitations for workspaces they belong to
CREATE POLICY "members can view workspace invitations"
  ON public.workspace_invitations FOR SELECT
  USING (public.is_workspace_member(workspace_id));

-- Owner/admin can insert invitations
CREATE POLICY "owner_admin can create invitations"
  ON public.workspace_invitations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_invitations.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  );

-- Owner/admin can update invitations (revoke, resend)
CREATE POLICY "owner_admin can update invitations"
  ON public.workspace_invitations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = workspace_invitations.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  );

-- ── Secure invitation creation RPC ───────────────────────────────────
-- Returns the plaintext token so the caller can build the invite link.
-- SECURITY DEFINER allows it to read pgcrypto-generated token and store
-- the hash atomically without exposing service_role to the client.

CREATE OR REPLACE FUNCTION public.create_workspace_invitation(
  p_workspace_id UUID,
  p_email        TEXT,
  p_role         public.workspace_role DEFAULT 'member'
)
RETURNS TEXT          -- returns plaintext token
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_role public.workspace_role;
  v_token       TEXT;
  v_token_hash  TEXT;
  v_norm_email  TEXT;
BEGIN
  -- 1. Must be authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Caller must be owner or admin of this workspace
  SELECT role INTO v_caller_role
  FROM public.workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = auth.uid();

  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'Not a member of this workspace';
  END IF;
  IF v_caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only owners and admins can invite members';
  END IF;

  -- 3. Admin cannot invite owner-level members
  IF p_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot invite with owner role';
  END IF;
  IF v_caller_role = 'admin' AND p_role = 'admin' AND
     NOT EXISTS (
       SELECT 1 FROM public.workspace_members
       WHERE workspace_id = p_workspace_id AND user_id = auth.uid() AND role = 'owner'
     ) THEN
    -- admins can invite admins only if they are owners; otherwise member only
    RAISE EXCEPTION 'Admins can only invite members';
  END IF;

  -- 4. Normalize email
  v_norm_email := lower(trim(p_email));
  IF v_norm_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Invalid email address';
  END IF;

  -- 5. Revoke any previous pending invitation for this address
  UPDATE public.workspace_invitations
  SET revoked_at = now()
  WHERE workspace_id = p_workspace_id
    AND email = v_norm_email
    AND accepted_at IS NULL
    AND revoked_at IS NULL
    AND expires_at > now();

  -- 6. Generate 32-byte random token → hex → SHA-256 hash
  v_token      := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(digest(v_token, 'sha256'), 'hex');

  -- 7. Insert invitation
  INSERT INTO public.workspace_invitations
    (workspace_id, email, role, invited_by, token_hash)
  VALUES
    (p_workspace_id, v_norm_email, p_role, auth.uid(), v_token_hash);

  RETURN v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_workspace_invitation(UUID, TEXT, public.workspace_role)
  TO authenticated;

-- ── Invitation acceptance RPC ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.accept_workspace_invitation(p_token TEXT)
RETURNS UUID  -- returns workspace_id on success
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
    RAISE EXCEPTION 'Invitation already accepted';
  END IF;
  IF v_inv.expires_at < now() THEN
    RAISE EXCEPTION 'Invitation has expired';
  END IF;

  -- Verify email matches authenticated user
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  IF lower(trim(v_user_email)) != v_inv.email THEN
    RAISE EXCEPTION 'This invitation was sent to a different email address';
  END IF;

  -- Add to workspace (upsert so repeated calls are idempotent)
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (v_inv.workspace_id, auth.uid(), v_inv.role)
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  -- Mark accepted
  UPDATE public.workspace_invitations
  SET accepted_at = now(), accepted_by = auth.uid()
  WHERE id = v_inv.id;

  RETURN v_inv.workspace_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_workspace_invitation(TEXT)
  TO authenticated;

-- Allow anonymous token lookup ONLY through the accept RPC (which validates everything).
-- Unauthenticated users cannot query the table directly.
