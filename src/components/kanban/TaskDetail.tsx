import { useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useComments } from '../../hooks/useComments'
import type { Comment } from '../../hooks/useComments'
import { timeAgo } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { MemberProfile, Task } from '../../lib/types'
import Button from '../ui/Button'
import BottomSheet from '../ui/BottomSheet'
import styles from './TaskDetail.module.css'

const STATUS_LABELS: Record<Task['status'], string> = {
  backlog:     'Backlog',
  todo:        'To Do',
  in_progress: 'In Progress',
  done:        'Done',
}

const PRIORITY_LABELS: Record<Task['priority'], string> = {
  low:    'Low',
  medium: 'Medium',
  high:   'High',
  urgent: 'Urgent',
}

function initials(name: string): string {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
}

interface CommentItemProps {
  comment: Comment
  isOwn: boolean
  editingId: string | null
  editBody: string
  savingId: string | null
  onStartEdit: (c: Comment) => void
  onEditBodyChange: (v: string) => void
  onSave: (id: string) => void
  onCancelEdit: () => void
  onDelete: (id: string) => void
}

function CommentItem({
  comment, isOwn, editingId, editBody, savingId,
  onStartEdit, onEditBodyChange, onSave, onCancelEdit, onDelete,
}: CommentItemProps) {
  const isEditing = editingId === comment.id
  const isSaving = savingId === comment.id
  const wasEdited = comment.updated_at !== comment.created_at

  return (
    <div className={styles.comment}>
      <div className={styles.avatar} aria-hidden="true">
        {initials(comment.author_display_name)}
      </div>
      <div className={styles.commentMain}>
        <div className={styles.commentMeta}>
          <span className={styles.commentAuthor}>{comment.author_display_name}</span>
          <span className={styles.commentTime}>{timeAgo(comment.created_at)}</span>
          {wasEdited ? <span className={styles.commentEdited}>(edited)</span> : null}
        </div>

        {isEditing ? (
          <>
            <textarea
              className={styles.editTextarea}
              value={editBody}
              onChange={e => onEditBodyChange(e.target.value)}
              maxLength={10000}
              autoFocus
            />
            <div className={styles.editActions}>
              <button
                type="button"
                className={styles.saveBtn}
                disabled={isSaving || !editBody.trim()}
                onClick={() => onSave(comment.id)}
              >
                {isSaving ? 'Saving…' : 'Save'}
              </button>
              <button type="button" className={styles.cancelBtn} onClick={onCancelEdit}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <p className={styles.commentBody}>{comment.body}</p>
        )}

        {isOwn && !isEditing ? (
          <div className={styles.commentActions}>
            <button
              type="button"
              className={styles.commentActionBtn}
              onClick={() => onStartEdit(comment)}
            >
              Edit
            </button>
            <button
              type="button"
              className={`${styles.commentActionBtn} ${styles.deleteCommentBtn}`}
              onClick={() => onDelete(comment.id)}
            >
              Delete
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

interface Props {
  task: Task
  members: MemberProfile[]
  userId: string
  currentUserDisplayName: string
  currentUserAvatarUrl: string | null
  onClose: () => void
  onEdit: () => void
}

export default function TaskDetail({
  task, members, userId, currentUserDisplayName, currentUserAvatarUrl,
  onClose, onEdit,
}: Props) {
  const { comments, setComments, loading: commentsLoading, error: commentsError } = useComments(task.id)
  const assignee = members.find(m => m.user_id === task.assignee_id)

  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = body.trim()
    if (!trimmed) { setSubmitError('Comment cannot be empty.'); return }
    if (trimmed.length > 10000) { setSubmitError('Comment is too long (max 10 000 characters).'); return }
    setSubmitError(null)
    setSubmitting(true)
    const { data, error } = await supabase
      .from('task_comments')
      .insert({ task_id: task.id, author_id: userId, body: trimmed })
      .select()
      .single()
    setSubmitting(false)
    if (error) { setSubmitError(error.message); return }
    setComments(prev => [...prev, {
      id: data.id as string,
      task_id: data.task_id as string,
      author_id: data.author_id as string,
      body: data.body as string,
      created_at: data.created_at as string,
      updated_at: data.updated_at as string,
      author_display_name: currentUserDisplayName,
      author_avatar_url: currentUserAvatarUrl,
    }])
    setBody('')
  }

  function handleStartEdit(comment: Comment) {
    setEditingId(comment.id)
    setEditBody(comment.body)
  }

  async function handleEditSave(commentId: string) {
    const trimmed = editBody.trim()
    if (!trimmed) return
    setSavingId(commentId)
    const { data, error } = await supabase
      .from('task_comments')
      .update({ body: trimmed })
      .eq('id', commentId)
      .select()
      .single()
    setSavingId(null)
    if (error) return
    setComments(prev => prev.map(c =>
      c.id === commentId
        ? { ...c, body: data.body as string, updated_at: data.updated_at as string }
        : c
    ))
    setEditingId(null)
  }

  async function handleDelete(commentId: string) {
    if (!window.confirm('Delete this comment?')) return
    const previous = comments
    setComments(prev => prev.filter(c => c.id !== commentId))
    const { error } = await supabase.from('task_comments').delete().eq('id', commentId)
    if (error) setComments(previous)
  }

  return (
    <BottomSheet onClose={onClose} aria-labelledby="td-title">
      {/* Header */}
      <div className={styles.header}>
        <h2 id="td-title" className={styles.headerTitle}>{task.title}</h2>
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
      </div>

      {/* Status + priority chips */}
      <div className={styles.chips}>
        <span className={styles.chip}>{STATUS_LABELS[task.status]}</span>
        <span className={styles.chip} data-priority={task.priority}>
          {PRIORITY_LABELS[task.priority]}
        </span>
      </div>

      {/* Description */}
      {task.description
        ? <p className={styles.description}>{task.description}</p>
        : <p className={styles.noDescription}>No description</p>
      }

      {/* Assignee + due date */}
      {assignee ? (
        <div className={styles.metaRow}>
          <span className={styles.metaLabel}>Assignee</span>
          <span>{assignee.display_name}</span>
        </div>
      ) : null}
      {task.due_date ? (
        <div className={styles.metaRow}>
          <span className={styles.metaLabel}>Due date</span>
          <span>{new Date(task.due_date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</span>
        </div>
      ) : null}

      {/* Edit button */}
      <div className={styles.editBtn}>
        <Button variant="ghost" onClick={onEdit}>Edit task</Button>
      </div>

      <hr className={styles.commentsDivider} />
      <div className={styles.commentsHeading}>Comments</div>

      {commentsLoading ? (
        <p className={styles.commentsLoading}>Loading comments…</p>
      ) : commentsError ? (
        <p className={styles.commentsError}>{commentsError}</p>
      ) : comments.length === 0 ? (
        <p className={styles.commentsEmpty}>No comments yet. Be the first to leave one.</p>
      ) : (
        comments.map(c => (
          <CommentItem
            key={c.id}
            comment={c}
            isOwn={c.author_id === userId}
            editingId={editingId}
            editBody={editBody}
            savingId={savingId}
            onStartEdit={handleStartEdit}
            onEditBodyChange={setEditBody}
            onSave={handleEditSave}
            onCancelEdit={() => setEditingId(null)}
            onDelete={handleDelete}
          />
        ))
      )}

      {/* Comment input */}
      <form className={styles.commentForm} onSubmit={handleSubmit} noValidate>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Add a comment…"
          maxLength={10000}
          rows={2}
        />
        <div className={styles.formFooter}>
          <span className={styles.submitError}>{submitError ?? ''}</span>
          <Button type="submit" loading={submitting} disabled={!body.trim()}>
            Comment
          </Button>
        </div>
      </form>
    </BottomSheet>
  )
}
