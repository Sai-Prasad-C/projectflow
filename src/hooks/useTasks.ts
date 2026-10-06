import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getCachedTasks, putTasks, putTask, removeTask } from '../lib/idb'
import type { Task } from '../lib/types'

export function useTasks(projectId: string) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId) return
    let cancelled = false

    // Immediately render cached tasks so the board is visible while fetching.
    getCachedTasks(projectId).then(cached => {
      if (!cancelled && cached.length > 0) setTasks(cached as Task[])
    }).catch(() => { /* IDB unavailable — silently ignore */ })

    // Subscribe before fetching so no events are missed during the initial load.
    // The fetch result is set as canonical state once it returns; events that fire
    // during that window are handled by idempotent merging (INSERT dedup by id,
    // UPDATE replaces in-place, DELETE filters out).
    const channel = supabase
      .channel(`tasks:project:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tasks',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const t = payload.new as Task
          void putTask(t as Task & { version?: number })
          // Skip if we already have this row — covers local adds that are
          // appended to state after the DB write returns (before Realtime fires).
          setTasks(prev => prev.some(x => x.id === t.id) ? prev : [...prev, t])
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasks',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const t = payload.new as Task
          void putTask(t as Task & { version?: number })
          setTasks(prev => prev.map(x => x.id === t.id ? t : x))
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'tasks',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const id = (payload.old as { id: string }).id
          void removeTask(id)
          setTasks(prev => prev.filter(x => x.id !== id))
        }
      )
      .subscribe()

    async function load() {
      setLoading(true)
      setError(null)
      const { data, error: fetchError } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('position', { ascending: true })
      if (cancelled) return
      if (fetchError) { setError(fetchError.message); setLoading(false); return }
      const fetched = (data ?? []) as Task[]
      setTasks(fetched)
      setLoading(false)
      void putTasks(fetched as (Task & { version?: number })[])
    }

    void load()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [projectId])

  return { tasks, setTasks, loading, error }
}
