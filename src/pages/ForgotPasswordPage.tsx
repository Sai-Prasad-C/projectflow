import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import AuthCard from '../components/auth/AuthCard'
import cardStyles from '../components/auth/AuthCard.module.css'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

export default function ForgotPasswordPage() {
  const { session } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  if (session) return <Navigate to="/app" replace />

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
  }

  if (sent) {
    return (
      <AuthCard heading="Check your email">
        <p style={{ fontSize: 14, color: 'var(--color-text-2)', marginBottom: 'var(--space-5)' }}>
          If <strong>{email}</strong> matches an account, you'll receive a reset link shortly.
        </p>
        <div className={cardStyles.links}>
          <Link to="/login">Back to sign in</Link>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard heading="Forgot your password?">
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
        {error ? <p className={cardStyles.formError}>{error}</p> : null}
        <Button type="submit" loading={loading} fullWidth>
          Send reset link
        </Button>
      </form>
      <div className={cardStyles.links}>
        <Link to="/login">Back to sign in</Link>
      </div>
    </AuthCard>
  )
}
