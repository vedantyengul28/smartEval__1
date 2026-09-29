import { Link, Outlet, useLocation } from 'react-router-dom'

export default function PublicLayout() {
  const location = useLocation()
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-brand-50 flex flex-col">
      <header className="border-b border-slate-200/60 bg-white/70 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center font-bold shadow-sm">S</div>
            <div>
              <div className="text-lg font-bold text-slate-900 leading-tight">SmartEval</div>
              <div className="text-xs text-slate-500 leading-tight">AI-assisted Evaluation Platform</div>
            </div>
          </Link>
          <nav className="flex items-center gap-3">
            {location.pathname === '/login' ? (
              <Link to="/register" className="btn-secondary text-sm">Create account</Link>
            ) : location.pathname === '/register' ? (
              <Link to="/login" className="btn-secondary text-sm">Sign in</Link>
            ) : (
              <Link to="/login" className="btn-primary text-sm">Get started</Link>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1 flex items-stretch justify-center py-10 px-4">
        <Outlet />
      </main>
      <footer className="text-center text-xs text-slate-500 py-6 border-t border-slate-200/60 bg-white/40">
        SmartEval · Final-Year Engineering Project · AI + Automated Evaluation
      </footer>
    </div>
  )
}
