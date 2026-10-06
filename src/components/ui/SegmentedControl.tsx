import type { ReactNode } from 'react'
import styles from './SegmentedControl.module.css'

interface Segment<T extends string> {
  value: T
  label: string
  icon?: ReactNode
}

interface Props<T extends string> {
  segments: Segment<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

export default function SegmentedControl<T extends string>({
  segments, value, onChange, className,
}: Props<T>) {
  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')} role="tablist">
      {segments.map(s => (
        <button
          key={s.value}
          role="tab"
          type="button"
          aria-selected={s.value === value}
          className={[styles.segment, s.value === value ? styles.active : ''].filter(Boolean).join(' ')}
          onClick={() => onChange(s.value)}
        >
          {s.icon ? <span className={styles.icon} aria-hidden="true">{s.icon}</span> : null}
          {s.label}
        </button>
      ))}
    </div>
  )
}
