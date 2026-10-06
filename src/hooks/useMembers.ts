import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { MemberProfile } from '../lib/types'

export function useMembers(workspaceId: string) {
  const [members, setMembers] = useState<MemberProfile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!workspaceId) return
    let cancelled = false
    async function load() {
      const { data: memberRows } = await supabase
        .from('workspace_members')
        .select('user_id, role')
        .eq('workspace_id', workspaceId)
      if (cancelled) return
      if (!memberRows) { setLoading(false); return }

      const userIds = memberRows.map(m => m.user_id as string)
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', userIds)
      if (cancelled) return

      const profileMap = new Map((profileRows ?? []).map(p => [p.id, p]))
      setMembers(
        memberRows.map(m => ({
          user_id: m.user_id as string,
          role: m.role as MemberProfile['role'],
          display_name: profileMap.get(m.user_id)?.display_name ?? 'Unknown',
          avatar_url: profileMap.get(m.user_id)?.avatar_url ?? null,
        }))
      )
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [workspaceId])

  return { members, loading }
}
