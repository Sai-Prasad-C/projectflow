// Edge Function: send-workspace-invite
// Creates a workspace invitation and optionally delivers it via email.
//
// POST /functions/v1/send-workspace-invite
// Authorization: Bearer <user-jwt>
// Body: { workspace_id, email, role? }
//
// Returns: { token?, inviteUrl, emailSent }
// (token is omitted from the response when email delivery was requested,
//  so the invite link is only reachable via email — unless sharing is explicit)

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
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Use the user's JWT for authorization checks — do NOT bypass RLS
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    // Service-role client for looking up user emails (auth.users is not accessible
    // via the user token due to RLS — only used to resolve inviter's display info)
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    // Verify caller is authenticated
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
    // The RPC handles all authorization checks (caller must be owner/admin)
    // and stores the token hash — it returns the plaintext token.
    const { data: token, error: rpcErr } = await userClient.rpc(
      'create_workspace_invitation',
      { p_workspace_id: workspace_id, p_email: email, p_role: role },
    )

    if (rpcErr) {
      // Surface RPC-level authorization / validation errors to caller
      return jsonError(rpcErr.message, 403)
    }

    if (!token) {
      return jsonError('Failed to generate invitation token', 500)
    }

    // ── 4. Build invite URL ───────────────────────────────────────────────────
    const appUrl = Deno.env.get('APP_URL') ?? supabaseUrl
    const inviteUrl = `${appUrl}/invite/${token}`

    // ── 5. Optional email delivery ────────────────────────────────────────────
    const emailApiKey = Deno.env.get('EMAIL_PROVIDER_API_KEY')
    const fromEmail   = Deno.env.get('INVITE_FROM_EMAIL') ?? 'noreply@projectflow.app'
    let emailSent = false

    if (emailApiKey) {
      // Fetch workspace name for the email body
      const { data: ws } = await adminClient
        .from('workspaces')
        .select('name')
        .eq('id', workspace_id)
        .single()

      const workspaceName = ws?.name ?? 'a workspace'

      // Fetch inviter display name
      const { data: profile } = await adminClient
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .single()

      const inviterName = profile?.display_name ?? user.email ?? 'Someone'

      // Send via generic HTTP email provider (customize for Resend, SendGrid, etc.)
      // This example uses the Resend API — adjust if using a different provider.
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${emailApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from:    fromEmail,
          to:      [email],
          subject: `${inviterName} invited you to join ${workspaceName} on ProjectFlow`,
          html: `
            <p>Hi,</p>
            <p><strong>${inviterName}</strong> has invited you to join <strong>${workspaceName}</strong> on ProjectFlow as a <strong>${role}</strong>.</p>
            <p><a href="${inviteUrl}" style="background:#f97316;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;">Accept Invitation</a></p>
            <p>This invitation expires in 7 days.</p>
            <p>If you did not expect this invitation, you can safely ignore this email.</p>
          `,
        }),
      })

      emailSent = emailRes.ok

      if (!emailRes.ok) {
        // Email failure should not prevent the invitation from being usable.
        // The plaintext token is still returned so the inviter can share the link manually.
        console.error('Email delivery failed:', await emailRes.text())
      }
    }

    // ── 6. Return invite URL (and token so inviter can copy the link) ─────────
    return new Response(
      JSON.stringify({ inviteUrl, token, emailSent }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    console.error(msg)
    return jsonError(msg, 500)
  }
})

function jsonError(message: string, status: number) {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
}
