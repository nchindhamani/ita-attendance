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
import ForcePasswordResetPage from './pages/auth/ForcePasswordResetPage'

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

// Principal pages
import PrincipalPage from './pages/principal/PrincipalPage'
import PrincipalStudentAttendancePage from './pages/principal/PrincipalStudentAttendancePage'
import PrincipalTeacherAttendancePage from './pages/principal/PrincipalTeacherAttendancePage'
import PrincipalUsersPage from './pages/principal/PrincipalUsersPage'
import PrincipalStaffAttendancePage from './pages/principal/PrincipalStaffAttendancePage'
import PrincipalStaffManagementPage from './pages/principal/PrincipalStaffManagementPage'

// Attendance Officer pages
import AttendanceOfficerPage from './pages/attendance-officer/AttendanceOfficerPage'
import AttendanceOfficerAttendancePage from './pages/attendance-officer/AttendanceOfficerAttendancePage'
import AttendanceOfficerStudentsPage from './pages/attendance-officer/AttendanceOfficerStudentsPage'

// HSCP Officer pages
import HSCPOfficerPage from './pages/hscp-officer/HSCPOfficerPage'
import HSCPOfficerUsersPage from './pages/hscp-officer/HSCPOfficerUsersPage'
import HSCPOfficerTeacherAttendancePage from './pages/hscp-officer/HSCPOfficerTeacherAttendancePage'
import HSCPOfficerStudentAttendancePage from './pages/hscp-officer/HSCPOfficerStudentAttendancePage'
import HSCPOfficerRecordStudentAttendancePage from './pages/hscp-officer/HSCPOfficerRecordStudentAttendancePage'
import HSCPOfficerRecordTeacherAttendancePage from './pages/hscp-officer/HSCPOfficerRecordTeacherAttendancePage'
import HSCPOfficerTeachersPage from './pages/hscp-officer/HSCPOfficerTeachersPage'
import HSCPOfficerTeacherDetailPage from './pages/hscp-officer/HSCPOfficerTeacherDetailPage'

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
          <Route path="/auth/force-password-reset" element={<ForcePasswordResetPage />} />
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
          <Route path="/admin/staff-attendance" element={<PrincipalStaffAttendancePage />} />
          <Route path="/admin/archive" element={<AdminArchivePage />} />
          
          {/* Principal routes */}
          <Route path="/principal" element={<PrincipalPage />} />
          <Route path="/principal/staff-attendance" element={<PrincipalStaffAttendancePage />} />
          <Route path="/principal/staff-management" element={<PrincipalStaffManagementPage />} />
          <Route path="/principal/student-attendance" element={<PrincipalStudentAttendancePage />} />
          <Route path="/principal/teacher-attendance" element={<PrincipalTeacherAttendancePage />} />
          <Route path="/principal/users" element={<PrincipalUsersPage />} />
          
          {/* Attendance Officer routes */}
          <Route path="/attendance-officer" element={<AttendanceOfficerPage />} />
          <Route path="/attendance-officer/attendance" element={<AttendanceOfficerAttendancePage />} />
          <Route path="/attendance-officer/students" element={<AttendanceOfficerStudentsPage />} />
          
          {/* HSCP Officer routes */}
          {/* <Route path="/hscp-officer" element={<HSCPOfficerPage />} /> */}
          <Route path="/hscp-officer" element={<HSCPOfficerTeacherAttendancePage />} />
          <Route path="/hscp-officer/users" element={<HSCPOfficerUsersPage />} />
          <Route path="/hscp-officer/teachers" element={<HSCPOfficerTeachersPage />} />
          <Route path="/hscp-officer/teachers/:id" element={<HSCPOfficerTeacherDetailPage />} />
          <Route path="/hscp-officer/teacher-attendance" element={<HSCPOfficerTeacherAttendancePage />} />
          <Route path="/hscp-officer/student-attendance" element={<HSCPOfficerStudentAttendancePage />} />
          <Route path="/hscp-officer/record-teacher-attendance" element={<HSCPOfficerRecordTeacherAttendancePage />} />
          <Route path="/hscp-officer/record-student-attendance" element={<HSCPOfficerRecordStudentAttendancePage />} />
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

