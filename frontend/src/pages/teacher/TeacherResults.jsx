import { useEffect, useState } from 'react'
import * as submissionService from '../../services/submissions'
import { unwrap, getMessage } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { Loader, EmptyState, Badge, formatDate } from '../../components/Common'

function gradeColor(grade) {
  switch (grade) {
    case 'A': return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'B': return 'bg-sky-50 text-sky-700 border-sky-200'
    case 'C': return 'bg-indigo-50 text-indigo-700 border-indigo-200'
    case 'D': return 'bg-amber-50 text-amber-700 border-amber-200'
    default: return 'bg-red-50 text-red-700 border-red-200'
  }
}

export default function TeacherResults() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [results, setResults] = useState([])

  useEffect(() => {
    (async () => {
      try {
        const submissions = unwrap(await submissionService.listTeacherSubmissions()) || []
        const approved = submissions.filter(s => s.status === 'approved')
        setResults(approved)
      } catch (e) { toast.error(getMessage(e)) }
      finally { setLoading(false) }
    })()
  }, [])

  if (loading) return <Loader size="lg" />

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Final Results</h1>
        <p className="text-slate-500 mt-1 text-sm">Approved results across all assessments.</p>
      </div>
      {results.length === 0 ? (
        <EmptyState icon="🎯" title="No approved results yet"
          subtitle="Approve evaluations on submissions to generate final grades here." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {results.map((r) => (
            <div key={r.id} className="card">
              <div className="card-body space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-slate-800 line-clamp-1">{r.assessment_title}</div>
                    <div className="text-sm text-slate-500 mt-0.5">{r.student_name}</div>
                  </div>
                  <Badge className={`border ${gradeColor(r.grade)}`}>Grade {r.grade || '—'}</Badge>
                </div>
                <div className="rounded-lg bg-slate-50 p-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-500">Score</div>
                    <div className="text-xl font-bold text-slate-900">
                      {parseFloat(r.total_marks_awarded).toFixed(1)}
                      <span className="text-sm font-normal text-slate-500"> / {r.total_marks_max}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Percentage</div>
                    <div className="text-xl font-bold text-slate-900">{parseFloat(r.percentage || 0).toFixed(1)}%</div>
                  </div>
                </div>
                {r.overall_feedback && (
                  <div className="text-sm text-slate-600 bg-amber-50 rounded-lg border border-amber-200 p-3 line-clamp-3">
                    {r.overall_feedback}
                  </div>
                )}
                <div className="text-xs text-slate-400">Released: {formatDate(r.released_at)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
