import { useSyncStatus } from '../../hooks/useSyncStatus'
import styles from './SyncIndicator.module.css'

export default function SyncIndicator() {
  const { status, pendingCount } = useSyncStatus()

  if (status === 'idle' || status === 'online') return null

  const labels: Record<string, string> = {
    offline:  'Offline — changes will sync when back online',
    syncing:  'Syncing…',
    error:    `Sync failed — ${pendingCount} change${pendingCount !== 1 ? 's' : ''} pending`,
    conflict: 'Conflict — tap to review',
  }

  return (
    <div
      className={[styles.bar, styles[status]].filter(Boolean).join(' ')}
      role="status"
      aria-live="polite"
    >
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.label}>{labels[status] ?? status}</span>
    </div>
  )
}
