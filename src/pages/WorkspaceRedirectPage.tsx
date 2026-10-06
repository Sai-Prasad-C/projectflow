import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import Brand from '../components/ui/Brand'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { useAuth } from '../hooks/useAuth'
import { useWorkspaces } from '../hooks/useWorkspaces'
import { supabase } from '../lib/supabase'
import styles from './WorkspaceRedirectPage.module.css'

export default function WorkspaceRedirectPage() {
  const { user } = useAuth()
  const { workspaces, loading } = useWorkspaces()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  if (loading) {
    return (
      <div className={styles.center}>
        <span style={{ color: 'var(--color-text-2)', fontSize: 14 }}>Loading…</span>
      </div>
    )
  }

  if (workspaces.length > 0) {
    const lastId = localStorage.getItem('pf-last-workspace')
    const target = workspaces.find(w => w.id === lastId) ?? workspaces[0]
    return <Navigate to={`/app/${target.id}/projects`} replace />
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) { setError('Workspace name is required.'); return }
    if (trimmed.length > 100) { setError('Name must be 100 characters or fewer.'); return }
    setError(null)
    setCreating(true)

    // Refresh the session and verify it is still valid before writing.
    // A null session (deleted account, rotated secret) has no effect on the
    // React auth state but produces auth.uid() = NULL in the database, which
    // silently fails the RLS policy even when the supabase client thinks the
    // user is signed in.
    const { data: sessionData, error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError || !sessionData.session) {
      setCreating(false)
      setError('Your session has expired. Please sign in again.')
      await supabase.auth.signOut()
      navigate('/login', { replace: true })
      return
    }

    // Use an RPC function so that auth.uid() is resolved entirely server-side.
    // This avoids any mismatch between the client-side user.id and the value
    // the database sees in its JWT context.
    const { data: workspaceId, error } = await supabase.rpc('create_workspace', { p_name: trimmed })
    setCreating(false)
    if (error) { setError(error.message); return }
    localStorage.setItem('pf-last-workspace', workspaceId as string)
    navigate(`/app/${workspaceId as string}/projects`, { replace: true })
  }

  return (
    <div className={styles.center}>
      <div className={styles.card}>
        <div className={styles.brand}><Brand size={28} showName /></div>
        <h1 className={styles.heading}>Create your workspace</h1>
        <p className={styles.sub}>
          A workspace is where you and your team manage projects together.
        </p>
        <form onSubmit={handleSubmit} noValidate>
          <Input
            label="Workspace name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Acme Corp"
            required
            autoFocus
            maxLength={100}
          />
          {error ? <p className={styles.formError}>{error}</p> : null}
          <Button type="submit" loading={creating} fullWidth>
            Create workspace
          </Button>
        </form>
        <p className={styles.hint}>
          Signed in as {user?.email}.{' '}
          <button type="button" className={styles.signOutLink} onClick={handleSignOut}>
            Sign out
          </button>
        </p>
      </div>
    </div>
  )
}
