import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CheckCircle, Clock, XCircle, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Brand from '../components/ui/Brand'
import Button from '../components/ui/Button'
import styles from './InvitePage.module.css'

type PageState =
  | { status: 'loading' }
  | { status: 'accepting' }
  | { status: 'success'; workspaceId: string }
  | { status: 'already_accepted' }
  | { status: 'expired' }
  | { status: 'revoked' }
  | { status: 'wrong_account'; inviteEmail: string }
  | { status: 'invalid' }
  | { status: 'error'; message: string }

export default function InvitePage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [state, setState] = useState<PageState>({ status: 'loading' })

  useEffect(() => {
    if (!token) {
      setState({ status: 'invalid' })
      return
    }

    if (!user) {
      // Preserve token in sessionStorage and redirect to login
      sessionStorage.setItem('pf-pending-invite', token)
      navigate('/login', { replace: true })
      return
    }

    // Check for a stored invite token after login redirect
    const stored = sessionStorage.getItem('pf-pending-invite')
    if (stored) sessionStorage.removeItem('pf-pending-invite')

    acceptInvite(token)
  }, [token, user]) // eslint-disable-line react-hooks/exhaustive-deps

  async function acceptInvite(t: string) {
    setState({ status: 'accepting' })
    const { data, error } = await supabase.rpc('accept_workspace_invitation', { p_token: t })

    if (error) {
      const msg = error.message.toLowerCase()
      if (msg.includes('expired'))        return setState({ status: 'expired' })
      if (msg.includes('revoked'))        return setState({ status: 'revoked' })
      if (msg.includes('already accepted')) return setState({ status: 'already_accepted' })
      if (msg.includes('different email')) {
        return setState({ status: 'wrong_account', inviteEmail: '(check your other account)' })
      }
      if (msg.includes('invalid'))        return setState({ status: 'invalid' })
      return setState({ status: 'error', message: error.message })
    }

    if (!data) return setState({ status: 'invalid' })
    setState({ status: 'success', workspaceId: data as string })
  }

  function handleGoToWorkspace() {
    if (state.status === 'success') {
      navigate(`/app/${state.workspaceId}/projects`, { replace: true })
    }
  }

  function handleAlreadyAccepted() {
    navigate('/app', { replace: true })
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
              {state.status === 'loading' ? 'Validating invitation…' : 'Accepting invitation…'}
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
            <p className={styles.body}>Invitation accepted. You now have access to the workspace.</p>
            <Button onClick={handleGoToWorkspace}>Go to workspace</Button>
          </>
        )

      case 'already_accepted':
        return (
          <>
            <div className={styles.iconWrap}>
              <CheckCircle size={48} className={styles.iconSuccess} />
            </div>
            <h1 className={styles.heading}>Already accepted</h1>
            <p className={styles.body}>This invitation has already been accepted. You can go directly to the workspace.</p>
            <Button onClick={handleAlreadyAccepted}>Go to app</Button>
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
            <Button variant="ghost" onClick={() => { void supabase.auth.signOut(); navigate('/login') }}>
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
            <Button variant="ghost" onClick={() => token && acceptInvite(token)}>Try again</Button>
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
