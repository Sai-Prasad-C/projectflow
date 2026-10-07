import { useEffect, useRef, useState } from 'react'
import { Calendar, X } from 'lucide-react'
import Button from '../ui/Button'
import BottomSheet from '../ui/BottomSheet'
import styles from './TaskForm.module.css'
import type { MemberProfile, TaskPriority, TaskStatus } from '../../lib/types'

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'backlog',     label: 'Backlog' },
  { value: 'todo',        label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done',        label: 'Done' },
]

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'low',    label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

export interface TaskFormValues {
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  assignee_id: string | null
  due_date: string | null
}

interface Props {
  heading: string
  initial?: Partial<TaskFormValues>
  members: MemberProfile[]
  submitLabel: string
  onSubmit: (values: TaskFormValues) => Promise<string | null>
  onCancel: () => void
}

export default function TaskForm({
  heading,
  initial,
  members,
  submitLabel,
  onSubmit,
  onCancel,
}: Props) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [status, setStatus] = useState<TaskStatus>(initial?.status ?? 'backlog')
  const [priority, setPriority] = useState<TaskPriority>(initial?.priority ?? 'medium')
  const [assigneeId, setAssigneeId] = useState<string>(initial?.assignee_id ?? '')
  const [dueDate, setDueDate] = useState(initial?.due_date ?? '')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) { setError('Title is required.'); return }
    if (trimmed.length > 500) { setError('Title must be 500 characters or fewer.'); return }
    setError(null)
    setLoading(true)
    const err = await onSubmit({
      title: trimmed,
      description: description.trim(),
      status,
      priority,
      assignee_id: assigneeId || null,
      due_date: dueDate || null,
    })
    setLoading(false)
    if (err) setError(err)
  }

  return (
    <BottomSheet onClose={onCancel} aria-labelledby="tf-heading">
      <div className={styles.sheetHeader}>
        <h2 id="tf-heading" className={styles.heading}>{heading}</h2>
        <button type="button" className={styles.closeBtn} onClick={onCancel} aria-label="Close">
          <X size={18} />
        </button>
      </div>
      <form onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="tf-title">Title</label>
          <input
            id="tf-title"
            ref={titleRef}
            className={styles.input}
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={500}
            required
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="tf-desc">
            Description <span style={{ fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea
            id="tf-desc"
            className={styles.textarea}
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
          />
        </div>
        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="tf-status">Status</label>
            <select
              id="tf-status"
              className={styles.select}
              value={status}
              onChange={e => setStatus(e.target.value as TaskStatus)}
            >
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="tf-priority">Priority</label>
            <select
              id="tf-priority"
              className={styles.select}
              value={priority}
              onChange={e => setPriority(e.target.value as TaskPriority)}
            >
              {PRIORITY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="tf-assignee">Assignee</label>
            <select
              id="tf-assignee"
              className={styles.select}
              value={assigneeId}
              onChange={e => setAssigneeId(e.target.value)}
            >
              <option value="">Unassigned</option>
              {members.map(m => (
                <option key={m.user_id} value={m.user_id}>{m.display_name}</option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="tf-due">Due date</label>
            <div className={styles.dateWrapper}>
              <input
                id="tf-due"
                type="date"
                className={styles.input}
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
              />
              <Calendar size={16} className={styles.dateIcon} aria-hidden="true" />
            </div>
          </div>
        </div>
        {error ? <p className={styles.error}>{error}</p> : null}
        <div className={styles.actions}>
          <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button type="submit" loading={loading}>{submitLabel}</Button>
        </div>
      </form>
    </BottomSheet>
  )
}
