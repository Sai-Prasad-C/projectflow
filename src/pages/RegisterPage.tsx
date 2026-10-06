import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import AuthCard from '../components/auth/AuthCard'
import cardStyles from '../components/auth/AuthCard.module.css'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

export default function RegisterPage() {
  const { session } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  if (session) return <Navigate to="/app" replace />

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
    const { error } = await supabase.auth.signUp({ email, password })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <AuthCard heading="Check your email">
        <p style={{ fontSize: 14, color: 'var(--color-text-2)', marginBottom: 'var(--space-5)' }}>
          We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.
        </p>
        <div className={cardStyles.links}>
          <Link to="/login">Back to sign in</Link>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard heading="Create your account">
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
          autoComplete="new-password"
          minLength={8}
        />
        <Input
          label="Confirm password"
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
        />
        {error ? <p className={cardStyles.formError}>{error}</p> : null}
        <Button type="submit" loading={loading} fullWidth>
          Create account
        </Button>
      </form>
      <div className={cardStyles.links}>
        Already have an account?
        <span className={cardStyles.sep}>·</span>
        <Link to="/login">Sign in</Link>
      </div>
    </AuthCard>
  )
}
