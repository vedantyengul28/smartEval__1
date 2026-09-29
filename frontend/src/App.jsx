import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { Loader } from './components/Common'
import PublicLayout from './layouts/PublicLayout'
import TeacherLayout from './layouts/TeacherLayout'
import StudentLayout from './layouts/StudentLayout'

import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'

import TeacherDashboard from './pages/teacher/TeacherDashboard'
import TeacherAssessments from './pages/teacher/TeacherAssessments'
import TeacherCreateAssessment from './pages/teacher/TeacherCreateAssessment'
import TeacherAssessmentDetail from './pages/teacher/TeacherAssessmentDetail'
import TeacherAssessmentQuestions from './pages/teacher/TeacherAssessmentQuestions'
import TeacherSubmissions from './pages/teacher/TeacherSubmissions'
import TeacherSubmissionDetail from './pages/teacher/TeacherSubmissionDetail'
import TeacherResults from './pages/teacher/TeacherResults'

import StudentDashboard from './pages/student/StudentDashboard'
import StudentAssessments from './pages/student/StudentAssessments'
import StudentAssessmentDetail from './pages/student/StudentAssessmentDetail'
import StudentAttempt from './pages/student/StudentAttempt'
import StudentSubmissionDetail from './pages/student/StudentSubmissionDetail'
import StudentResults from './pages/student/StudentResults'

function RequireAuth({ children, role }) {
  const { authenticated, user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader size="lg" text="Loading..." /></div>
  if (!authenticated) return <Navigate to="/login" replace />
  if (role && user.role !== role) return <Navigate to={user.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard'} replace />
  return children
}

function RedirectHome() {
  const { user, authenticated } = useAuth()
  if (!authenticated) return <Navigate to="/login" replace />
  return <Navigate to={user.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RedirectHome />} />

      <Route element={<PublicLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route path="/teacher" element={<RequireAuth role="teacher"><TeacherLayout /></RequireAuth>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<TeacherDashboard />} />
        <Route path="assessments" element={<TeacherAssessments />} />
        <Route path="assessments/create" element={<TeacherCreateAssessment />} />
        <Route path="assessments/:id" element={<TeacherAssessmentDetail />} />
        <Route path="assessments/:id/questions" element={<TeacherAssessmentQuestions />} />
        <Route path="submissions" element={<TeacherSubmissions />} />
        <Route path="submissions/:id" element={<TeacherSubmissionDetail />} />
        <Route path="results" element={<TeacherResults />} />
      </Route>

      <Route path="/student" element={<RequireAuth role="student"><StudentLayout /></RequireAuth>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<StudentDashboard />} />
        <Route path="assessments" element={<StudentAssessments />} />
        <Route path="assessments/:id" element={<StudentAssessmentDetail />} />
        <Route path="assessments/:id/attempt" element={<StudentAttempt />} />
        <Route path="submissions/:id" element={<StudentSubmissionDetail />} />
        <Route path="results" element={<StudentResults />} />
      </Route>

      <Route path="*" element={<div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="text-6xl">🧭</div>
        <h1 className="text-2xl font-semibold">404 — Page Not Found</h1>
        <p className="text-slate-500">The page you are looking for doesn't exist.</p>
      </div>} />
    </Routes>
  )
}
