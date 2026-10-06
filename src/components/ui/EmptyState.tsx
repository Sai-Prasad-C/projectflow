import type { ReactNode } from 'react'
import styles from './EmptyState.module.css'

interface Props {
  icon: ReactNode
  heading: string
  body?: string
  action?: ReactNode
}

export default function EmptyState({ icon, heading, body, action }: Props) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.icon} aria-hidden="true">{icon}</div>
      <p className={styles.heading}>{heading}</p>
      {body ? <p className={styles.body}>{body}</p> : null}
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  )
}
