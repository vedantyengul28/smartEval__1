import { useEffect, useState } from 'react'
import * as service from '../../services/submissions'
import { unwrap, getMessage } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { Loader, EmptyState, Badge, formatDate } from '../../components/Common'

function gradeClass(g) {
  switch (g) {
    case 'A': return 'from-emerald-50 to-white border-emerald-200'
    case 'B': return 'from-sky-50 to-white border-sky-200'
    case 'C': return 'from-indigo-50 to-white border-indigo-200'
    case 'D': return 'from-amber-50 to-white border-amber-200'
    default: return 'from-red-50 to-white border-red-200'
  }
}

export default function StudentResults() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [results, setResults] = useState([])

  useEffect(() => {
    (async () => {
      try {
        const submissions = unwrap(await service.listMySubmissions()) || []
        // Filter submissions that have approved evaluations
        const withResults = submissions.filter(s => s.grade && s.grade !== 'F')
        setResults(withResults)
      } catch (e) { toast.error(getMessage(e)) }
      finally { setLoading(false) }
    })()
  }, [])

  if (loading) return <Loader size="lg" />

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Results</h1>
        <p className="text-slate-500 mt-1 text-sm">Approved and released results from your assessments.</p>
      </div>
      {results.length === 0 ? (
        <EmptyState icon="R" title="No results yet" subtitle="Released results will appear here after your teacher approves them." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {results.map((r) => (
            <div key={r.id} className={`card bg-gradient-to-br ${gradeClass(r.grade)}`}>
              <div className="card-body space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-slate-900">{r.assessment_title}</div>
                    <div className="text-xs text-slate-500 mt-0.5">by {r.teacher_name}</div>
                  </div>
                  <Badge className={`border ${r.grade === 'A' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : r.grade === 'B' ? 'bg-sky-100 text-sky-800 border-sky-200' : r.grade === 'C' ? 'bg-indigo-100 text-indigo-800 border-indigo-200' : r.grade === 'D' ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-red-100 text-red-800 border-red-200'}`}>
                    Grade {r.grade || '—'}
                  </Badge>
                </div>
                <div className="rounded-lg bg-white/70 backdrop-blur p-4 flex items-end justify-between border border-white/50">
                  <div>
                    <div className="text-xs text-slate-500 uppercase">Score</div>
                    <div className="text-3xl font-bold text-slate-900">
                      {parseFloat(r.total_marks_awarded || 0).toFixed(1)}
                      <span className="text-base font-normal text-slate-500"> / {r.total_marks_max || r.assessment_total_marks}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Percentage</div>
                    <div className="text-2xl font-bold">{parseFloat(r.percentage || 0).toFixed(1)}%</div>
                  </div>
                </div>
                <div className="w-full bg-white/70 rounded-full h-2 overflow-hidden">
                  <div className={`h-full ${r.grade === 'A' ? 'bg-emerald-500' : r.grade === 'B' ? 'bg-sky-500' : r.grade === 'C' ? 'bg-indigo-500' : r.grade === 'D' ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(100, parseFloat(r.percentage || 0))}%` }} />
                </div>
                <div className="text-xs text-slate-500">Released: {formatDate(r.released_at)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
