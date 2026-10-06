import KanbanColumn from './KanbanColumn'
import styles from './KanbanBoard.module.css'
import type { MemberProfile, Task, TaskStatus } from '../../lib/types'

const STATUSES: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'done']

interface Props {
  tasks: Task[]
  members: MemberProfile[]
  draggingTaskId: string | null
  onDragStart: (taskId: string) => void
  onDragEnd: () => void
  onMoveTask: (taskId: string, newStatus: TaskStatus, insertIndex: number) => void
  onAddTask: (status: TaskStatus) => void
  onEditTask: (task: Task) => void
  onDeleteTask: (taskId: string) => void
}

export default function KanbanBoard({
  tasks, members, draggingTaskId,
  onDragStart, onDragEnd, onMoveTask, onAddTask, onEditTask, onDeleteTask,
}: Props) {
  return (
    <div className={styles.board}>
      {STATUSES.map(status => (
        <KanbanColumn
          key={status}
          status={status}
          tasks={tasks
            .filter(t => t.status === status)
            .sort((a, b) => a.position - b.position)}
          members={members}
          draggingTaskId={draggingTaskId}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onMoveTask={onMoveTask}
          onAddTask={() => onAddTask(status)}
          onEditTask={onEditTask}
          onDeleteTask={onDeleteTask}
        />
      ))}
    </div>
  )
}
