import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronDown, Plus } from 'lucide-react'
import { useWorkspaces } from '../../hooks/useWorkspaces'
import type { Workspace } from '../../lib/types'
import BottomSheet from '../ui/BottomSheet'
import CreateWorkspaceForm from './CreateWorkspaceForm'
import styles from './WorkspaceSwitcher.module.css'

const LAST_WS_KEY = 'pf-last-workspace'

interface Props {
  currentWorkspace: Workspace
}

export default function WorkspaceSwitcher({ currentWorkspace }: Props) {
  const navigate = useNavigate()
  const { workspaces, loading, reload } = useWorkspaces()
  const [desktopOpen, setDesktopOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Close desktop popover on outside click or Escape
  useEffect(() => {
    if (!desktopOpen) return
    function handleMouseDown(e: MouseEvent) {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setDesktopOpen(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setDesktopOpen(false)
    }
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKey)
    }
  }, [desktopOpen])

  function handleTriggerClick() {
    if (window.matchMedia('(max-width: 768px)').matches) {
      setMobileOpen(true)
    } else {
      setDesktopOpen(prev => !prev)
    }
  }

  function selectWorkspace(ws: Workspace) {
    if (ws.id === currentWorkspace.id) {
      setDesktopOpen(false)
      setMobileOpen(false)
      return
    }
    localStorage.setItem(LAST_WS_KEY, ws.id)
    setDesktopOpen(false)
    setMobileOpen(false)
    navigate(`/app/${ws.id}/projects`)
  }

  function openCreate() {
    setDesktopOpen(false)
    setMobileOpen(false)
    setShowCreate(true)
  }

  function handleCreated() {
    setShowCreate(false)
    reload()
  }

  const workspaceList = (
    <>
      {loading && workspaces.length === 0 ? (
        <div className={styles.loadingRow}>Loading…</div>
      ) : (
        workspaces.map(ws => (
          <button
            key={ws.id}
            type="button"
            className={`${styles.wsRow} ${ws.id === currentWorkspace.id ? styles.wsRowActive : ''}`}
            onClick={() => selectWorkspace(ws)}
            aria-current={ws.id === currentWorkspace.id ? 'true' : undefined}
          >
            <span className={styles.wsCheck} aria-hidden="true">
              {ws.id === currentWorkspace.id ? <Check size={14} strokeWidth={3} /> : null}
            </span>
            <span className={styles.wsName}>{ws.name}</span>
          </button>
        ))
      )}
      <div className={styles.separator} />
      <button type="button" className={styles.createRow} onClick={openCreate}>
        <span className={styles.createIcon} aria-hidden="true"><Plus size={14} strokeWidth={2.5} /></span>
        Create workspace
      </button>
    </>
  )

  return (
    <>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        onClick={handleTriggerClick}
        aria-haspopup="listbox"
        aria-expanded={desktopOpen}
        aria-label={`Current workspace: ${currentWorkspace.name}. Click to switch workspace.`}
      >
        <span className={styles.triggerName}>{currentWorkspace.name}</span>
        <ChevronDown size={13} aria-hidden="true" className={`${styles.chevron} ${desktopOpen ? styles.chevronOpen : ''}`} />
      </button>

      {/* Desktop popover */}
      {desktopOpen && (
        <div ref={popoverRef} className={styles.popover} role="listbox" aria-label="Workspaces">
          <div className={styles.popoverHeader}>Workspaces</div>
          {workspaceList}
        </div>
      )}

      {/* Mobile bottom sheet */}
      {mobileOpen && (
        <BottomSheet onClose={() => setMobileOpen(false)} aria-labelledby="ws-switcher-title">
          <h2 id="ws-switcher-title" className={styles.sheetTitle}>Workspaces</h2>
          <div className={styles.sheetList}>
            {workspaceList}
          </div>
        </BottomSheet>
      )}

      {/* Create workspace form */}
      {showCreate && (
        <CreateWorkspaceForm
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  )
}
