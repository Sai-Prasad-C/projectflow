import type { ReactNode } from 'react'
import styles from './Badge.module.css'

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'outline'
type BadgeSize = 'sm' | 'md'

interface BadgeProps {
  variant?: BadgeVariant
  size?: BadgeSize
  children: ReactNode
  className?: string
}

export default function Badge({ variant = 'default', size = 'sm', children, className }: BadgeProps) {
  return (
    <span className={[styles.badge, styles[variant], styles[size], className].filter(Boolean).join(' ')}>
      {children}
    </span>
  )
}
