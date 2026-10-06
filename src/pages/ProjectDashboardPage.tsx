import { Navigate, useParams } from 'react-router-dom'

export default function ProjectDashboardPage() {
  const { workspaceId, projectId } = useParams<{ workspaceId: string; projectId: string }>()
  return <Navigate to={`/app/${workspaceId}/projects/${projectId}/board`} replace />
}
