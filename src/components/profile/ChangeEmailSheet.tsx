import { useState, useId } from 'react'
import { Mail, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import BottomSheet from '../ui/BottomSheet'
import Input from '../ui/Input'
import Button from '../ui/Button'
import styles from './ChangeEmailSheet.module.css'

interface Props {
  currentEmail: string
  onClose: () => void
}

type Step = 'form' | 'pending'

export default function ChangeEmailSheet({ currentEmail, onClose }: Props) {
  const titleId = useId()
  const [step, setStep] = useState<Step>('form')
  const [newEmail, setNewEmail] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState('')

  function validate(): string | null {
    const trimmed = newEmail.trim().toLowerCase()
    if (!trimmed) return 'Enter a new email address.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'Enter a valid email address.'
    if (trimmed === currentEmail.toLowerCase()) return 'That is already your current email address.'
    if (confirm.trim().toLowerCase() !== trimmed) return 'Email addresses do not match.'
    return null
  }

  async function handleSubmit() {
    const validationError = validate()
    if (validationError) { setError(validationError); return }

    if (!navigator.onLine) {
      setError('You appear to be offline. Email changes require an internet connection.')
      return
    }

    setSubmitting(true)
    setError(null)

    const trimmed = newEmail.trim().toLowerCase()
    const { error: authError } = await supabase.auth.updateUser(
      { email: trimmed },
      { emailRedirectTo: `${window.location.origin}/app` }
    )

    setSubmitting(false)

    if (authError) {
      if (authError.message.includes('rate limit') || authError.message.includes('too many')) {
        setError('Too many requests. Please wait a few minutes before trying again.')
      } else {
        setError(authError.message)
      }
      return
    }

    setSentTo(trimmed)
    setStep('pending')
  }

  return (
    <BottomSheet onClose={onClose} aria-labelledby={titleId}>
      <div className={styles.header}>
        <h2 id={titleId} className={styles.title}>Change email</h2>
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      {step === 'form' ? (
        <div className={styles.body}>
          <p className={styles.description}>
            A confirmation link will be sent to your new address. Your current email stays active until you confirm.
          </p>
          <Input
            label="New email"
            type="email"
            value={newEmail}
            onChange={e => { setNewEmail(e.target.value); setError(null) }}
            autoComplete="email"
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
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button
              loading={submitting}
              onClick={handleSubmit}
              disabled={!newEmail.trim() || !confirm.trim()}
            >
              Send confirmation
            </Button>
          </div>
        </div>
      ) : (
        <div className={styles.body}>
          <div className={styles.pendingIcon} aria-hidden="true">
            <Mail size={28} />
          </div>
          <h3 className={styles.pendingHeading}>Check your inbox</h3>
          <p className={styles.pendingBody}>
            We sent a confirmation link to <strong>{sentTo}</strong>.
            Click the link to complete your email change. Your current email address stays active until you confirm.
          </p>
          <p className={styles.pendingNote}>
            Didn't receive it? Check your spam folder or wait a few minutes before trying again.
          </p>
          <Button fullWidth onClick={onClose}>Done</Button>
        </div>
      )}
    </BottomSheet>
  )
}
