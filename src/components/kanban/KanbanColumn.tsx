import { useState } from 'react'
import { Plus } from 'lucide-react'
import TaskCard from './TaskCard'
import styles from './KanbanColumn.module.css'
import type { MemberProfile, Task, TaskStatus } from '../../lib/types'

const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog:     'Backlog',
  todo:        'To Do',
  in_progress: 'In Progress',
  done:        'Done',
}

interface Props {
  status: TaskStatus
  tasks: Task[]
  members: MemberProfile[]
  draggingTaskId: string | null
  onDragStart: (taskId: string) => void
  onDragEnd: () => void
  onMoveTask: (taskId: string, newStatus: TaskStatus, insertIndex: number) => void
  onAddTask: () => void
  onEditTask: (task: Task) => void
  onDeleteTask: (taskId: string) => void
}

export default function KanbanColumn({
  status, tasks, members, draggingTaskId,
  onDragStart, onDragEnd, onMoveTask, onAddTask, onEditTask, onDeleteTask,
}: Props) {
  // dropIndex: where in this column's task list to insert the dragged task.
  // null = not dragging over this column.
  // A value n means "insert before tasks[n]" (n === tasks.length = append at end).
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  const isDragActive = draggingTaskId !== null
  const isDragOver = dropIndex !== null

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('task-id')
    if (!taskId) return
    onMoveTask(taskId, status, dropIndex ?? tasks.length)
    setDropIndex(null)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    // Fires when over column itself (not a task card, since cards stopPropagation).
    // Default to appending at the end.
    if (dropIndex === null) setDropIndex(tasks.length)
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDropIndex(null)
    }
  }

  function handleCardDragOver(taskIndex: number, half: 'top' | 'bottom') {
    setDropIndex(half === 'top' ? taskIndex : taskIndex + 1)
  }

  function handleStatusChange(taskId: string, newStatus: TaskStatus) {
    if (newStatus === status) return
    onMoveTask(taskId, newStatus, Number.MAX_SAFE_INTEGER)
  }

  return (
    <div
      className={`${styles.column} ${isDragActive && isDragOver ? styles.dragOver : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className={styles.header}>
        <span className={styles.statusLabel}>{STATUS_LABELS[status]}</span>
        <span className={styles.count}>{tasks.length}</span>
      </div>

      <div className={styles.cards}>
        {tasks.length === 0 ? (
          <div className={`${styles.emptyDrop} ${dropIndex === 0 ? styles.active : ''}`} />
        ) : (
          tasks.map((task, i) => (
            <TaskCard
              key={task.id}
              task={task}
              taskIndex={i}
              members={members}
              isDragging={task.id === draggingTaskId}
              dropLine={
                dropIndex === i ? 'above' :
                dropIndex === i + 1 && i === tasks.length - 1 ? 'below' :
                null
              }
              onDragStart={() => onDragStart(task.id)}
              onDragEnd={onDragEnd}
              onDragOver={handleCardDragOver}
              onStatusChange={newStatus => handleStatusChange(task.id, newStatus)}
              onClick={() => onEditTask(task)}
              onDelete={() => onDeleteTask(task.id)}
            />
          ))
        )}
      </div>

      <button type="button" className={styles.addBtn} onClick={onAddTask}>
        <Plus size={14} aria-hidden="true" />
        Add task
      </button>
    </div>
  )
}
