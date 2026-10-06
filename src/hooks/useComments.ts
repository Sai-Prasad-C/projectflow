import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getCachedComments, putComments, putComment, removeComment } from '../lib/idb'
import type { TaskComment } from '../lib/types'

export interface Comment {
  id: string
  task_id: string
  author_id: string
  body: string
  created_at: string
  updated_at: string
  author_display_name: string
  author_avatar_url: string | null
}

// Shape of a raw row coming from Realtime (no joined profile fields).
interface CommentRow {
  id: string
  task_id: string
  author_id: string
  body: string
  created_at: string
  updated_at: string
}

export function useComments(taskId: string | null) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!taskId) { setComments([]); return }
    let cancelled = false

    // Render cached comments immediately while network fetch is in progress.
    getCachedComments(taskId).then(cached => {
      if (!cancelled && cached.length > 0) {
        // Cached rows lack author profile fields — show minimal display until network loads.
        setComments(cached.map(c => ({
          id: c.id,
          task_id: c.task_id,
          author_id: c.author_id,
          body: c.body,
          created_at: c.created_at,
          updated_at: c.updated_at,
          author_display_name: '',
          author_avatar_url: null,
        })))
      }
    }).catch(() => { /* IDB unavailable — silently ignore */ })

    // Subscribe before fetching for the same reason as useTasks.
    const channel = supabase
      .channel(`comments:task:${taskId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_comments',
          filter: `task_id=eq.${taskId}`,
        },
        async (payload) => {
          const row = payload.new as CommentRow
          // Cache the raw comment row (without profile fields)
          void putComment(row as TaskComment & { version?: number })
          // Fetch profile before updating state so there's no interim placeholder.
          // supabase-js never throws; errors produce { data: null, error }.
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, display_name, avatar_url')
            .eq('id', row.author_id)
            .single()
          setComments(prev => {
            // Skip if already present — our own comments are added to state right
            // after the DB write returns (TaskDetail.handleSubmit), which is always
            // before the Realtime event arrives.
            if (prev.some(c => c.id === row.id)) return prev
            return [...prev, {
              id: row.id,
              task_id: row.task_id,
              author_id: row.author_id,
              body: row.body,
              created_at: row.created_at,
              updated_at: row.updated_at,
              author_display_name: profile?.display_name ?? 'Unknown',
              author_avatar_url: profile?.avatar_url ?? null,
            }]
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'task_comments',
          filter: `task_id=eq.${taskId}`,
        },
        (payload) => {
          const row = payload.new as CommentRow
          void putComment(row as TaskComment & { version?: number })
          setComments(prev => prev.map(c =>
            c.id === row.id ? { ...c, body: row.body, updated_at: row.updated_at } : c
          ))
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'task_comments',
          filter: `task_id=eq.${taskId}`,
        },
        (payload) => {
          const id = (payload.old as { id: string }).id
          void removeComment(id)
          setComments(prev => prev.filter(c => c.id !== id))
        }
      )
      .subscribe()

    async function load() {
      setLoading(true)
      setError(null)
      const { data: rows, error: cErr } = await supabase
        .from('task_comments')
        .select('*')
        .eq('task_id', taskId!)
        .order('created_at', { ascending: true })
      if (cancelled) return
      if (cErr) { setError(cErr.message); setLoading(false); return }
      if (!rows || rows.length === 0) { setComments([]); setLoading(false); return }

      const authorIds = [...new Set(rows.map(r => r.author_id as string))]
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', authorIds)
      if (cancelled) return

      const profileMap = new Map((profiles ?? []).map(p => [p.id as string, p]))
      const enriched = rows.map(r => ({
        id: r.id as string,
        task_id: r.task_id as string,
        author_id: r.author_id as string,
        body: r.body as string,
        created_at: r.created_at as string,
        updated_at: r.updated_at as string,
        author_display_name: profileMap.get(r.author_id)?.display_name ?? 'Unknown',
        author_avatar_url: profileMap.get(r.author_id)?.avatar_url ?? null,
      }))
      setComments(enriched)
      setLoading(false)
      // Cache raw rows (without profile fields) for offline reads
      void putComments(rows.map(r => ({
        id: r.id as string,
        task_id: r.task_id as string,
        author_id: r.author_id as string,
        body: r.body as string,
        created_at: r.created_at as string,
        updated_at: r.updated_at as string,
      })) as (TaskComment & { version?: number })[])
    }

    void load()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [taskId])

  return { comments, setComments, loading, error }
}
