import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import * as service from '../../services/assessments'
import { unwrap, getMessage } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { Loader, EmptyState, Badge, formatDate } from '../../components/Common'

export default function StudentAssessments() {
  const toast = useToast()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        setList(unwrap(await service.listAssessments()) || [])
      } catch (e) { toast.error(getMessage(e)) }
      finally { setLoading(false) }
    })()
  }, [])

  if (loading) return <Loader size="lg" />

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Available Assessments</h1>
        <p className="text-slate-500 mt-1 text-sm">Published assessments you can attempt.</p>
      </div>
      {list.length === 0 ? (
        <EmptyState icon="A" title="No assessments available" subtitle="Check back when your teacher publishes one." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {list.map((a) => (
            <div key={a.id} className="card hover:shadow-md transition">
              <div className="card-body space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-slate-800">{a.title}</h3>
                  {a.has_submitted
                    ? <Badge variant="primary">Submitted</Badge>
                    : <Badge variant="success">Open</Badge>}
                </div>
                {a.description && <p className="text-sm text-slate-500 line-clamp-2">{a.description}</p>}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg bg-slate-50 p-2">
                    <div className="text-lg font-semibold">{a.question_count || 0}</div>
                    <div className="text-[10px] uppercase text-slate-500">Questions</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <div className="text-lg font-semibold">{a.total_marks || 0}</div>
                    <div className="text-[10px] uppercase text-slate-500">Marks</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <div className="text-lg font-semibold">{a.duration_minutes || '—'}</div>
                    <div className="text-[10px] uppercase text-slate-500">Minutes</div>
                  </div>
                </div>
                <div className="text-xs text-slate-500">Teacher: {a.teacher_name}<br />{a.ends_at ? `Closes ${formatDate(a.ends_at)}` : ''}</div>
                <div className="flex gap-2">
                  <Link to={`/student/assessments/${a.id}`} className="btn-secondary flex-1 text-xs">Details</Link>
                  {a.submission_id ? (
                    <Link to={`/student/submissions/${a.submission_id}`} className="btn-primary flex-1 text-xs">View Submission</Link>
                  ) : (
                    <Link to={`/student/assessments/${a.id}/attempt`} className="btn-primary flex-1 text-xs">Start</Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
