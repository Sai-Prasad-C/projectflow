import { Link } from 'react-router-dom'
import type { ProjectWithTaskCount } from '../../lib/types'
import styles from './ProjectCard.module.css'

interface Props {
  project: ProjectWithTaskCount
  workspaceId: string
}

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export default function ProjectCard({ project, workspaceId }: Props) {
  const taskCount = project.tasks[0]?.count ?? 0

  return (
    <Link
      to={`/app/${workspaceId}/projects/${project.id}`}
      className={styles.card}
    >
      <div className={styles.name}>{project.name}</div>
      <div className={styles.description}>
        {project.description ?? <span style={{ fontStyle: 'italic', opacity: 0.6 }}>No description</span>}
      </div>
      <div className={styles.meta}>
        <span className={styles.taskCount}>{taskCount} {taskCount === 1 ? 'task' : 'tasks'}</span>
        <span className={styles.metaDot}>·</span>
        <span>Updated {formatRelative(project.updated_at)}</span>
      </div>
    </Link>
  )
}
