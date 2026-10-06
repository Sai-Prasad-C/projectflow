import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CheckCircle, Clock, XCircle, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Brand from '../components/ui/Brand'
import Button from '../components/ui/Button'
import styles from './InvitePage.module.css'

const PENDING_INVITE_KEY = 'pf-pending-invite'

type PageState =
  | { status: 'loading' }
  | { status: 'accepting' }
  | { status: 'success'; workspaceId: string; workspaceName: string }
  | { status: 'already_accepted' }
  | { status: 'expired' }
  | { status: 'revoked' }
  | { status: 'wrong_account'; inviteEmail: string }
  | { status: 'invalid' }
  | { status: 'error'; message: string }

export default function InvitePage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [state, setState] = useState<PageState>({ status: 'loading' })
  // Guard against double-accept in React Strict Mode; server RPC is also idempotent.
  const acceptingRef = useRef(false)

  useEffect(() => {
    if (!token) { setState({ status: 'invalid' }); return }
    // Wait for auth state to resolve — avoids storing sessionStorage token
    // or calling acceptInvite prematurely while the session is still loading.
    if (authLoading) return

    if (!user) {
      sessionStorage.setItem(PENDING_INVITE_KEY, token)
      navigate('/login', { replace: true })
      return
    }

    void acceptInvite(token)
  }, [token, user, authLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  async function acceptInvite(t: string) {
    if (acceptingRef.current) return
    acceptingRef.current = true
    setState({ status: 'accepting' })

    const { data, error } = await supabase.rpc('accept_workspace_invitation', { p_token: t })

    if (error) {
      acceptingRef.current = false
      const msg = error.message.toLowerCase()
      if (msg.includes('expired'))          return setState({ status: 'expired' })
      if (msg.includes('revoked'))          return setState({ status: 'revoked' })
      if (msg.includes('already accepted')) return setState({ status: 'already_accepted' })
      if (msg.includes('different email')) {
        return setState({ status: 'wrong_account', inviteEmail: '(check your other account)' })
      }
      if (msg.includes('invalid'))          return setState({ status: 'invalid' })
      return setState({ status: 'error', message: error.message })
    }

    if (!data) { acceptingRef.current = false; return setState({ status: 'invalid' }) }

    const workspaceId = data as string
    const { data: ws } = await supabase.from('workspaces').select('name').eq('id', workspaceId).single()
    setState({ status: 'success', workspaceId, workspaceName: ws?.name ?? 'the workspace' })
  }

  function handleGoToWorkspace() {
    if (state.status !== 'success') return
    localStorage.setItem('pf-last-workspace', state.workspaceId)
    navigate(`/app/${state.workspaceId}/projects`, { replace: true })
  }

  const content = (() => {
    switch (state.status) {
      case 'loading':
      case 'accepting':
        return (
          <>
            <div className={styles.iconWrap}>
              <div className={styles.spinner} aria-hidden="true" />
            </div>
            <h1 className={styles.heading}>
              {state.status === 'loading' ? 'Checking invitation…' : 'Joining workspace…'}
            </h1>
            <p className={styles.body}>Please wait a moment.</p>
          </>
        )

      case 'success':
        return (
          <>
            <div className={styles.iconWrap}>
              <CheckCircle size={48} className={styles.iconSuccess} />
            </div>
            <h1 className={styles.heading}>You're in!</h1>
            <p className={styles.body}>You've joined <strong>{state.workspaceName}</strong>. Ready to get started?</p>
            <Button onClick={handleGoToWorkspace}>Go to workspace</Button>
          </>
        )

      case 'already_accepted':
        return (
          <>
            <div className={styles.iconWrap}>
              <XCircle size={48} className={styles.iconDanger} />
            </div>
            <h1 className={styles.heading}>Invitation already used</h1>
            <p className={styles.body}>This invitation link has already been used. Ask the workspace owner to send a new one.</p>
          </>
        )

      case 'expired':
        return (
          <>
            <div className={styles.iconWrap}>
              <Clock size={48} className={styles.iconWarning} />
            </div>
            <h1 className={styles.heading}>Invitation expired</h1>
            <p className={styles.body}>This invitation link has expired. Ask the workspace owner to send a new one.</p>
          </>
        )

      case 'revoked':
        return (
          <>
            <div className={styles.iconWrap}>
              <XCircle size={48} className={styles.iconDanger} />
            </div>
            <h1 className={styles.heading}>Invitation cancelled</h1>
            <p className={styles.body}>This invitation has been cancelled by the workspace owner.</p>
          </>
        )

      case 'wrong_account':
        return (
          <>
            <div className={styles.iconWrap}>
              <AlertTriangle size={48} className={styles.iconWarning} />
            </div>
            <h1 className={styles.heading}>Wrong account</h1>
            <p className={styles.body}>
              This invitation was sent to a different email address. Sign in with the correct account and try the link again.
            </p>
            <Button variant="ghost" onClick={() => {
              // Re-store the token so the next login can resume this invite.
              if (token) sessionStorage.setItem(PENDING_INVITE_KEY, token)
              void supabase.auth.signOut()
              navigate('/login')
            }}>
              Sign in with a different account
            </Button>
          </>
        )

      case 'invalid':
        return (
          <>
            <div className={styles.iconWrap}>
              <XCircle size={48} className={styles.iconDanger} />
            </div>
            <h1 className={styles.heading}>Invalid invitation</h1>
            <p className={styles.body}>This invitation link is not valid. It may have already been used or the link is incorrect.</p>
          </>
        )

      case 'error':
        return (
          <>
            <div className={styles.iconWrap}>
              <AlertTriangle size={48} className={styles.iconDanger} />
            </div>
            <h1 className={styles.heading}>Something went wrong</h1>
            <p className={styles.body}>{state.message}</p>
            <Button variant="ghost" onClick={() => { acceptingRef.current = false; if (token) void acceptInvite(token) }}>Try again</Button>
          </>
        )
    }
  })()

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}><Brand size={22} showName /></div>
        {content}
      </div>
    </div>
  )
}
