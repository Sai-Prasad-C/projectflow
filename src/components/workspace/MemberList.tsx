import { useContext, useEffect, useState } from 'react'
import { Copy, Share2, Send, CheckCircle, X } from 'lucide-react'
import type { WorkspaceRole } from '../../lib/types'
import { WorkspaceContext } from '../../context/workspace-context'
import { useAuth } from '../../hooks/useAuth'
import { useMembers } from '../../hooks/useMembers'
import { supabase } from '../../lib/supabase'
import Avatar from '../ui/Avatar'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import styles from './MemberList.module.css'

interface Props {
  workspaceId: string
  onClose: () => void
}

interface PendingInvite {
  id: string
  email: string
  role: WorkspaceRole
  created_at: string
  expires_at: string
}

function roleBadgeVariant(role: WorkspaceRole): 'primary' | 'warning' | 'default' {
  if (role === 'owner') return 'primary'
  if (role === 'admin') return 'warning'
  return 'default'
}

function roleLabel(role: WorkspaceRole): string {
  if (role === 'owner') return 'Owner'
  if (role === 'admin') return 'Admin'
  return 'Member'
}

export default function MemberList({ workspaceId, onClose }: Props) {
  const { members, loading } = useMembers(workspaceId)
  const ctx = useContext(WorkspaceContext)
  const { user } = useAuth()
  const canInvite = ctx?.memberRole === 'owner' || ctx?.memberRole === 'admin'

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [createdInvite, setCreatedInvite] = useState<{ url: string; email: string; role: 'member' | 'admin' } | null>(null)
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle')

  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])

  useEffect(() => {
    if (!canInvite) return
    void loadPendingInvites()
  }, [workspaceId, canInvite]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadPendingInvites() {
    const { data } = await supabase
      .from('workspace_invitations')
      .select('id, email, role, created_at, expires_at')
      .eq('workspace_id', workspaceId)
      .is('accepted_at', null)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
    if (data) setPendingInvites(data as PendingInvite[])
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return
    setInviting(true)
    setInviteError(null)
    setCreatedInvite(null)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setInviteError('Not authenticated'); setInviting(false); return }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
    const fnUrl = `${supabaseUrl}/functions/v1/send-workspace-invite`

    const emailForInvite = inviteEmail.trim()
    const roleForInvite = inviteRole

    try {
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspace_id: workspaceId,
          email: emailForInvite,
          role: roleForInvite,
        }),
      })

      const json = await res.json() as { inviteUrl?: string; error?: string }

      if (!res.ok) {
        setInviteError(json.error ?? 'Failed to create invitation')
        return
      }

      if (json.inviteUrl) {
        setCreatedInvite({ url: json.inviteUrl, email: emailForInvite, role: roleForInvite })
      }
      setInviteEmail('')
      void loadPendingInvites()
    } catch {
      setInviteError('Network error — please try again')
    } finally {
      setInviting(false)
    }
  }

  async function handleRevoke(inviteId: string) {
    await supabase
      .from('workspace_invitations')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', inviteId)
    void loadPendingInvites()
  }

  async function copyLink(url: string) {
    await navigator.clipboard.writeText(url)
    setCopyState('copied')
    setTimeout(() => setCopyState('idle'), 2500)
  }

  async function shareInvite(url: string) {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'ProjectFlow workspace invitation',
          text: "You've been invited to join my ProjectFlow workspace.",
          url,
        })
      } catch (err) {
        // User dismissed the share sheet — not an error
        if (err instanceof Error && err.name === 'AbortError') return
        // Web Share failed for another reason; fall back to clipboard
        await copyLink(url)
      }
    } else {
      await copyLink(url)
    }
  }

  return (
    <div className={styles.sheet}>
      <div className={styles.sheetHeader}>
        <h2 id="members-title" className={styles.title}>
          Members{loading ? '' : ` · ${members.length}`}
        </h2>
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className={styles.scrollArea}>
        {/* ── Member list ───────────────────────────────────────── */}
        <div className={styles.list} role="list">
          {loading ? (
            <>
              {[1, 2, 3].map(i => (
                <div className={styles.skeletonRow} key={i}>
                  <div className={styles.skeletonAvatar} />
                  <div className={styles.skeleton} />
                </div>
              ))}
            </>
          ) : (
            members.map(m => (
              <div className={styles.row} role="listitem" key={m.user_id}>
                <Avatar name={m.display_name} src={m.avatar_url} size="sm" />
                <div className={styles.info}>
                  <span className={styles.name}>{m.display_name}</span>
                  {m.user_id === user?.id && (
                    <span className={styles.you}> (you)</span>
                  )}
                </div>
                <Badge variant={roleBadgeVariant(m.role)}>{roleLabel(m.role)}</Badge>
              </div>
            ))
          )}
        </div>

        {/* ── Invite form (owner/admin only) ─────────────────────── */}
        {canInvite && (
          <div className={styles.section}>
            <h3 className={styles.sectionLabel}>Invite someone</h3>
            <div className={styles.inviteRow}>
              <input
                className={styles.emailInput}
                placeholder="email@example.com"
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                aria-label="Invitee email address"
              />
              <select
                className={styles.roleSelect}
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as 'member' | 'admin')}
                aria-label="Invite role"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <Button loading={inviting} onClick={handleInvite} disabled={!inviteEmail.trim()}>
                <Send size={14} />
                Invite
              </Button>
            </div>
            {inviteError && <p className={styles.error}>{inviteError}</p>}

            {/* Invitation created — link sharing surface */}
            {createdInvite && (
              <div className={styles.successBox}>
                <div className={styles.successHeading}>
                  <CheckCircle size={15} className={styles.successIcon} aria-hidden="true" />
                  Invitation created
                </div>
                <p className={styles.successBody}>
                  Share this link with <strong>{createdInvite.email}</strong>. Only that account can accept it.
                </p>
                <div className={styles.linkRow}>
                  <span className={styles.linkText} title={createdInvite.url}>{createdInvite.url}</span>
                </div>
                <div className={styles.linkActions}>
                  <button
                    type="button"
                    className={`${styles.iconBtn} ${copyState === 'copied' ? styles.iconBtnSuccess : ''}`}
                    onClick={() => copyLink(createdInvite.url)}
                    aria-label="Copy invitation link"
                  >
                    {copyState === 'copied' ? <CheckCircle size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                    {copyState === 'copied' ? 'Copied!' : 'Copy link'}
                  </button>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => shareInvite(createdInvite.url)}
                    aria-label="Share invitation"
                  >
                    <Share2 size={14} aria-hidden="true" />
                    Share
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Pending invitations ────────────────────────────────── */}
        {canInvite && pendingInvites.length > 0 && (
          <div className={styles.section}>
            <h3 className={styles.sectionLabel}>Pending invitations</h3>
            {pendingInvites.map(inv => (
              <div className={styles.pendingRow} key={inv.id}>
                <div className={styles.pendingInfo}>
                  <span className={styles.pendingEmail}>{inv.email}</span>
                  <Badge variant="outline" size="sm">{roleLabel(inv.role as WorkspaceRole)}</Badge>
                </div>
                <button
                  type="button"
                  className={styles.revokeBtn}
                  onClick={() => handleRevoke(inv.id)}
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
