import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'
import { FolderKanban, LayoutGrid, LogOut, Plus } from 'lucide-react'
import { WorkspaceContext } from '../context/workspace-context'
import type { WorkspaceContextValue } from '../context/workspace-context'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import type { Workspace, WorkspaceRole } from '../lib/types'
import styles from './WorkspaceLayout.module.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'not_found' }
  | { status: 'ok'; workspace: Workspace; memberRole: WorkspaceRole }

export default function WorkspaceLayout() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    if (!workspaceId) {
      setState({ status: 'not_found' })
      return
    }
    let cancelled = false
    async function load() {
      const [wsResult, memberResult] = await Promise.all([
        supabase.from('workspaces').select('*').eq('id', workspaceId!).single(),
        supabase
          .from('workspace_members')
          .select('role')
          .eq('workspace_id', workspaceId!)
          .single(),
      ])
      if (cancelled) return
      if (wsResult.error || !wsResult.data) {
        setState({ status: 'not_found' })
        return
      }
      if (memberResult.error || !memberResult.data) {
        setState({ status: 'not_found' })
        return
      }
      setState({
        status: 'ok',
        workspace: wsResult.data as Workspace,
        memberRole: memberResult.data.role as WorkspaceRole,
      })
    }
    void load()
    return () => { cancelled = true }
  }, [workspaceId])

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  if (state.status === 'loading') {
    return (
      <div className={styles.center}>
        <span className={styles.loadingText}>Loading…</span>
      </div>
    )
  }

  if (state.status === 'not_found' || state.status === 'error') {
    return (
      <div className={styles.center}>
        <p className={styles.loadingText}>
          {state.status === 'error' ? state.message : "Workspace not found or you don't have access."}
        </p>
      </div>
    )
  }

  const ctx: WorkspaceContextValue = {
    workspace: state.workspace,
    memberRole: state.memberRole,
  }

  const projectsHref = `/app/${state.workspace.id}/projects`
  const avatarChar = (user?.email?.[0] ?? '?').toUpperCase()

  return (
    <WorkspaceContext.Provider value={ctx}>
      <div className={styles.layout}>

        {/* ── Desktop sidebar ──────────────────────────────────── */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <Link to={projectsHref} className={styles.brand}>
              <FolderKanban size={18} aria-hidden="true" />
              ProjectFlow
            </Link>
            <div className={styles.workspaceName}>{state.workspace.name}</div>
          </div>

          <nav className={styles.sidebarNav} aria-label="Main navigation">
            <NavLink
              to={projectsHref}
              className={({ isActive }) =>
                `${styles.navItem}${isActive ? ` ${styles.navItemActive}` : ''}`
              }
            >
              <LayoutGrid size={16} aria-hidden="true" />
              Projects
            </NavLink>
          </nav>

          <div className={styles.sidebarFooter}>
            <div className={styles.userRow}>
              <div className={styles.userAvatar} aria-hidden="true">{avatarChar}</div>
              <span className={styles.userEmail}>{user?.email}</span>
            </div>
            <button type="button" className={styles.signOutBtn} onClick={handleSignOut}>
              <LogOut size={14} aria-hidden="true" />
              Sign out
            </button>
          </div>
        </aside>

        {/* ── Mobile top bar ───────────────────────────────────── */}
        <header className={styles.topBar}>
          <Link to={projectsHref} className={styles.brand}>
            <FolderKanban size={18} aria-hidden="true" />
            ProjectFlow
          </Link>
          <span className={styles.topBarWorkspace}>{state.workspace.name}</span>
          <button type="button" className={styles.topBarSignOut} onClick={handleSignOut} aria-label="Sign out">
            <LogOut size={18} />
          </button>
        </header>

        {/* ── Main content ─────────────────────────────────────── */}
        <main className={styles.main}>
          <Outlet />
        </main>

        {/* ── Mobile floating pill bottom nav ──────────────────── */}
        <nav className={styles.bottomNav} aria-label="Main navigation">
          <div className={styles.pill}>
            <NavLink
              to={projectsHref}
              className={({ isActive }) =>
                `${styles.pillItem}${isActive ? ` ${styles.pillItemActive}` : ''}`
              }
            >
              <LayoutGrid size={20} aria-hidden="true" />
              <span className={styles.pillLabel}>Projects</span>
            </NavLink>

            <Link to={projectsHref} className={styles.fab} aria-label="New project">
              <Plus size={22} strokeWidth={2.5} />
            </Link>
          </div>
        </nav>

      </div>
    </WorkspaceContext.Provider>
  )
}
