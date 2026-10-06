// Edge Function: send-workspace-invite
// Creates a workspace invitation and returns a shareable invite URL.
//
// POST /functions/v1/send-workspace-invite
// Authorization: Bearer <user-jwt>
// Body: { workspace_id, email, role? }
//
// Returns: { inviteUrl, emailSent: false, sharingMode: "link" }
//
// Requires one environment variable:
//   APP_URL — the deployed app base URL (e.g. https://flow-41w.pages.dev)

import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── 1. Authenticate caller via JWT ────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonError('Missing or invalid Authorization header', 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Use the user's JWT — do NOT bypass RLS with service role
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) {
      return jsonError('Not authenticated', 401)
    }

    // ── 2. Parse and validate request body ────────────────────────────────────
    const body = await req.json().catch(() => null)
    if (!body) return jsonError('Invalid JSON body', 400)

    const { workspace_id, email, role = 'member' } = body as {
      workspace_id?: string
      email?: string
      role?: string
    }

    if (!workspace_id || typeof workspace_id !== 'string') {
      return jsonError('workspace_id is required', 400)
    }
    if (!email || typeof email !== 'string') {
      return jsonError('email is required', 400)
    }
    if (!['member', 'admin'].includes(role)) {
      return jsonError('role must be member or admin', 400)
    }

    // ── 3. Create invitation via the SECURITY DEFINER RPC ────────────────────
    // Authorization is enforced server-side: caller must be owner/admin.
    // The RPC stores a token hash and returns the plaintext token once.
    const { data: token, error: rpcErr } = await userClient.rpc(
      'create_workspace_invitation',
      { p_workspace_id: workspace_id, p_email: email, p_role: role },
    )

    if (rpcErr) {
      return jsonError(rpcErr.message, 403)
    }

    if (!token) {
      return jsonError('Failed to generate invitation token', 500)
    }

    // ── 4. Build invite URL ───────────────────────────────────────────────────
    // Normalize APP_URL: remove trailing slash.
    const rawAppUrl = Deno.env.get('APP_URL') ?? supabaseUrl
    const appUrl = rawAppUrl.replace(/\/+$/, '')
    const inviteUrl = `${appUrl}/invite/${encodeURIComponent(token as string)}`

    // ── 5. Return invite URL for link sharing ─────────────────────────────────
    // The raw token is NOT returned — inviteUrl is the only sharing surface.
    return new Response(
      JSON.stringify({ inviteUrl, emailSent: false, sharingMode: 'link' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    console.error('send-workspace-invite error:', msg)
    return jsonError(msg, 500)
  }
})

function jsonError(message: string, status: number) {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
}
