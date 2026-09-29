import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import * as aService from '../../services/assessments'
import * as sService from '../../services/submissions'
import { unwrap, getMessage } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { Loader, EmptyState, formatDate, Badge, StatusBadge } from '../../components/Common'

function StatCard({ label, value, icon, tone = 'default' }) {
  const tones = {
    default: 'from-slate-50 to-white border-slate-200',
    brand: 'from-brand-50 to-white border-brand-100',
    emerald: 'from-emerald-50 to-white border-emerald-100',
    amber: 'from-amber-50 to-white border-amber-100',
  }
  return (
    <div className={`rounded-xl border p-5 bg-gradient-to-br ${tones[tone]} shadow-card`}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide opacity-70">{label}</span>
        <span className="text-2xl">{icon}</span>
      </div>
      <div className="mt-3 text-3xl font-bold">{value}</div>
    </div>
  )
}

export default function StudentDashboard() {
  const { user } = useAuth()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ available: 0, attempted: 0, resultsCount: 0, avgPct: 0 })
  const [available, setAvailable] = useState([])
  const [results, setResults] = useState([])

  useEffect(() => {
    (async () => {
      try {
        const a = unwrap(await aService.listAssessments()) || []
        const s = unwrap(await sService.listMySubmissions()) || []
        setAvailable(a.slice(0, 5))
        setResults([])
        setStats({ available: a.length, attempted: s.length, resultsCount: 0, avgPct: 0 })
      } catch (e) { toast.error(getMessage(e)) }
      finally { setLoading(false) }
    })()
  }, [])

  if (loading) return <Loader size="lg" />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Hello, {user.name} 👋</h1>
        <p className="text-slate-500 mt-1">Welcome back. Here's your learning dashboard.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Available" value={stats.available} icon="📑" tone="brand" />
        <StatCard label="Attempted" value={stats.attempted} icon="📝" tone="default" />
        <StatCard label="Results" value={stats.resultsCount} icon="🎯" tone="emerald" />
        <StatCard label="Avg Score" value={`${stats.avgPct}%`} icon="📈" tone="amber" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-semibold">Available Assessments</h3>
            <Link to="/student/assessments" className="text-sm text-brand-600 hover:underline">View all →</Link>
          </div>
          <div className="card-body">
            {available.length === 0 ? (
              <EmptyState icon="📑" title="No assessments available" subtitle="Your teacher hasn't published any assessments yet." />
            ) : (
              <div className="divide-y divide-slate-100">
                {available.map((a) => (
                  <Link key={a.id} to={`/student/assessments/${a.id}`}
                    className="block py-3 hover:bg-slate-50 -mx-2 px-2 rounded-md transition">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-medium text-slate-800">{a.title}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {a.question_count || 0} questions · {a.total_marks || 0} marks · Teacher: {a.teacher_name}
                        </div>
                      </div>
                      {a.has_submitted
                        ? <Badge variant="primary">Submitted</Badge>
                        : <Badge variant="success">Open</Badge>}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-semibold">Recent Results</h3>
            <Link to="/student/results" className="text-sm text-brand-600 hover:underline">View all →</Link>
          </div>
          <div className="card-body">
            {results.length === 0 ? (
              <EmptyState icon="🎯" title="No results yet" subtitle="Approved grades will appear here." />
            ) : (
              <div className="space-y-3">
                {results.map((r) => (
                  <div key={r.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{r.assessment_title}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{formatDate(r.released_at)}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold text-slate-900">{parseFloat(r.percentage || 0).toFixed(0)}%</div>
                        <div className="text-xs">Grade: {r.grade || '—'}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
