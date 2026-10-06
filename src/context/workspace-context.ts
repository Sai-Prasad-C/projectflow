import { createContext } from 'react'
import type { Workspace, WorkspaceRole } from '../lib/types'

export interface WorkspaceContextValue {
  workspace: Workspace
  memberRole: WorkspaceRole
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)
