import { useEffect, useRef, useState } from 'react'
import Button from '../ui/Button'
import styles from './ProjectForm.module.css'

interface Props {
  heading: string
  initialName?: string
  initialDescription?: string
  submitLabel: string
  onSubmit: (name: string, description: string) => Promise<string | null>
  onCancel: () => void
}

export default function ProjectForm({
  heading,
  initialName = '',
  initialDescription = '',
  submitLabel,
  onSubmit,
  onCancel,
}: Props) {
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Project name is required.')
      return
    }
    if (trimmed.length > 200) {
      setError('Name must be 200 characters or fewer.')
      return
    }
    setError(null)
    setLoading(true)
    const err = await onSubmit(trimmed, description.trim())
    setLoading(false)
    if (err) setError(err)
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onCancel()
  }

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.dialog} role="dialog" aria-modal="true">
        <h2 className={styles.heading}>{heading}</h2>
        <form onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="pf-name">Name</label>
            <input
              id="pf-name"
              ref={nameRef}
              className={styles.input}
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={200}
              required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="pf-desc">Description <span style={{ fontWeight: 400 }}>(optional)</span></label>
            <textarea
              id="pf-desc"
              className={styles.textarea}
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          {error ? <p className={styles.error}>{error}</p> : null}
          <div className={styles.actions}>
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              {submitLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
