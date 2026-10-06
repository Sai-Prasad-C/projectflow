import { createBrowserRouter, Navigate } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute'
import RootRedirect from './RootRedirect'
import WorkspaceLayout from './WorkspaceLayout'
import LoginPage from '../pages/LoginPage'
import RegisterPage from '../pages/RegisterPage'
import ForgotPasswordPage from '../pages/ForgotPasswordPage'
import ResetPasswordPage from '../pages/ResetPasswordPage'
import WorkspaceRedirectPage from '../pages/WorkspaceRedirectPage'
import ProjectListPage from '../pages/ProjectListPage'
import ProjectDashboardPage from '../pages/ProjectDashboardPage'
import KanbanPage from '../pages/KanbanPage'
import InsightsPage from '../pages/InsightsPage'
import ProfilePage from '../pages/ProfilePage'

export const router = createBrowserRouter([
  { path: '/',                element: <RootRedirect /> },
  { path: '/login',           element: <LoginPage /> },
  { path: '/register',        element: <RegisterPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password',  element: <ResetPasswordPage /> },
  {
    path: '/app',
    element: <ProtectedRoute />,
    children: [
      { index: true, element: <WorkspaceRedirectPage /> },
      {
        path: ':workspaceId',
        element: <WorkspaceLayout />,
        children: [
          { path: 'projects',                    element: <ProjectListPage /> },
          { path: 'projects/:projectId',         element: <ProjectDashboardPage /> },
          { path: 'projects/:projectId/board',   element: <KanbanPage /> },
          { path: 'insights',                    element: <InsightsPage /> },
          { path: 'profile',                     element: <ProfilePage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
