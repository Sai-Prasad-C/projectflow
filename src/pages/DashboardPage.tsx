import { useNavigate } from 'react-router-dom'
import Button from '../components/ui/Button'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div style={{ padding: 'var(--space-8)', maxWidth: 600, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, marginBottom: 'var(--space-2)' }}>ProjectFlow</h1>
      <p style={{ color: 'var(--color-text-2)', marginBottom: 'var(--space-6)' }}>
        Signed in as <strong>{user?.email}</strong>
      </p>
      <Button variant="ghost" onClick={handleSignOut}>
        Sign out
      </Button>
    </div>
  )
}
