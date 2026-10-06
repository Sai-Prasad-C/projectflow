import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'
import { BarChart2, FolderKanban, LayoutGrid, LogOut, Plus, User, Users } from 'lucide-react'
import { WorkspaceContext } from '../context/workspace-context'
import type { WorkspaceContextValue } from '../context/workspace-context'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import type { Workspace, WorkspaceRole } from '../lib/types'
import BottomSheet from '../components/ui/BottomSheet'
import MemberList from '../components/workspace/MemberList'
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
  const [showMembers, setShowMembers] = useState(false)

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

  const projectsHref  = `/app/${state.workspace.id}/projects`
  const insightsHref  = `/app/${state.workspace.id}/insights`
  const profileHref   = `/app/${state.workspace.id}/profile`
  const avatarChar    = (user?.email?.[0] ?? '?').toUpperCase()

  function navClass({ isActive }: { isActive: boolean }) {
    return [styles.navItem, isActive ? styles.navItemActive : ''].filter(Boolean).join(' ')
  }

  function pillClass({ isActive }: { isActive: boolean }) {
    return [styles.pillItem, isActive ? styles.pillItemActive : ''].filter(Boolean).join(' ')
  }

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
            <NavLink to={projectsHref} className={navClass}>
              <LayoutGrid size={16} aria-hidden="true" />
              Projects
            </NavLink>
            <NavLink to={insightsHref} className={navClass}>
              <BarChart2 size={16} aria-hidden="true" />
              Insights
            </NavLink>
            <button
              type="button"
              className={styles.navItem}
              onClick={() => setShowMembers(true)}
            >
              <Users size={16} aria-hidden="true" />
              Members
            </button>
          </nav>

          <div className={styles.sidebarFooter}>
            <NavLink to={profileHref} className={navClass}>
              <div className={styles.userAvatar} aria-hidden="true">{avatarChar}</div>
              <span className={styles.userEmail}>{user?.email}</span>
            </NavLink>
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
          <button
            type="button"
            className={styles.topBarSignOut}
            onClick={() => setShowMembers(true)}
            aria-label="Members"
          >
            <Users size={18} />
          </button>
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
            <NavLink to={projectsHref} className={pillClass}>
              <LayoutGrid size={20} aria-hidden="true" />
              <span className={styles.pillLabel}>Projects</span>
            </NavLink>

            <NavLink to={insightsHref} className={pillClass}>
              <BarChart2 size={20} aria-hidden="true" />
              <span className={styles.pillLabel}>Insights</span>
            </NavLink>

            <Link to={projectsHref} className={styles.fab} aria-label="Go to projects">
              <Plus size={22} strokeWidth={2.5} />
            </Link>

            <NavLink to={profileHref} className={pillClass}>
              <User size={20} aria-hidden="true" />
              <span className={styles.pillLabel}>Profile</span>
            </NavLink>
          </div>
        </nav>

        {/* ── Members sheet ─────────────────────────────────────── */}
        {showMembers ? (
          <BottomSheet onClose={() => setShowMembers(false)} aria-labelledby="members-title">
            <MemberList workspaceId={state.workspace.id} onClose={() => setShowMembers(false)} />
          </BottomSheet>
        ) : null}

      </div>
    </WorkspaceContext.Provider>
  )
}
