import styles from './TaskCard.module.css'
import type { MemberProfile, Task, TaskStatus } from '../../lib/types'

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'backlog',     label: 'Backlog' },
  { value: 'todo',        label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done',        label: 'Done' },
]

interface Props {
  task: Task
  taskIndex: number
  members: MemberProfile[]
  isDragging: boolean
  dropLine: 'above' | 'below' | null
  onDragStart: () => void
  onDragEnd: () => void
  onDragOver: (index: number, half: 'top' | 'bottom') => void
  onStatusChange: (newStatus: TaskStatus) => void
  onClick: () => void
  onDelete: () => void
}

function initials(name: string): string {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
}

function formatDue(dateStr: string): { label: string; overdue: boolean } {
  const due = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000)
  const overdue = diff < 0
  if (diff === 0) return { label: 'Today', overdue: false }
  if (diff === 1) return { label: 'Tomorrow', overdue: false }
  if (diff === -1) return { label: 'Yesterday', overdue: true }
  if (Math.abs(diff) < 7) return { label: `${Math.abs(diff)}d ${diff < 0 ? 'ago' : ''}`.trim(), overdue }
  return { label: due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), overdue }
}

export default function TaskCard({
  task, taskIndex, members, isDragging, dropLine,
  onDragStart, onDragEnd, onDragOver, onStatusChange, onClick, onDelete,
}: Props) {
  const assignee = members.find(m => m.user_id === task.assignee_id)
  const due = task.due_date ? formatDue(task.due_date) : null

  function handleDragStart(e: React.DragEvent<HTMLDivElement>) {
    e.dataTransfer.setData('task-id', task.id)
    e.dataTransfer.effectAllowed = 'move'
    onDragStart()
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const half: 'top' | 'bottom' = e.clientY < rect.top + rect.height / 2 ? 'top' : 'bottom'
    onDragOver(taskIndex, half)
  }

  function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    e.stopPropagation()
    onStatusChange(e.target.value as TaskStatus)
  }

  function handleDeleteClick(e: React.MouseEvent) {
    e.stopPropagation()
    onDelete()
  }

  const cls = [
    styles.card,
    isDragging ? styles.dragging : '',
    dropLine === 'above' ? styles.dropAbove : '',
    dropLine === 'below' ? styles.dropBelow : '',
  ].filter(Boolean).join(' ')

  return (
    <div
      className={cls}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onDragOver={handleDragOver}
      onClick={onClick}
    >
      <div className={styles.title}>{task.title}</div>
      <div className={styles.meta}>
        <span className={styles.priorityDot} data-priority={task.priority} title={task.priority} />
        {due ? (
          <span className={`${styles.chip} ${due.overdue ? styles.overdue : ''}`}>
            {due.label}
          </span>
        ) : null}
        {assignee ? (
          <span className={styles.avatar} title={assignee.display_name}>
            {initials(assignee.display_name)}
          </span>
        ) : null}
      </div>
      <div className={styles.actions} onClick={e => e.stopPropagation()}>
        <select
          className={styles.statusSelect}
          value={task.status}
          onChange={handleStatusChange}
          aria-label="Move to status"
        >
          {STATUS_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button
          type="button"
          className={`${styles.iconBtn} ${styles.deleteBtn}`}
          title="Delete task"
          onClick={handleDeleteClick}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
