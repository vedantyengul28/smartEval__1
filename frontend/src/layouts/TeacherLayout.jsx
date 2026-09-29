import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

function Sidebar({ user }) {
  const teacherLinks = [
    { to: '/teacher/dashboard', label: 'Dashboard', icon: 'D' },
    { to: '/teacher/assessments', label: 'Assessments', icon: 'A' },
    { to: '/teacher/submissions', label: 'Submissions', icon: 'S' },
    { to: '/teacher/results', label: 'Results', icon: 'R' },
  ]
  const studentLinks = [
    { to: '/student/dashboard', label: 'Dashboard', icon: 'D' },
    { to: '/student/assessments', label: 'Assessments', icon: 'A' },
    { to: '/student/results', label: 'Results', icon: 'R' },
  ]
  const links = user.role === 'teacher' ? teacherLinks : studentLinks
  return (
    <aside className="hidden lg:flex w-64 shrink-0 bg-slate-900 text-white flex-col fixed top-0 bottom-0 left-0 z-30">
      <div className="px-5 py-5 border-b border-slate-800 flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center font-bold">S</div>
        <div>
          <div className="font-bold leading-tight">SmartEval</div>
          <div className="text-xs text-slate-400 leading-tight capitalize">{user.role} Console</div>
        </div>
      </div>
      <nav className="flex-1 py-4 space-y-1 px-3">
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <span className="text-lg w-6 text-center">{l.icon}</span>
            <span>{l.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-800 text-xs text-slate-500">
        v1.0.0 · Academic Project
      </div>
    </aside>
  )
}

function MobileNav({ user }) {
  const teacherLinks = [
    { to: '/teacher/dashboard', label: 'Home', icon: 'H' },
    { to: '/teacher/assessments', label: 'Papers', icon: 'P' },
    { to: '/teacher/submissions', label: 'Subs', icon: 'S' },
    { to: '/teacher/results', label: 'Grades', icon: 'G' },
  ]
  const studentLinks = [
    { to: '/student/dashboard', label: 'Home', icon: 'H' },
    { to: '/student/assessments', label: 'Papers', icon: 'P' },
    { to: '/student/results', label: 'Grades', icon: 'G' },
  ]
  const links = user.role === 'teacher' ? teacherLinks : studentLinks
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 px-2 py-2 flex justify-around">
      {links.map((l) => (
        <NavLink key={l.to} to={l.to} className={({ isActive }) => `flex flex-col items-center gap-0.5 px-3 py-1.5 text-xs ${isActive ? 'text-brand-600' : 'text-slate-500'}`}>
          <span className="text-xl">{l.icon}</span>
          <span>{l.label}</span>
        </NavLink>
      ))}
    </div>
  )
}

function Topbar({ user }) {
  const { logout } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const initials = user.name?.[0]?.toUpperCase() || 'U'
  const onLogout = async () => {
    await logout()
    toast.info('You have been logged out')
    navigate('/login', { replace: true })
  }
  return (
    <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-slate-200">
      <div className="px-6 py-3.5 flex items-center justify-between gap-4">
        <div className="lg:hidden flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center font-bold text-sm">S</div>
          <span className="font-semibold text-slate-800">SmartEval</span>
        </div>
        <div className="hidden lg:block text-sm text-slate-500">
          Welcome back, <span className="text-slate-800 font-medium">{user.name}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-3 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
            <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-semibold text-xs">{initials}</div>
            <div className="text-sm leading-tight">
              <div className="font-medium text-slate-800">{user.name}</div>
              <div className="text-xs text-slate-500 capitalize">{user.role}</div>
            </div>
          </div>
          <button onClick={onLogout} className="btn-secondary text-sm">Log out</button>
        </div>
      </div>
    </header>
  )
}

function AppShell() {
  const { user } = useAuth()
  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar user={user} />
      <MobileNav user={user} />
      <div className="lg:pl-64">
        <Topbar user={user} />
        <div className="p-6 pb-24 lg:pb-6">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

export { AppShell as default }
