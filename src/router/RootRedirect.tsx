import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function RootRedirect() {
  const { session, loading } = useAuth()
  if (loading) return null
  return <Navigate to={session ? '/app' : '/login'} replace />
}
