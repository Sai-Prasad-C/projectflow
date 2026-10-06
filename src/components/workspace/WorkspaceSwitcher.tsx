import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, ChevronDown, Plus, X } from 'lucide-react'
import { useWorkspaces } from '../../hooks/useWorkspaces'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import type { Workspace } from '../../lib/types'
import BottomSheet from '../ui/BottomSheet'
import Button from '../ui/Button'
import Input from '../ui/Input'
import styles from './WorkspaceSwitcher.module.css'

const LAST_WS_KEY = 'pf-last-workspace'

type MobileSheet = 'closed' | 'list' | 'create'

interface Props {
  currentWorkspace: Workspace
}

export default function WorkspaceSwitcher({ currentWorkspace }: Props) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { workspaces, loading, reload } = useWorkspaces()
  const [desktopOpen, setDesktopOpen] = useState(false)
  const [mobileSheet, setMobileSheet] = useState<MobileSheet>('closed')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Create form state (for the mobile sheet create mode)
  const [createName, setCreateName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [createLoading, setCreateLoading] = useState(false)

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
      setMobileSheet('list')
    } else {
      setDesktopOpen(prev => !prev)
    }
  }

  function selectWorkspace(ws: Workspace) {
    if (ws.id === currentWorkspace.id) {
      setDesktopOpen(false)
      setMobileSheet('closed')
      return
    }
    localStorage.setItem(LAST_WS_KEY, ws.id)
    setDesktopOpen(false)
    setMobileSheet('closed')
    navigate(`/app/${ws.id}/projects`)
  }

  const openCreate = useCallback(() => {
    setCreateName('')
    setCreateError(null)
    setMobileSheet('create')
  }, [])

  async function handleCreateSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = createName.trim()
    if (!trimmed) { setCreateError('Workspace name is required.'); return }
    if (trimmed.length > 100) { setCreateError('Name must be 100 characters or fewer.'); return }
    if (!user) { setCreateError('Not authenticated.'); return }
    setCreateError(null)
    setCreateLoading(true)

    const { data: sessionData } = await supabase.auth.refreshSession()
    if (!sessionData.session) {
      setCreateError('Your session has expired. Sign in again.')
      setCreateLoading(false)
      return
    }

    const { data: workspaceId, error } = await supabase.rpc('create_workspace', { p_name: trimmed })
    setCreateLoading(false)
    if (error) { setCreateError(error.message); return }

    const id = workspaceId as string
    localStorage.setItem(LAST_WS_KEY, id)
    setMobileSheet('closed')
    reload()
    navigate(`/app/${id}/projects`)
  }

  const workspaceListContent = (
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
      {/* Trigger button — sidebar (desktop) or topBar (mobile) */}
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
          {workspaceListContent}
        </div>
      )}

      {/* Mobile bottom sheet — single sheet, mode-based content */}
      {mobileSheet !== 'closed' && (
        <BottomSheet
          onClose={() => setMobileSheet('closed')}
          aria-labelledby={mobileSheet === 'list' ? 'ws-sheet-title' : 'ws-create-title'}
        >
          {mobileSheet === 'list' ? (
            <>
              <div className={styles.sheetHeaderRow}>
                <h2 id="ws-sheet-title" className={styles.sheetTitle}>Workspaces</h2>
                <button
                  type="button"
                  className={styles.sheetCloseBtn}
                  onClick={() => setMobileSheet('closed')}
                  aria-label="Close"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
              <div className={styles.sheetList}>
                {workspaceListContent}
              </div>
            </>
          ) : (
            <>
              <div className={styles.sheetHeaderRow}>
                <button
                  type="button"
                  className={styles.sheetBackBtn}
                  onClick={() => setMobileSheet('list')}
                  aria-label="Back to workspace list"
                >
                  <ArrowLeft size={16} aria-hidden="true" />
                  Back
                </button>
                <button
                  type="button"
                  className={styles.sheetCloseBtn}
                  onClick={() => setMobileSheet('closed')}
                  aria-label="Close"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
              <h2 id="ws-create-title" className={styles.sheetTitle}>Create workspace</h2>
              <p className={styles.sheetSub}>A workspace is where you and your team manage projects together.</p>
              <form onSubmit={handleCreateSubmit} noValidate>
                <Input
                  label="Workspace name"
                  value={createName}
                  onChange={e => { setCreateName(e.target.value); setCreateError(null) }}
                  placeholder="e.g. Acme Corp"
                  maxLength={100}
                  autoFocus
                />
                {createError ? <p className={styles.sheetError}>{createError}</p> : null}
                <div className={styles.sheetActions}>
                  <Button type="button" variant="ghost" onClick={() => setMobileSheet('list')} disabled={createLoading}>
                    Cancel
                  </Button>
                  <Button type="submit" loading={createLoading} disabled={!createName.trim()}>
                    Create workspace
                  </Button>
                </div>
              </form>
            </>
          )}
        </BottomSheet>
      )}
    </>
  )
}
