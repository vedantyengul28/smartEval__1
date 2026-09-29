import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import * as service from '../../services/assessments'
import { unwrap, getMessage } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { Loader, StatusBadge, formatDate } from '../../components/Common'

export default function StudentAssessmentDetail() {
  const { id } = useParams()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)

  useEffect(() => {
    (async () => {
      try {
        setLoading(true)
        setData(unwrap(await service.getAssessment(id, true)))
      } catch (e) { toast.error(getMessage(e)) }
      finally { setLoading(false) }
    })()
  }, [id])

  if (loading) return <Loader size="lg" />
  if (!data) return null

  const questions = data.questions || []

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/student/assessments" className="hover:text-brand-600">Assessments</Link>
        <span>/</span><span className="text-slate-700">{data.title}</span>
      </div>
      <div className="card">
        <div className="card-body space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-900 truncate">{data.title}</h1>
                <StatusBadge status={data.status} />
              </div>
              <p className="text-slate-500 mt-1">{data.description || 'No description'}</p>
            </div>
            {data.submission_id ? (
              <Link to={`/student/submissions/${data.submission_id}`} className="btn-primary">View My Submission</Link>
            ) : (
              <Link to={`/student/assessments/${id}/attempt`} className="btn-primary">Start Attempt →</Link>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-slate-500 uppercase tracking-wide">Questions</div>
              <div className="text-xl font-bold mt-1">{questions.length}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-slate-500 uppercase tracking-wide">Marks</div>
              <div className="text-xl font-bold mt-1">{data.total_marks}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-slate-500 uppercase tracking-wide">Duration</div>
              <div className="text-xl font-bold mt-1">{data.duration_minutes ? `${data.duration_minutes}m` : '—'}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-slate-500 uppercase tracking-wide">Created</div>
              <div className="text-xs font-semibold mt-1">{formatDate(data.created_at)}</div>
            </div>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-header"><h3 className="font-semibold">Questions</h3></div>
        <div className="card-body">
          <div className="space-y-3">
            {questions.map((q) => (
              <div key={q.id} className="p-4 rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="w-8 h-8 rounded bg-brand-50 text-brand-700 font-bold flex items-center justify-center text-sm">{q.question_number}</div>
                  <div className="font-medium text-slate-800">{q.title}</div>
                  <span className={`badge ${q.question_type === 'subjective' ? 'bg-brand-50 text-brand-700' : 'bg-violet-50 text-violet-700'}`}>{q.question_type}</span>
                  <span className="badge bg-slate-100 text-slate-700">{q.max_marks} marks</span>
                  {q.programming_language && <span className="badge bg-amber-50 text-amber-700">{q.programming_language}</span>}
                </div>
                <p className="text-sm text-slate-600 whitespace-pre-wrap pl-10">{q.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
