import { Activity } from 'lucide-react'
import type { MemberProfile, Task } from '../../lib/types'
import Avatar from '../ui/Avatar'
import EmptyState from '../ui/EmptyState'
import styles from './ProjectActivityView.module.css'

interface ActivityEntry {
  task: Task
  type: 'created' | 'updated'
  timestamp: Date
}

// Tasks whose updated_at is within this threshold of created_at are treated as "created"
const UPDATE_THRESHOLD_MS = 10_000

function buildEntries(tasks: Task[]): ActivityEntry[] {
  return tasks
    .map(task => {
      const created = new Date(task.created_at).getTime()
      const updated = new Date(task.updated_at).getTime()
      const wasUpdated = updated - created > UPDATE_THRESHOLD_MS
      return {
        task,
        type: wasUpdated ? ('updated' as const) : ('created' as const),
        timestamp: new Date(wasUpdated ? task.updated_at : task.created_at),
      }
    })
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
}

function dateBucket(date: Date): string {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  if (d.getTime() === today.getTime()) return 'Today'
  if (d.getTime() === yesterday.getTime()) return 'Yesterday'
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

interface Props {
  tasks: Task[]
  members: MemberProfile[]
}

export default function ProjectActivityView({ tasks, members }: Props) {
  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={<Activity size={32} />}
        heading="No activity yet"
        body="Project activity will appear here as tasks are created and updated."
      />
    )
  }

  const entries = buildEntries(tasks)

  // Group by date bucket
  const groups: Array<{ label: string; entries: ActivityEntry[] }> = []
  for (const entry of entries) {
    const label = dateBucket(entry.timestamp)
    const last = groups[groups.length - 1]
    if (last?.label === label) {
      last.entries.push(entry)
    } else {
      groups.push({ label, entries: [entry] })
    }
  }

  return (
    <div className={styles.timeline}>
      {groups.map(group => (
        <div key={group.label} className={styles.group}>
          <div className={styles.dateLabel}>{group.label}</div>
          <div className={styles.entries}>
            {group.entries.map(entry => {
              const assignee = entry.task.assignee_id
                ? members.find(m => m.user_id === entry.task.assignee_id) ?? null
                : null
              return (
                <div key={entry.task.id + entry.type} className={styles.entry}>
                  <div className={styles.dot} aria-hidden="true" />
                  <div className={styles.content}>
                    <span className={styles.taskTitle}>{entry.task.title}</span>
                    <div className={styles.meta}>
                      {assignee && (
                        <Avatar
                          name={assignee.display_name}
                          src={assignee.avatar_url}
                          size="xs"
                        />
                      )}
                      <span className={styles.eventLabel}>
                        {entry.type === 'updated' ? 'Task updated' : 'Task created'}
                      </span>
                      <span className={styles.time}>{formatTime(entry.timestamp)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
