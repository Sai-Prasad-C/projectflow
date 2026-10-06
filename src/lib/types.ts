export type WorkspaceRole = 'owner' | 'admin' | 'member'
export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface Workspace {
  id: string
  name: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: WorkspaceRole
  joined_at: string
}

export interface Project {
  id: string
  workspace_id: string
  name: string
  description: string | null
  created_by: string
  created_at: string
  updated_at: string
  archived_at: string | null
}

export interface ProjectWithTaskCount extends Project {
  tasks: [{ count: number }]
}

export interface Task {
  id: string
  project_id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  assignee_id: string | null
  due_date: string | null
  position: number
  created_by: string
  created_at: string
  updated_at: string
}

export interface MemberProfile {
  user_id: string
  role: WorkspaceRole
  display_name: string
  avatar_url: string | null
}

export interface TaskComment {
  id: string
  task_id: string
  author_id: string
  body: string
  created_at: string
  updated_at: string
}
