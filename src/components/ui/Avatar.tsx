import styles from './Avatar.module.css'

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg'

interface AvatarProps {
  name: string
  src?: string | null
  size?: AvatarSize
}

export default function Avatar({ name, src, size = 'md' }: AvatarProps) {
  const initial = (name?.[0] ?? '?').toUpperCase()
  const colorIndex = (name?.charCodeAt(0) ?? 0) % 6
  return (
    <div
      className={[styles.avatar, styles[size], styles[`color${colorIndex}`]].join(' ')}
      aria-label={name}
      title={name}
    >
      {src ? <img src={src} alt={name} /> : initial}
    </div>
  )
}
