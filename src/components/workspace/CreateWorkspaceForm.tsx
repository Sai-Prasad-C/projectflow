import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import BottomSheet from '../ui/BottomSheet'
import Button from '../ui/Button'
import Input from '../ui/Input'
import styles from './CreateWorkspaceForm.module.css'

const LAST_WS_KEY = 'pf-last-workspace'

interface Props {
  onClose: () => void
  onCreated: () => void
}

export default function CreateWorkspaceForm({ onClose, onCreated }: Props) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) { setError('Workspace name is required.'); return }
    if (trimmed.length > 100) { setError('Name must be 100 characters or fewer.'); return }
    if (!user) { setError('Not authenticated.'); return }

    setError(null)
    setLoading(true)

    const { data: sessionData } = await supabase.auth.refreshSession()
    if (!sessionData.session) {
      setError('Your session has expired. Sign in again.')
      setLoading(false)
      return
    }

    const { data: workspaceId, error: rpcError } = await supabase.rpc('create_workspace', { p_name: trimmed })
    setLoading(false)
    if (rpcError) { setError(rpcError.message); return }

    const id = workspaceId as string
    localStorage.setItem(LAST_WS_KEY, id)
    onCreated()
    navigate(`/app/${id}/projects`, { replace: false })
  }

  return (
    <BottomSheet onClose={onClose} aria-labelledby="cwf-title">
      <div className={styles.header}>
        <h2 id="cwf-title" className={styles.title}>Create workspace</h2>
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <p className={styles.sub}>A workspace is where you and your team manage projects together.</p>
      <form onSubmit={handleSubmit} noValidate>
        <Input
          label="Workspace name"
          value={name}
          onChange={e => { setName(e.target.value); setError(null) }}
          placeholder="e.g. Acme Corp"
          maxLength={100}
          autoFocus
        />
        {error ? <p className={styles.error}>{error}</p> : null}
        <div className={styles.actions}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button type="submit" loading={loading} disabled={!name.trim()}>Create workspace</Button>
        </div>
      </form>
    </BottomSheet>
  )
}
