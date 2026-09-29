import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import * as assessmentService from '../../services/assessments'
import * as submissionService from '../../services/submissions'
import { unwrap, getMessage } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { Loader, EmptyState, Badge, formatDate, StatusBadge } from '../../components/Common'

function StatCard({ icon, label, value, tone = 'default' }) {
  const tones = {
    default: 'from-slate-50 to-white border-slate-200',
    brand: 'from-brand-50 to-white border-brand-100 text-brand-900',
    emerald: 'from-emerald-50 to-white border-emerald-100 text-emerald-900',
    amber: 'from-amber-50 to-white border-amber-100 text-amber-900',
    rose: 'from-rose-50 to-white border-rose-100 text-rose-900',
  }
  return (
    <div className={`p-5 rounded-xl border bg-gradient-to-br ${tones[tone]} shadow-card`}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide opacity-75">{label}</span>
        <span className="text-2xl">{icon}</span>
      </div>
      <div className="mt-3 text-3xl font-bold">{value}</div>
    </div>
  )
}

export default function TeacherDashboard() {
  const { user } = useAuth()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ assessments: 0, published: 0, submissions: 0, pendingReview: 0 })
  const [recent, setRecent] = useState([])
  const [pendingList, setPendingList] = useState([])

  useEffect(() => {
    (async () => {
      try {
        const a = unwrap(await assessmentService.listAssessments()) || []
        const s = unwrap(await submissionService.listTeacherSubmissions()) || []
        console.log('[Dashboard] Assessments:', a.length, 'Submissions:', s.length)
        console.log('[Dashboard] Submissions data:', s)
        setStats({
          assessments: a.length,
          published: a.filter((x) => x.status === 'published').length,
          submissions: s.length,
          pendingReview: s.filter((x) => x.status === 'evaluated' || x.status === 'reviewed').length,
        })
        setRecent(a.slice(0, 5))
        const pending = s.filter((x) => x.status === 'evaluated' || x.status === 'pending').slice(0, 5)
        console.log('[Dashboard] Pending submissions:', pending)
        setPendingList(pending)
      } catch (e) {
        console.error('[Dashboard] Error loading:', e)
        toast.error(getMessage(e, 'Failed to load dashboard'))
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) return <div className="py-10"><Loader size="lg" text="Loading dashboard..." /></div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Hello, {user.name} 👋</h1>
        <p className="text-slate-500 mt-1">Here's what's happening with your assessments today.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Assessments" value={stats.assessments} icon="📑" tone="brand" />
        <StatCard label="Published" value={stats.published} icon="🚀" tone="emerald" />
        <StatCard label="Submissions" value={stats.submissions} icon="📥" tone="amber" />
        <StatCard label="To Review" value={stats.pendingReview} icon="🖋️" tone="rose" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Recent Assessments</h3>
            <Link to="/teacher/assessments/create" className="btn-primary text-xs">+ New</Link>
          </div>
          <div className="card-body">
            {recent.length === 0 ? (
              <EmptyState icon="📝" title="No assessments yet"
                subtitle="Create your first assessment to get started."
                action={<Link to="/teacher/assessments/create" className="btn-primary text-sm">Create Assessment</Link>} />
            ) : (
              <div className="divide-y divide-slate-100">
                {recent.map((a) => (
                  <Link key={a.id} to={`/teacher/assessments/${a.id}`}
                    className="block py-3 -mx-2 px-2 rounded-md hover:bg-slate-50 transition">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="font-medium text-slate-800 truncate">{a.title}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{a.question_count || 0} questions · {a.total_marks || 0} marks · {formatDate(a.created_at)}</div>
                      </div>
                      <StatusBadge status={a.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-slate-800">Pending Submissions</h3>
          </div>
          <div className="card-body">
            {pendingList.length === 0 ? (
              <EmptyState icon="✅" title="All caught up!" subtitle="Nothing needs your review right now." />
            ) : (
              <div className="space-y-2">
                {pendingList.map((s) => (
                  <Link key={s.id} to={`/teacher/submissions/${s.id}`}
                    className="block p-3 rounded-lg border border-slate-200 hover:border-brand-300 hover:bg-brand-50/40 transition">
                    <div className="font-medium text-sm text-slate-800 truncate">{s.student_name}</div>
                    <div className="text-xs text-slate-500 truncate mt-0.5">{s.assessment_title}</div>
                    <div className="flex items-center justify-between mt-2">
                      <StatusBadge status={s.status} />
                      <Badge variant="primary">View</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
