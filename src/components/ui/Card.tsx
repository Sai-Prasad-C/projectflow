import type { ReactNode } from 'react'
import styles from './Card.module.css'

type CardTag = 'div' | 'article' | 'li' | 'section'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  as?: CardTag
}

export default function Card({ children, className, onClick, as: Tag = 'div' }: CardProps) {
  return (
    <Tag
      className={[styles.card, onClick ? styles.clickable : '', className].filter(Boolean).join(' ')}
      onClick={onClick}
    >
      {children}
    </Tag>
  )
}
