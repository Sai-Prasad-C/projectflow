import { useEffect, useRef, type ReactNode } from 'react'
import styles from './BottomSheet.module.css'

interface Props {
  children: ReactNode
  onClose: () => void
  'aria-labelledby'?: string
}

export default function BottomSheet({ children, onClose, 'aria-labelledby': labelledBy }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Trap focus inside panel
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

  return (
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
    </div>
  )
}
