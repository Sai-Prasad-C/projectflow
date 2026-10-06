import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sun, Moon, Monitor } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import SegmentedControl from '../components/ui/SegmentedControl'
import Avatar from '../components/ui/Avatar'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import ChangeEmailSheet from '../components/profile/ChangeEmailSheet'
import styles from './ProfilePage.module.css'

type ThemeMode = 'light' | 'dark' | 'system'

const THEME_SEGMENTS: Array<{ value: ThemeMode; label: string; icon: React.ReactNode }> = [
  { value: 'light',  label: 'Light',  icon: <Sun size={14} /> },
  { value: 'dark',   label: 'Dark',   icon: <Moon size={14} /> },
  { value: 'system', label: 'System', icon: <Monitor size={14} /> },
]

export default function ProfilePage() {
  const { user } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()

  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showEmailSheet, setShowEmailSheet] = useState(false)
  const [emailUpdated, setEmailUpdated] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function fetchProfile() {
      const { data } = await supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('id', user!.id)
        .single()
      if (cancelled) return
      if (data) {
        setDisplayName(data.display_name)
        setAvatarUrl(data.avatar_url)
        setEditName(data.display_name)
      }
    }
    void fetchProfile()
    return () => { cancelled = true }
  }, [user])

  const changed = editName.trim() !== displayName && editName.trim().length > 0

  async function handleSave() {
    if (!user || !changed) return
    setSaving(true)
    setSaveError(null)
    const trimmed = editName.trim()
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: trimmed })
      .eq('id', user.id)
    if (error) {
      setSaveError(error.message)
    } else {
      setDisplayName(trimmed)
    }
    setSaving(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  const nameForAvatar = displayName || user?.email || '?'

  return (
    <div className={styles.page}>
      <div className={styles.content}>

        <div className={styles.profileHeader}>
          <Avatar name={nameForAvatar} src={avatarUrl} size="lg" />
          <h1 className={styles.displayName}>{displayName || '—'}</h1>
          <p className={styles.email}>{user?.email}</p>
        </div>

        <section className={styles.section}>
          <h2 className={styles.sectionLabel}>Details</h2>
          <div className={styles.card}>
            <Input
              label="Display name"
              value={editName}
              onChange={e => setEditName(e.target.value)}
            />
            {saveError ? <p className={styles.fieldError}>{saveError}</p> : null}
            {changed ? (
              <Button loading={saving} onClick={handleSave}>
                Save changes
              </Button>
            ) : null}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionLabel}>Account</h2>
          <div className={styles.card}>
            <div className={styles.staticRow}>
              <span className={styles.rowLabel}>Email</span>
              <span className={styles.rowValue}>{user?.email}</span>
            </div>
            {emailUpdated ? (
              <p className={styles.successNote} role="status">Email updated</p>
            ) : null}
            <div className={styles.divider} />
            <Button variant="ghost" onClick={() => setShowEmailSheet(true)}>
              Change email
            </Button>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionLabel}>Appearance</h2>
          <div className={styles.card}>
            <SegmentedControl
              segments={THEME_SEGMENTS}
              value={theme}
              onChange={setTheme}
              className={styles.themeControl}
            />
          </div>
        </section>

        <section className={styles.section}>
          <Button variant="ghost" fullWidth onClick={handleSignOut}>
            Sign out
          </Button>
        </section>

      </div>

      {showEmailSheet && user?.email && (
        <ChangeEmailSheet
          currentEmail={user.email}
          onClose={() => setShowEmailSheet(false)}
          onSuccess={() => {
            setShowEmailSheet(false)
            setEmailUpdated(true)
            setTimeout(() => setEmailUpdated(false), 4000)
          }}
        />
      )}
    </div>
  )
}
