import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import styles from './BottomSheet.module.css'

interface Props {
  children: ReactNode
  onClose: () => void
  'aria-labelledby'?: string
}

export default function BottomSheet({ children, onClose, 'aria-labelledby': labelledBy }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Prevent background scroll while sheet is open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Trap focus inside panel; restore when closed
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    const first = panelRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    first?.focus()
    return () => { prev?.focus() }
  }, [])

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  // Portal to document.body escapes any ancestor stacking context
  // (sidebar position:fixed, topBar position:sticky) so the backdrop
  // and panel render above ALL application chrome including mobile nav.
  return createPortal(
    <div className={styles.overlay} onClick={handleBackdropClick} role="presentation">
      <div
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        <div className={styles.handle} aria-hidden="true" />
        {children}
      </div>
    </div>,
    document.body
  )
}
