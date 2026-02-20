import { Routes, Route } from 'react-router-dom'
import { Sonner } from '@/components/ui/sonner'

// Auth pages
import LoginPage from './pages/auth/LoginPage'
import SignupPage from './pages/auth/SignupPage'
import SignupAdminPage from './pages/auth/SignupAdminPage'
import SignupTeacherPage from './pages/auth/SignupTeacherPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'
import UpdatePasswordPage from './pages/auth/UpdatePasswordPage'
import VerifyEmailPage from './pages/auth/VerifyEmailPage'
import PendingApprovalPage from './pages/auth/PendingApprovalPage'
import AuthCallbackPage from './pages/auth/AuthCallbackPage'

// Dashboard pages
import DashboardPage from './pages/dashboard/DashboardPage'
import AttendancePage from './pages/dashboard/AttendancePage'
import HistoryPage from './pages/dashboard/HistoryPage'
import ProfilePage from './pages/dashboard/ProfilePage'

// Teacher pages
import TeacherPage from './pages/teacher/TeacherPage'
import TeacherStudentAttendancePage from './pages/teacher/TeacherStudentAttendancePage'

// Admin pages
import AdminPage from './pages/admin/AdminPage'
import AdminUsersPage from './pages/admin/AdminUsersPage'
import AdminUserDetailPage from './pages/admin/AdminUserDetailPage'
import AdminAttendancePage from './pages/admin/AdminAttendancePage'
import AdminStudentAttendancePage from './pages/admin/AdminStudentAttendancePage'
import AdminArchivePage from './pages/admin/AdminArchivePage'

// Other pages
import HomePage from './pages/HomePage'
import AccountDisabledPage from './pages/AccountDisabledPage'
import PendingPage from './pages/PendingPage'

// Layouts
import AuthLayout from './layouts/AuthLayout'
import DashboardLayout from './layouts/DashboardLayout'

function App() {
  return (
    <>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<HomePage />} />
        
        {/* Auth callback - handles password reset and email verification links */}
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        
        {/* Auth routes */}
        <Route element={<AuthLayout />}>
          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="/auth/signup" element={<SignupPage />} />
          <Route path="/auth/signup/admin" element={<SignupAdminPage />} />
          <Route path="/auth/signup/teacher" element={<SignupTeacherPage />} />
          <Route path="/auth/reset" element={<ResetPasswordPage />} />
          <Route path="/auth/update-password" element={<UpdatePasswordPage />} />
          <Route path="/auth/verify-email" element={<VerifyEmailPage />} />
          <Route path="/auth/pending-approval" element={<PendingApprovalPage />} />
        </Route>

        {/* Dashboard routes */}
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          
          {/* Teacher routes */}
          <Route path="/teacher" element={<TeacherPage />} />
          <Route path="/teacher/student-attendance" element={<TeacherStudentAttendancePage />} />
          
          {/* Admin routes */}
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/users/:id" element={<AdminUserDetailPage />} />
          <Route path="/admin/attendance" element={<AdminAttendancePage />} />
          <Route path="/admin/student-attendance" element={<AdminStudentAttendancePage />} />
          <Route path="/admin/archive" element={<AdminArchivePage />} />
        </Route>

        {/* Other routes */}
        <Route path="/account-disabled" element={<AccountDisabledPage />} />
        <Route path="/pending" element={<PendingPage />} />
      </Routes>
      <Sonner />
    </>
  )
}

export default App

