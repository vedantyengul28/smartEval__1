import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { Loader } from '../../components/Common'
import { getMessage } from '../../services/api'

export default function RegisterPage() {
  const { register } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' })
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState({})

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const onSubmit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!form.name.trim()) errs.name = 'Required'
    if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = 'Valid email required'
    if (!form.password || form.password.length < 6) errs.password = 'At least 6 characters'
    setErrors(errs)
    if (Object.keys(errs).length) return

    setSubmitting(true)
    try {
      const data = await register(form)
      toast.success(`Account created! Welcome, ${data.user.name}.`)
      navigate(data.user.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard', { replace: true })
    } catch (err) {
      const details = err?.response?.data?.details
      if (Array.isArray(details)) details.forEach((d) => { errs[d.field] = d.message })
      setErrors({ ...errs })
      toast.error(getMessage(err, 'Registration failed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-lg self-center">
      <div className="card">
        <div className="card-body space-y-5">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
            <p className="text-sm text-slate-500 mt-1">Join SmartEval as a teacher or student</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="label">Full name</label>
              <input className="input" value={form.name} onChange={update('name')} placeholder="Jane Doe" />
              {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={form.email} onChange={update('email')} placeholder="you@example.com" />
              {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" value={form.password} onChange={update('password')} placeholder="At least 6 characters" />
              {errors.password && <p className="text-xs text-red-600 mt-1">{errors.password}</p>}
            </div>
            <div>
              <label className="label">I am a...</label>
              <div className="grid grid-cols-2 gap-3">
                {['student', 'teacher'].map((r) => (
                  <button type="button" key={r} onClick={() => setForm((f) => ({ ...f, role: r }))}
                    className={`rounded-lg border-2 p-3 text-left transition ${form.role === r ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <div className="font-semibold capitalize text-slate-800">{r}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{r === 'teacher' ? 'Create & grade assessments' : 'Take assessments'}</div>
                  </button>
                ))}
              </div>
            </div>
            <button disabled={submitting} type="submit" className="btn-primary w-full">
              {submitting ? <Loader size="sm" text="Creating account..." /> : 'Create account'}
            </button>
          </form>

          <p className="text-sm text-slate-600 text-center">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-600 font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
