import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Settings, Users, Plus } from 'lucide-react'
import KanbanBoard from '../components/kanban/KanbanBoard'
import TaskDetail from '../components/kanban/TaskDetail'
import TaskForm from '../components/kanban/TaskForm'
import TaskListView from '../components/kanban/TaskListView'
import ProjectActivityView from '../components/kanban/ProjectActivityView'
import ProjectForm from '../components/project/ProjectForm'
import type { TaskFormValues } from '../components/kanban/TaskForm'
import { useAuth } from '../hooks/useAuth'
import { useMembers } from '../hooks/useMembers'
import { useTasks } from '../hooks/useTasks'
import { useWorkspace } from '../hooks/useWorkspace'
import { supabase } from '../lib/supabase'
import type { Project, Task, TaskStatus } from '../lib/types'
import BottomSheet from '../components/ui/BottomSheet'
import MemberList from '../components/workspace/MemberList'
import styles from './KanbanPage.module.css'

function getTodayMidnight() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

type Tab = 'board' | 'list' | 'activity'

type EditModal =
  | { mode: 'create'; defaultStatus: TaskStatus }
  | { mode: 'edit'; task: Task }
  | null

export default function KanbanPage() {
  const { workspaceId, projectId } = useParams<{ workspaceId: string; projectId: string }>()
  const { user } = useAuth()
  const { workspace, memberRole } = useWorkspace()
  const { members } = useMembers(workspaceId!)
  const { tasks, setTasks, loading, error: loadError } = useTasks(projectId!)

  const [project, setProject] = useState<Project | null>(null)
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null)
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null)
  const [editModal, setEditModal] = useState<EditModal>(null)
  const [moveError, setMoveError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('board')
  const [showMembers, setShowMembers] = useState(false)
  const [showProjectEdit, setShowProjectEdit] = useState(false)

  const canManage = memberRole === 'owner' || memberRole === 'admin'

  const detailTask = detailTaskId ? (tasks.find(t => t.id === detailTaskId) ?? null) : null
  const currentMember = members.find(m => m.user_id === user?.id)
  const currentUserDisplayName = currentMember?.display_name ?? user?.email ?? 'You'
  const currentUserAvatarUrl = currentMember?.avatar_url ?? null

  // Derived stats from already-fetched tasks
  const totalTasks = tasks.length
  const doneTasks = tasks.filter(t => t.status === 'done').length
  const openTasks = tasks.filter(t => t.status !== 'done').length
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0
  const today = useMemo(() => getTodayMidnight(), [])
  const dueSoon = tasks.filter(t => {
    if (!t.due_date || t.status === 'done') return false
    const due = new Date(t.due_date)
    const diff = Math.round((due.getTime() - today.getTime()) / 86400000)
    return diff >= 0 && diff <= 7
  }).length

  useEffect(() => {
    if (!projectId || !workspaceId) return
    let cancelled = false
    supabase
      .from('projects')
      .select('id, workspace_id, name, description, created_by, created_at, updated_at, archived_at')
      .eq('id', projectId)
      .eq('workspace_id', workspaceId)
      .single()
      .then(({ data }) => {
        if (!cancelled && data) setProject(data as Project)
      })
    return () => { cancelled = true }
  }, [projectId, workspaceId])

  useEffect(() => {
    if (detailTaskId && !tasks.find(t => t.id === detailTaskId)) {
      setDetailTaskId(null)
    }
  }, [tasks, detailTaskId])

  function computePosition(destTasks: Task[], insertIndex: number): number {
    const clamped = Math.min(Math.max(0, insertIndex), destTasks.length)
    if (destTasks.length === 0) return 1000
    if (clamped === 0) return destTasks[0].position - 1000
    if (clamped >= destTasks.length) return destTasks[destTasks.length - 1].position + 1000
    return (destTasks[clamped - 1].position + destTasks[clamped].position) / 2
  }

  async function handleCreateTask(values: TaskFormValues): Promise<string | null> {
    if (!projectId || !user) return 'Not authenticated.'
    const destTasks = tasks
      .filter(t => t.status === values.status)
      .sort((a, b) => a.position - b.position)
    const position = computePosition(destTasks, destTasks.length)

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        project_id: projectId,
        title: values.title,
        description: values.description || null,
        status: values.status,
        priority: values.priority,
        assignee_id: values.assignee_id,
        due_date: values.due_date,
        position,
        created_by: user.id,
      })
      .select()
      .single()
    if (error) return error.message
    setTasks(prev => [...prev, data as Task])
    setEditModal(null)
    return null
  }

  async function handleEditTask(taskId: string, values: TaskFormValues): Promise<string | null> {
    const { data, error } = await supabase
      .from('tasks')
      .update({
        title: values.title,
        description: values.description || null,
        status: values.status,
        priority: values.priority,
        assignee_id: values.assignee_id,
        due_date: values.due_date,
      })
      .eq('id', taskId)
      .select()
      .single()
    if (error) return error.message
    setTasks(prev => prev.map(t => t.id === taskId ? data as Task : t))
    setEditModal(null)
    return null
  }

  function handleMoveTask(taskId: string, newStatus: TaskStatus, insertIndex: number) {
    const srcTask = tasks.find(t => t.id === taskId)
    if (!srcTask) return

    const destTasks = tasks
      .filter(t => t.status === newStatus && t.id !== taskId)
      .sort((a, b) => a.position - b.position)

    if (srcTask.status === newStatus) {
      const colTasks = tasks
        .filter(t => t.status === newStatus)
        .sort((a, b) => a.position - b.position)
      const srcIdx = colTasks.findIndex(t => t.id === taskId)
      const adjInsert = insertIndex > srcIdx ? insertIndex - 1 : insertIndex
      if (adjInsert === srcIdx) return
    }

    const newPosition = computePosition(destTasks, insertIndex)
    const previousTasks = tasks

    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, status: newStatus, position: newPosition } : t
    ))
    setMoveError(null)

    supabase
      .from('tasks')
      .update({ status: newStatus, position: newPosition })
      .eq('id', taskId)
      .then(({ error }) => {
        if (error) {
          setTasks(previousTasks)
          setMoveError(error.message)
        }
      })
  }

  async function handleDeleteTask(taskId: string) {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return
    if (!window.confirm(`Delete "${task.title}"? This cannot be undone.`)) return
    const previousTasks = tasks
    setTasks(prev => prev.filter(t => t.id !== taskId))
    const { error } = await supabase.from('tasks').delete().eq('id', taskId)
    if (error) {
      setTasks(previousTasks)
      setMoveError(error.message)
    }
  }

  async function handleModalSubmit(values: TaskFormValues): Promise<string | null> {
    if (!editModal) return null
    if (editModal.mode === 'create') return handleCreateTask(values)
    return handleEditTask(editModal.task.id, values)
  }

  async function handleEditProject(name: string, description: string): Promise<string | null> {
    if (!project) return null
    const { data, error } = await supabase
      .from('projects')
      .update({ name, description: description || null })
      .eq('id', project.id)
      .select()
      .single()
    if (error) return error.message
    setProject(data as Project)
    setShowProjectEdit(false)
    return null
  }

  if (loading) return <p className={styles.loading}>Loading…</p>

  const isArchived = project?.archived_at !== null && project?.archived_at !== undefined

  return (
    <>
      {/* ── Project header ─────────────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.breadcrumb}>
          <Link to={`/app/${workspaceId}/projects`} className={styles.backLink}>
            <ArrowLeft size={14} aria-hidden="true" />
            Projects
          </Link>
        </div>

        <div className={styles.titleRow}>
          <div className={styles.titleGroup}>
            <h1 className={styles.projectTitle}>
              {project?.name ?? 'Board'}
              {isArchived ? <span className={styles.archivedBadge}>Archived</span> : null}
            </h1>
            <p className={styles.projectSub}>
              {workspace.name}{members.length > 0 ? ` · ${members.length} member${members.length !== 1 ? 's' : ''}` : ''}
            </p>
          </div>
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => setShowMembers(true)}
              aria-label="Members"
            >
              <Users size={16} aria-hidden="true" />
              <span className={styles.btnLabel}>Members</span>
            </button>
            {canManage ? (
              <button
                type="button"
                className={styles.iconBtn}
                onClick={() => setShowProjectEdit(true)}
                aria-label="Project settings"
              >
                <Settings size={16} aria-hidden="true" />
              </button>
            ) : null}
            <button
              type="button"
              className={styles.newTaskBtn}
              onClick={() => setEditModal({ mode: 'create', defaultStatus: 'todo' })}
            >
              <Plus size={15} strokeWidth={2.5} aria-hidden="true" />
              New task
            </button>
          </div>
        </div>
      </div>

      {/* ── Stats strip ────────────────────────────────────── */}
      {totalTasks > 0 ? (
        <div className={styles.stats}>
          <div className={`${styles.statCard} ${styles.statHero}`}>
            <div className={styles.statLabel}>Progress</div>
            <div className={styles.statBig}>{progress}%</div>
            <div className={styles.progressBar}>
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Open</div>
            <div className={styles.statBig}>{openTasks}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Due soon</div>
            <div className={styles.statBig}>{dueSoon}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Members</div>
            <div className={styles.statBig}>{members.length}</div>
          </div>
        </div>
      ) : null}

      {/* ── Tab nav ────────────────────────────────────────── */}
      <div className={styles.tabs} role="tablist">
        {(['board', 'list', 'activity'] as Tab[]).map(tab => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {loadError ? <p className={styles.error}>{loadError}</p> : null}
      {moveError ? <p className={styles.error}>{moveError}</p> : null}

      {/* ── Board ──────────────────────────────────────────── */}
      {activeTab === 'board' && (
        <div className={styles.boardWrap}>
          <KanbanBoard
            tasks={tasks}
            members={members}
            draggingTaskId={draggingTaskId}
            onDragStart={setDraggingTaskId}
            onDragEnd={() => setDraggingTaskId(null)}
            onMoveTask={handleMoveTask}
            onAddTask={status => setEditModal({ mode: 'create', defaultStatus: status })}
            onEditTask={task => setDetailTaskId(task.id)}
            onDeleteTask={handleDeleteTask}
          />
        </div>
      )}

      {/* ── List ───────────────────────────────────────────── */}
      {activeTab === 'list' && (
        <div className={styles.listWrap}>
          <TaskListView
            tasks={tasks}
            members={members}
            onTaskClick={task => setDetailTaskId(task.id)}
            onAddTask={() => setEditModal({ mode: 'create', defaultStatus: 'todo' })}
          />
        </div>
      )}

      {/* ── Activity ───────────────────────────────────────── */}
      {activeTab === 'activity' && (
        <div className={styles.activityWrap}>
          <ProjectActivityView tasks={tasks} members={members} />
        </div>
      )}

      {detailTask ? (
        <TaskDetail
          task={detailTask}
          members={members}
          userId={user!.id}
          currentUserDisplayName={currentUserDisplayName}
          currentUserAvatarUrl={currentUserAvatarUrl}
          onClose={() => setDetailTaskId(null)}
          onEdit={() => setEditModal({ mode: 'edit', task: detailTask })}
        />
      ) : null}

      {editModal ? (
        <TaskForm
          heading={editModal.mode === 'create' ? 'New task' : 'Edit task'}
          initial={
            editModal.mode === 'create'
              ? { status: editModal.defaultStatus }
              : {
                  title: editModal.task.title,
                  description: editModal.task.description ?? '',
                  status: editModal.task.status,
                  priority: editModal.task.priority,
                  assignee_id: editModal.task.assignee_id,
                  due_date: editModal.task.due_date,
                }
          }
          members={members}
          submitLabel={editModal.mode === 'create' ? 'Create task' : 'Save changes'}
          onSubmit={handleModalSubmit}
          onCancel={() => setEditModal(null)}
        />
      ) : null}

      {showMembers ? (
        <BottomSheet onClose={() => setShowMembers(false)} aria-labelledby="members-title">
          <MemberList workspaceId={workspaceId!} onClose={() => setShowMembers(false)} />
        </BottomSheet>
      ) : null}

      {showProjectEdit && project ? (
        <ProjectForm
          heading="Edit project"
          initialName={project.name}
          initialDescription={project.description ?? ''}
          submitLabel="Save changes"
          onSubmit={handleEditProject}
          onCancel={() => setShowProjectEdit(false)}
        />
      ) : null}
    </>
  )
}
