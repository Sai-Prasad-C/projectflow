import { useEffect, useState } from 'react'
import { syncManager } from '../lib/sync'
import type { SyncStatus } from '../lib/sync'

export function useSyncStatus() {
  const [status, setStatus] = useState<SyncStatus>('idle')
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    const unsub = syncManager.subscribe((s, count) => {
      setStatus(s)
      setPendingCount(count)
    })
    void syncManager.sync()
    return unsub
  }, [])

  return { status, pendingCount }
}
