import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Workspace } from '../lib/types'

export function useWorkspaces() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rev, setRev] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase
        .from('workspaces')
        .select('*')
        .order('created_at', { ascending: true })
      if (cancelled) return
      if (error) setError(error.message)
      else setWorkspaces(data ?? [])
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [rev])

  const reload = useCallback(() => setRev(r => r + 1), [])

  return { workspaces, loading, error, reload }
}
