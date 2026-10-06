import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import AuthCard from '../components/auth/AuthCard'
import cardStyles from '../components/auth/AuthCard.module.css'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

export default function ResetPasswordPage() {
  const { loading: authLoading, isPasswordRecovery, session } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  if (authLoading) {
    return (
      <AuthCard heading="Reset password">
        <p style={{ fontSize: 14, color: 'var(--color-text-2)' }}>Verifying reset link…</p>
      </AuthCard>
    )
  }

  // Logged-in user visited this page without a recovery token — send them to the app
  if (session && !isPasswordRecovery) {
    return <Navigate to="/app" replace />
  }

  // No recovery token — link is invalid or expired
  if (!isPasswordRecovery) {
    return (
      <AuthCard heading="Link expired">
        <p style={{ fontSize: 14, color: 'var(--color-text-2)', marginBottom: 'var(--space-5)' }}>
          This password reset link is invalid or has expired.
        </p>
        <div className={cardStyles.links}>
          <Link to="/forgot-password">Request a new link</Link>
        </div>
      </AuthCard>
    )
  }

  if (done) {
    return (
      <AuthCard heading="Password updated">
        <p style={{ fontSize: 14, color: 'var(--color-text-2)', marginBottom: 'var(--space-5)' }}>
          Your password has been updated. Redirecting…
        </p>
      </AuthCard>
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setDone(true)
      setTimeout(() => navigate('/app'), 1500)
    }
  }

  return (
    <AuthCard heading="Set new password">
      <form onSubmit={handleSubmit} noValidate>
        <Input
          label="New password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          autoComplete="new-password"
          minLength={8}
          autoFocus
        />
        <Input
          label="Confirm new password"
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
        />
        {error ? <p className={cardStyles.formError}>{error}</p> : null}
        <Button type="submit" loading={loading} fullWidth>
          Update password
        </Button>
      </form>
    </AuthCard>
  )
}
