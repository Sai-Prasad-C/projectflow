import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Kanban } from 'lucide-react'
import ProjectForm from '../components/project/ProjectForm'
import Button from '../components/ui/Button'
import { useWorkspace } from '../hooks/useWorkspace'
import { supabase } from '../lib/supabase'
import type { Project } from '../lib/types'
import styles from './ProjectDashboardPage.module.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'not_found' }
  | { status: 'ok'; project: Project }

export default function ProjectDashboardPage() {
  const { workspaceId, projectId } = useParams<{ workspaceId: string; projectId: string }>()
  const { memberRole } = useWorkspace()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [showEdit, setShowEdit] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const canManage = memberRole === 'owner' || memberRole === 'admin'

  useEffect(() => {
    if (!projectId) {
      setState({ status: 'not_found' })
      return
    }
    let cancelled = false
    async function load() {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId!)
        .eq('workspace_id', workspaceId!)
        .single()
      if (cancelled) return
      if (error || !data) {
        setState({ status: 'not_found' })
        return
      }
      setState({ status: 'ok', project: data as Project })
    }
    void load()
    return () => { cancelled = true }
  }, [projectId, workspaceId])

  async function handleEdit(name: string, description: string): Promise<string | null> {
    if (state.status !== 'ok') return null
    const { data, error } = await supabase
      .from('projects')
      .update({ name, description: description || null })
      .eq('id', state.project.id)
      .select()
      .single()
    if (error) return error.message
    setState({ status: 'ok', project: data as Project })
    setShowEdit(false)
    return null
  }

  async function handleArchive() {
    if (state.status !== 'ok') return
    if (!window.confirm(`Archive "${state.project.name}"? It will no longer appear in the project list.`)) return
    setArchiving(true)
    setActionError(null)
    const { data, error } = await supabase
      .from('projects')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', state.project.id)
      .select()
      .single()
    setArchiving(false)
    if (error) {
      setActionError(error.message)
      return
    }
    setState({ status: 'ok', project: data as Project })
  }

  async function handleUnarchive() {
    if (state.status !== 'ok') return
    setArchiving(true)
    setActionError(null)
    const { data, error } = await supabase
      .from('projects')
      .update({ archived_at: null })
      .eq('id', state.project.id)
      .select()
      .single()
    setArchiving(false)
    if (error) {
      setActionError(error.message)
      return
    }
    setState({ status: 'ok', project: data as Project })
  }

  if (state.status === 'loading') {
    return <div style={{ color: 'var(--color-text-2)', fontSize: 14 }}>Loading…</div>
  }

  if (state.status === 'not_found') {
    return (
      <div className={styles.notFound}>
        <p className={styles.notFoundTitle}>Project not found</p>
        <p className={styles.notFoundText}>This project doesn't exist or you don't have access.</p>
        <Link to={`/app/${workspaceId}/projects`} className={styles.back}>
          ← Back to projects
        </Link>
      </div>
    )
  }

  const { project } = state
  const isArchived = project.archived_at !== null

  return (
    <>
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <Link to={`/app/${workspaceId}/projects`} className={styles.breadcrumb}>
            <ArrowLeft size={14} aria-hidden="true" />
            Projects
          </Link>
          <h1 className={styles.title}>{project.name}</h1>
          {isArchived ? <span className={styles.archivedBadge}>Archived</span> : null}
        </div>
      </div>

      {project.description ? (
        <p className={styles.description}>{project.description}</p>
      ) : (
        <p className={styles.noDescription}>No description</p>
      )}

      {canManage ? (
        <div className={styles.actions}>
          {!isArchived ? (
            <Button variant="ghost" onClick={() => setShowEdit(true)}>
              Edit
            </Button>
          ) : null}
          {isArchived ? (
            <Button variant="ghost" loading={archiving} onClick={handleUnarchive}>
              Unarchive
            </Button>
          ) : (
            <Button variant="danger" loading={archiving} onClick={handleArchive}>
              Archive
            </Button>
          )}
        </div>
      ) : null}

      {actionError ? <p className={styles.error}>{actionError}</p> : null}

      <hr className={styles.divider} />

      <Link
        to={`/app/${workspaceId}/projects/${project.id}/board`}
        className={styles.boardLink}
      >
        <Kanban size={16} aria-hidden="true" />
        Open board
      </Link>

      {showEdit ? (
        <ProjectForm
          heading="Edit project"
          initialName={project.name}
          initialDescription={project.description ?? ''}
          submitLabel="Save changes"
          onSubmit={handleEdit}
          onCancel={() => setShowEdit(false)}
        />
      ) : null}
    </>
  )
}
