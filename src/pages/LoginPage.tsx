import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import AuthCard from '../components/auth/AuthCard'
import cardStyles from '../components/auth/AuthCard.module.css'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

const PENDING_INVITE_KEY = 'pf-pending-invite'

function consumePendingInvite(): string | null {
  const token = sessionStorage.getItem(PENDING_INVITE_KEY)
  if (token) sessionStorage.removeItem(PENDING_INVITE_KEY)
  return token
}

export default function LoginPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // If the user is already authenticated, resume any pending invite or go to app.
  if (session) {
    const pendingToken = consumePendingInvite()
    if (pendingToken) return <Navigate to={`/invite/${pendingToken}`} replace />
    return <Navigate to="/app" replace />
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (signInError) {
      setError(signInError.message)
      return
    }
    const pendingToken = consumePendingInvite()
    if (pendingToken) {
      navigate(`/invite/${pendingToken}`)
    } else {
      navigate('/app')
    }
  }

  return (
    <AuthCard heading="Sign in to your account">
      <form onSubmit={handleSubmit} noValidate>
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="email"
          autoFocus
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        {error ? <p className={cardStyles.formError}>{error}</p> : null}
        <Button type="submit" loading={loading} fullWidth>
          Sign in
        </Button>
      </form>
      <div className={cardStyles.links}>
        <Link to="/forgot-password">Forgot password?</Link>
        <span className={cardStyles.sep}>·</span>
        <Link to="/register">Create account</Link>
      </div>
    </AuthCard>
  )
}
