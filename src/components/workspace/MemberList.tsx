import type { WorkspaceRole } from '../../lib/types'
import { useMembers } from '../../hooks/useMembers'
import Avatar from '../ui/Avatar'
import Badge from '../ui/Badge'
import styles from './MemberList.module.css'

interface Props {
  workspaceId: string
  onClose: () => void
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

export default function MemberList({ workspaceId }: Props) {
  const { members, loading } = useMembers(workspaceId)

  return (
    <div className={styles.sheet}>
      <div className={styles.sheetHeader}>
        <h2 id="members-title" className={styles.title}>
          Members{loading ? '' : ` · ${members.length}`}
        </h2>
      </div>

      <div className={styles.list} role="list">
        {loading ? (
          <>
            <div className={styles.skeletonRow}><div className={styles.skeleton} /></div>
            <div className={styles.skeletonRow}><div className={styles.skeleton} /></div>
            <div className={styles.skeletonRow}><div className={styles.skeleton} /></div>
          </>
        ) : (
          members.map(m => (
            <div className={styles.row} role="listitem" key={m.user_id}>
              <Avatar name={m.display_name} src={m.avatar_url} size="sm" />
              <div className={styles.info}>
                <span className={styles.name}>{m.display_name}</span>
              </div>
              <Badge variant={roleBadgeVariant(m.role)}>{roleLabel(m.role)}</Badge>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
