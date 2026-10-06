import type { ReactNode } from 'react'
import styles from './AuthCard.module.css'

interface AuthCardProps {
  heading: string
  children: ReactNode
}

export default function AuthCard({ heading, children }: AuthCardProps) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <span className={styles.brand}>ProjectFlow</span>
        <h1 className={styles.heading}>{heading}</h1>
        {children}
      </div>
    </div>
  )
}
