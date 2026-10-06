import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderKanban, SquarePen, ArrowLeft, LayoutList, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useMembers } from '../../hooks/useMembers'
import BottomSheet from '../ui/BottomSheet'
import ProjectForm from '../project/ProjectForm'
import TaskForm from '../kanban/TaskForm'
import type { TaskFormValues } from '../kanban/TaskForm'
import type { Project } from '../../lib/types'
import Button from '../ui/Button'
import styles from './GlobalCreateSheet.module.css'

type Step = 'menu' | 'project-form' | 'pick-project' | 'task-form'

interface Props {
  workspaceId: string
  onClose: () => void
}

// ── Task create wrapper — needs useMembers hook ─────────────────────────
function TaskCreateFlow({ workspaceId, projectId, onClose, onBack }: {
  workspaceId: string
  projectId: string
  onClose: () => void
  onBack: () => void
}) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { members } = useMembers(workspaceId)

  async function handleCreate(values: TaskFormValues): Promise<string | null> {
    if (!user) return 'Not authenticated.'

    const { data: tail } = await supabase
      .from('tasks')
      .select('position')
      .eq('project_id', projectId)
      .eq('status', values.status)
      .order('position', { ascending: false })
      .limit(1)

    const position = (tail?.[0]?.position ?? 0) + 1000

    const { error } = await supabase
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

    if (error) return error.message
    onClose()
    navigate(`/app/${workspaceId}/projects/${projectId}/board`)
    return null
  }

  return (
    <TaskForm
      heading="New task"
      initial={{ status: 'todo' }}
      members={members}
      submitLabel="Create task"
      onSubmit={handleCreate}
      onCancel={onBack}
    />
  )
}

// ── Project create wrapper ──────────────────────────────────────────────
function ProjectCreateFlow({ workspaceId, onClose, onBack }: {
  workspaceId: string
  onClose: () => void
  onBack: () => void
}) {
  const { user } = useAuth()
  const navigate = useNavigate()

  async function handleCreate(name: string, description: string): Promise<string | null> {
    if (!user) return 'Not authenticated.'
    if (!navigator.onLine) return 'You appear to be offline. Connect to the internet to create a project.'

    const { data, error } = await supabase
      .from('projects')
      .insert({
        workspace_id: workspaceId,
        name,
        description: description || null,
        created_by: user.id,
      })
      .select('id')
      .single()

    if (error) return error.message
    onClose()
    navigate(`/app/${workspaceId}/projects/${data.id}/board`)
    return null
  }

  return (
    <ProjectForm
      heading="New project"
      submitLabel="Create project"
      onSubmit={handleCreate}
      onCancel={onBack}
    />
  )
}

// ── Main GlobalCreateSheet ──────────────────────────────────────────────
export default function GlobalCreateSheet({ workspaceId, onClose }: Props) {
  const [step, setStep] = useState<Step>('menu')
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (step !== 'pick-project') return
    let cancelled = false
    setLoadingProjects(true)
    supabase
      .from('projects')
      .select('id, workspace_id, name, description, created_by, created_at, updated_at, archived_at')
      .eq('workspace_id', workspaceId)
      .is('archived_at', null)
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        if (cancelled) return
        setProjects((data ?? []) as Project[])
        setLoadingProjects(false)
      })
    return () => { cancelled = true }
  }, [step, workspaceId])

  // ── Render project-form step via ProjectForm's own dialog ──────────
  if (step === 'project-form') {
    return (
      <ProjectCreateFlow
        workspaceId={workspaceId}
        onClose={onClose}
        onBack={() => setStep('menu')}
      />
    )
  }

  // ── Render task-form step via TaskForm's own BottomSheet ───────────
  if (step === 'task-form' && selectedProject) {
    return (
      <TaskCreateFlow
        workspaceId={workspaceId}
        projectId={selectedProject.id}
        onClose={onClose}
        onBack={() => setStep('pick-project')}
      />
    )
  }

  // ── Menu and project-picker both use a BottomSheet ─────────────────
  const title = step === 'pick-project' ? 'Choose a project' : 'Create'

  const filtered = search.trim()
    ? (projects ?? []).filter(p =>
        p.name.toLowerCase().includes(search.trim().toLowerCase())
      )
    : (projects ?? [])

  return (
    <BottomSheet onClose={onClose} aria-labelledby="gc-title">

      {/* Header */}
      <div className={styles.header}>
        {step === 'pick-project' ? (
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => { setStep('menu'); setSearch('') }}
            aria-label="Back"
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
        ) : null}
        <h2 id="gc-title" className={styles.title}>{title}</h2>
      </div>

      {/* ── Menu step ──────────────────────────────────────────────── */}
      {step === 'menu' && (
        <div className={styles.options}>
          <button
            type="button"
            className={styles.optionBtn}
            onClick={() => setStep('project-form')}
          >
            <div className={styles.optionIcon}>
              <FolderKanban size={22} aria-hidden="true" />
            </div>
            <div className={styles.optionText}>
              <span className={styles.optionLabel}>Create project</span>
              <span className={styles.optionDesc}>Start a new project in this workspace</span>
            </div>
          </button>

          <button
            type="button"
            className={styles.optionBtn}
            onClick={() => setStep('pick-project')}
          >
            <div className={styles.optionIcon}>
              <SquarePen size={22} aria-hidden="true" />
            </div>
            <div className={styles.optionText}>
              <span className={styles.optionLabel}>Create task</span>
              <span className={styles.optionDesc}>Add a task to a project</span>
            </div>
          </button>
        </div>
      )}

      {/* ── Project picker step ─────────────────────────────────────── */}
      {step === 'pick-project' && (
        <div className={styles.picker}>
          {/* Search — only show if there are enough projects */}
          {(projects?.length ?? 0) > 5 ? (
            <div className={styles.searchWrap}>
              <input
                className={styles.searchInput}
                type="search"
                placeholder="Search projects…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoComplete="off"
              />
            </div>
          ) : null}

          {loadingProjects ? (
            <div className={styles.pickerLoading}>
              {[1, 2, 3].map(i => <div key={i} className={styles.skeleton} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className={styles.emptyPicker}>
              {projects?.length === 0 ? (
                <>
                  <div className={styles.emptyIcon}><LayoutList size={28} /></div>
                  <p className={styles.emptyHeading}>No projects yet</p>
                  <p className={styles.emptyBody}>Create a project before adding tasks.</p>
                  <Button onClick={() => setStep('project-form')}>
                    <Plus size={15} />
                    Create project
                  </Button>
                </>
              ) : (
                <p className={styles.emptyBody}>No projects match your search.</p>
              )}
            </div>
          ) : (
            <div className={styles.projectList} role="list">
              {filtered.map(project => (
                <button
                  key={project.id}
                  type="button"
                  role="listitem"
                  className={styles.projectRow}
                  onClick={() => {
                    setSelectedProject(project)
                    setStep('task-form')
                  }}
                >
                  <div className={styles.projectIcon} aria-hidden="true">
                    <FolderKanban size={16} />
                  </div>
                  <span className={styles.projectName}>{project.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </BottomSheet>
  )
}
