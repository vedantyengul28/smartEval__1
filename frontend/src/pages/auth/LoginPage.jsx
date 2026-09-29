import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { Loader } from '../../components/Common'
import { getMessage } from '../../services/api'

export default function LoginPage() {
  const { login } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const demo = [
    { role: 'Teacher', email: 'teacher@example.com', password: 'password123' },
    { role: 'Student', email: 'student@example.com', password: 'password123' },
  ]

  const fill = (e, p) => { setEmail(e); setPassword(p) }

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email || !password) { setError('Please enter email and password'); return }
    setSubmitting(true)
    try {
      const data = await login({ email, password })
      toast.success(`Welcome back, ${data.user.name}!`)
      navigate(data.user.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard', { replace: true })
    } catch (err) {
      setError(getMessage(err, 'Login failed'))
      toast.error(getMessage(err, 'Login failed'))
    } finally {
      setSubmitting(false)
    }
  }

  const expired = new URLSearchParams(location.search).get('expired') === '1'

  return (
    <div className="w-full max-w-md self-center">
      <div className="card">
        <div className="card-body space-y-5">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
            <p className="text-sm text-slate-500 mt-1">Sign in to continue to SmartEval</p>
          </div>

          {expired && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm p-3">
              Your session has expired. Please sign in again.
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            {error && <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm p-3">{error}</div>}
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <button disabled={submitting} type="submit" className="btn-primary w-full">
              {submitting ? <Loader size="sm" text="Signing in..." /> : 'Sign in'}
            </button>
          </form>

          <div className="pt-4 border-t border-slate-200 space-y-3">
            <p className="text-xs text-slate-500">Demo accounts (click to prefill):</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {demo.map((d) => (
                <button key={d.email} type="button" onClick={() => fill(d.email, d.password)}
                  className="text-left px-3 py-2 rounded-lg border border-slate-200 hover:border-brand-300 hover:bg-brand-50/50 text-sm transition">
                  <div className="font-semibold text-slate-800">{d.role}</div>
                  <div className="text-xs text-slate-500 truncate">{d.email}</div>
                </button>
              ))}
            </div>
          </div>

          <p className="text-sm text-slate-600 text-center">
            Don't have an account?{' '}
            <Link to="/register" className="text-brand-600 font-medium hover:underline">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
