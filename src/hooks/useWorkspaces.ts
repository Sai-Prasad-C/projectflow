import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Workspace } from '../lib/types'

export function useWorkspaces() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
  }, [])

  return { workspaces, loading, error }
}
