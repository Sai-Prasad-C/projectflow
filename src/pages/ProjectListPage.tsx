import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { LayoutGrid, Plus } from 'lucide-react'
import ProjectCard from '../components/project/ProjectCard'
import ProjectForm from '../components/project/ProjectForm'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import { supabase } from '../lib/supabase'
import type { ProjectWithTaskCount } from '../lib/types'
import styles from './ProjectListPage.module.css'

export default function ProjectListPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const [projects, setProjects] = useState<ProjectWithTaskCount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    if (!workspaceId) return
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('projects')
        .select('*, tasks(count)')
        .eq('workspace_id', workspaceId!)
        .is('archived_at', null)
        .order('updated_at', { ascending: false })
      if (cancelled) return
      if (error) setError(error.message)
      else setProjects((data ?? []) as ProjectWithTaskCount[])
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [workspaceId])

  async function handleCreate(name: string, description: string): Promise<string | null> {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return 'Not authenticated.'

    const { data, error } = await supabase
      .from('projects')
      .insert({
        workspace_id: workspaceId!,
        name,
        description: description || null,
        created_by: userData.user.id,
      })
      .select('*, tasks(count)')
      .single()

    if (error) return error.message
    setProjects(prev => [data as ProjectWithTaskCount, ...prev])
    setShowCreate(false)
    return null
  }

  if (loading) {
    return (
      <>
        <div className={styles.header}>
          <h1 className={styles.title}>Projects</h1>
        </div>
        <div className={styles.grid}>
          {[1, 2, 3].map(i => <div key={i} className={styles.skeleton} />)}
        </div>
      </>
    )
  }

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Projects</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} aria-hidden="true" />
          New project
        </Button>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      {!error && projects.length === 0 ? (
        <EmptyState
          icon={<LayoutGrid size={40} strokeWidth={1.5} />}
          heading="No projects yet"
          body="Create your first project to start managing tasks with your team."
          action={
            <Button onClick={() => setShowCreate(true)}>
              <Plus size={16} aria-hidden="true" />
              New project
            </Button>
          }
        />
      ) : (
        <div className={styles.grid}>
          {projects.map(p => (
            <ProjectCard key={p.id} project={p} workspaceId={workspaceId!} />
          ))}
        </div>
      )}

      {showCreate ? (
        <ProjectForm
          heading="New project"
          submitLabel="Create project"
          onSubmit={handleCreate}
          onCancel={() => setShowCreate(false)}
        />
      ) : null}
    </>
  )
}
