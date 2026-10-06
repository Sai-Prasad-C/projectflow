import { LayoutList, Plus } from 'lucide-react'
import type { MemberProfile, Task, TaskPriority, TaskStatus } from '../../lib/types'
import Avatar from '../ui/Avatar'
import EmptyState from '../ui/EmptyState'
import Button from '../ui/Button'
import styles from './TaskListView.module.css'

const STATUS_LABEL: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
}

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}

interface Props {
  tasks: Task[]
  members: MemberProfile[]
  onTaskClick: (task: Task) => void
  onAddTask: () => void
}

function formatDue(dateStr: string): { label: string; overdue: boolean } {
  const due = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return { label: 'Today', overdue: false }
  if (diff === -1) return { label: 'Yesterday', overdue: true }
  if (diff < 0) return { label: due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), overdue: true }
  if (diff === 1) return { label: 'Tomorrow', overdue: false }
  return { label: due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), overdue: false }
}

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    // Done tasks to the bottom
    const aDone = a.status === 'done' ? 1 : 0
    const bDone = b.status === 'done' ? 1 : 0
    if (aDone !== bDone) return aDone - bDone
    // Tasks with due dates before tasks without
    if (a.due_date && !b.due_date) return -1
    if (!a.due_date && b.due_date) return 1
    if (a.due_date && b.due_date) {
      const diff = new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      if (diff !== 0) return diff
    }
    // Fall back to position
    return a.position - b.position
  })
}

export default function TaskListView({ tasks, members, onTaskClick, onAddTask }: Props) {
  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={<LayoutList size={32} />}
        heading="No tasks yet"
        body="Create your first task to get this project moving."
        action={
          <Button onClick={onAddTask}>
            <Plus size={15} />
            Add task
          </Button>
        }
      />
    )
  }

  const sorted = sortTasks(tasks)

  return (
    <div className={styles.list}>
      {/* Desktop header row */}
      <div className={styles.headerRow} aria-hidden="true">
        <span className={styles.colTitle}>Task</span>
        <span className={styles.colStatus}>Status</span>
        <span className={styles.colPriority}>Priority</span>
        <span className={styles.colAssignee}>Assignee</span>
        <span className={styles.colDue}>Due</span>
      </div>

      {sorted.map(task => {
        const assignee = members.find(m => m.user_id === task.assignee_id) ?? null
        const due = task.due_date ? formatDue(task.due_date) : null

        return (
          <button
            key={task.id}
            type="button"
            className={`${styles.row} ${task.status === 'done' ? styles.rowDone : ''}`}
            onClick={() => onTaskClick(task)}
          >
            {/* Title — always shown */}
            <span className={styles.title}>{task.title}</span>

            {/* On desktop: display:contents lets these span into grid columns.
                On mobile: becomes a flex row of chips. */}
            <div className={styles.meta}>
              <span className={`${styles.status} ${styles[task.status]}`}>
                {STATUS_LABEL[task.status]}
              </span>

              <span className={styles.priority}>
                <span className={styles.priorityDot} data-priority={task.priority} />
                <span className={styles.priorityLabel}>{PRIORITY_LABEL[task.priority]}</span>
              </span>

              <span className={styles.assignee}>
                {assignee ? (
                  <>
                    <Avatar name={assignee.display_name} src={assignee.avatar_url} size="xs" />
                    <span className={styles.assigneeName}>{assignee.display_name}</span>
                  </>
                ) : null}
              </span>

              <span className={`${styles.due} ${due?.overdue ? styles.overdue : ''}`}>
                {due ? due.label : null}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
