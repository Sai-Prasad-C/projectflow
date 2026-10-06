import { useState, useId } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import BottomSheet from '../ui/BottomSheet'
import Input from '../ui/Input'
import Button from '../ui/Button'
import styles from './ChangeEmailSheet.module.css'

interface Props {
  currentEmail: string
  onClose: () => void
  onSuccess: (newEmail: string) => void
}

export default function ChangeEmailSheet({ currentEmail, onClose, onSuccess }: Props) {
  const titleId = useId()
  const [newEmail, setNewEmail] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function validate(): string | null {
    const trimmed = newEmail.trim().toLowerCase()
    if (!trimmed) return 'Enter a new email address.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'Enter a valid email address.'
    if (trimmed === currentEmail.toLowerCase()) return 'That is already your current email address.'
    if (confirm.trim().toLowerCase() !== trimmed) return 'The email addresses do not match.'
    return null
  }

  async function handleSubmit() {
    const validationError = validate()
    if (validationError) { setError(validationError); return }

    if (!navigator.onLine) {
      setError("You're offline. Connect to the internet to change your email address.")
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Your session has expired. Sign in again.')
        setSubmitting(false)
        return
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const fnUrl = `${supabaseUrl}/functions/v1/change-account-email`

      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: newEmail.trim().toLowerCase() }),
      })

      const json = await res.json() as { success?: boolean; email?: string; error?: string }

      if (!res.ok) {
        setError(json.error ?? 'Could not update email. Please try again.')
        setSubmitting(false)
        return
      }

      // Refresh the browser session so user.email reflects the new value
      await supabase.auth.refreshSession()

      onSuccess(json.email ?? newEmail.trim().toLowerCase())
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <BottomSheet onClose={onClose} aria-labelledby={titleId}>
      <div className={styles.header}>
        <h2 id={titleId} className={styles.title}>Change email</h2>
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className={styles.body}>
        <div className={styles.currentRow}>
          <span className={styles.currentLabel}>Current email</span>
          <span className={styles.currentValue}>{currentEmail}</span>
        </div>

        <Input
          label="New email"
          type="email"
          value={newEmail}
          onChange={e => { setNewEmail(e.target.value); setError(null) }}
          autoComplete="email"
          autoFocus
        />
        <Input
          label="Confirm new email"
          type="email"
          value={confirm}
          onChange={e => { setConfirm(e.target.value); setError(null) }}
          autoComplete="email"
        />

        {error && <p className={styles.error} role="alert">{error}</p>}

        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button
            loading={submitting}
            onClick={handleSubmit}
            disabled={!newEmail.trim() || !confirm.trim()}
          >
            Change email
          </Button>
        </div>
      </div>
    </BottomSheet>
  )
}
