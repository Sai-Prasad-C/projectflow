import { useContext } from 'react'
import { WorkspaceContext } from '../context/workspace-context'
import type { WorkspaceContextValue } from '../context/workspace-context'

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceLayout')
  return ctx
}
