// Edge Function: change-account-email
// Immediately updates the authenticated caller's email using the Admin API.
// No confirmation email is sent — the change applies directly.
//
// POST /functions/v1/change-account-email
// Authorization: Bearer <user-jwt>
// Body: { "email": "new@example.com" }
//
// Returns: { success: true, email: "new@example.com" }
//
// No custom env vars required — SUPABASE_URL, SUPABASE_ANON_KEY, and
// SUPABASE_SERVICE_ROLE_KEY are injected automatically by the Supabase runtime.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const EMAIL_MAX_LEN = 254

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── 1. Verify caller JWT ───────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonError('Missing or invalid Authorization header', 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey    = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // User client: authenticated with caller's JWT (inherits RLS scope)
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) {
      return jsonError('Not authenticated', 401)
    }

    // ── 2. Parse and validate request body ────────────────────────────────────
    const body = await req.json().catch(() => null) as { email?: unknown } | null
    if (!body || typeof body.email !== 'string') {
      return jsonError('Request body must include an "email" field', 400)
    }

    const newEmail = body.email.trim().toLowerCase()

    if (!newEmail) {
      return jsonError('Email address is required', 400)
    }
    if (newEmail.length > EMAIL_MAX_LEN) {
      return jsonError('Email address is too long', 400)
    }
    if (!EMAIL_REGEX.test(newEmail)) {
      return jsonError('Enter a valid email address', 400)
    }
    if (newEmail === user.email?.toLowerCase()) {
      return jsonError('That is already your email address', 400)
    }

    // ── 3. Apply update via Admin API ─────────────────────────────────────────
    // The admin client uses the service-role key which never leaves this function.
    // It updates ONLY the authenticated caller's user record.
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: updated, error: updateErr } = await adminClient.auth.admin.updateUserById(
      user.id,
      { email: newEmail, email_confirm: true },
    )

    if (updateErr) {
      // Translate common Supabase errors into user-facing messages
      const msg = updateErr.message.toLowerCase()
      if (msg.includes('already registered') || msg.includes('already in use') || msg.includes('already exists') || msg.includes('duplicate')) {
        return jsonError('This email is already in use by another account', 409)
      }
      return jsonError('Could not update email. Please try again.', 400)
    }

    return new Response(
      JSON.stringify({ success: true, email: updated.user.email }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    console.error('change-account-email error:', msg)
    return jsonError('Internal server error', 500)
  }
})

function jsonError(message: string, status: number) {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
}
