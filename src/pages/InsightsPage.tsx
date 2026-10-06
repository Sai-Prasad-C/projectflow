import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { TrendingUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import EmptyState from '../components/ui/EmptyState'
import SegmentedControl from '../components/ui/SegmentedControl'
import styles from './InsightsPage.module.css'

type Period = '7d' | '30d' | '6m' | 'all'

const PERIOD_SEGMENTS: Array<{ value: Period; label: string }> = [
  { value: '7d',  label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '6m',  label: '6 months' },
  { value: 'all', label: 'All time' },
]

function periodCutoff(period: Period): Date | null {
  if (period === 'all') return null
  const now = new Date()
  if (period === '7d') return new Date(now.getTime() - 7 * 86400000)
  if (period === '30d') return new Date(now.getTime() - 30 * 86400000)
  // 6m ≈ 182 days
  return new Date(now.getTime() - 182 * 86400000)
}

interface TaskRow {
  status: string
  priority: string
  due_date: string | null
  created_at: string
}

interface Metrics {
  total: number
  completed: number
  inProgress: number
  overdue: number
}

function MetricCard({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color?: 'success' | 'primary' | 'danger'
}) {
  return (
    <div className={styles.metricCard}>
      <span className={[styles.metricValue, color ? styles[color] : ''].filter(Boolean).join(' ')}>
        {value}
      </span>
      <span className={styles.metricLabel}>{label}</span>
    </div>
  )
}

export default function InsightsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>()
  const [period, setPeriod] = useState<Period>('30d')
  const [allTasks, setAllTasks] = useState<TaskRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!workspaceId) return
    let cancelled = false
    async function fetchData() {
      setLoading(true)
      const { data: projects } = await supabase
        .from('projects')
        .select('id')
        .eq('workspace_id', workspaceId!)
        .is('archived_at', null)

      if (cancelled) return
      if (!projects || projects.length === 0) {
        setAllTasks([])
        setLoading(false)
        return
      }

      const projectIds = projects.map(p => p.id)
      const { data: tasks } = await supabase
        .from('tasks')
        .select('status, priority, due_date, created_at')
        .in('project_id', projectIds)

      if (cancelled) return
      setAllTasks((tasks ?? []) as TaskRow[])
      setLoading(false)
    }
    void fetchData()
    return () => { cancelled = true }
  }, [workspaceId])

  const cutoff = periodCutoff(period)
  const today = new Date().toISOString().slice(0, 10)

  const filtered = cutoff
    ? allTasks.filter(t => new Date(t.created_at) >= cutoff)
    : allTasks

  const metrics: Metrics = {
    total:      filtered.length,
    completed:  filtered.filter(t => t.status === 'done').length,
    inProgress: allTasks.filter(t => t.status === 'in_progress').length,
    overdue:    allTasks.filter(t => t.due_date != null && t.due_date < today && t.status !== 'done').length,
  }

  const hasAnyTasks = allTasks.length > 0

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Insights</h1>
      </div>

      <SegmentedControl segments={PERIOD_SEGMENTS} value={period} onChange={setPeriod} />

      {loading ? (
        <div className={styles.metricsGrid}>
          {[1, 2, 3, 4].map(i => <div key={i} className={styles.skeletonCard} />)}
        </div>
      ) : !hasAnyTasks ? (
        <div className={styles.emptyWrap}>
          <EmptyState
            icon={<TrendingUp size={40} strokeWidth={1.5} />}
            heading="No data yet"
            body="Create tasks in your projects and they'll appear here."
          />
        </div>
      ) : (
        <div className={styles.metricsGrid}>
          <MetricCard label="Total tasks"  value={metrics.total} />
          <MetricCard label="Completed"    value={metrics.completed}  color="success" />
          <MetricCard label="In progress"  value={metrics.inProgress} color="primary" />
          <MetricCard label="Overdue"      value={metrics.overdue}    color="danger" />
        </div>
      )}
    </div>
  )
}
