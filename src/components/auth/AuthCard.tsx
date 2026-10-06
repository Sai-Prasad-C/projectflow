import type { ReactNode } from 'react'
import Brand from '../ui/Brand'
import styles from './AuthCard.module.css'

interface AuthCardProps {
  heading: string
  children: ReactNode
}

export default function AuthCard({ heading, children }: AuthCardProps) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <Brand size={22} showName />
        </div>
        <h1 className={styles.heading}>{heading}</h1>
        {children}
      </div>
    </div>
  )
}
