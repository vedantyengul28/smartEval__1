import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import * as service from '../../services/submissions'
import { unwrap, getMessage } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { Loader, EmptyState, StatusBadge, formatDate, Badge } from '../../components/Common'

export default function TeacherSubmissions() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [list, setList] = useState([])
  const [filter, setFilter] = useState('all')

  const load = async () => {
    try {
      setLoading(true)
      setList(unwrap(await service.listTeacherSubmissions()) || [])
    } catch (e) { toast.error(getMessage(e)) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const filtered = filter === 'all' ? list : list.filter((s) => s.status === filter)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Submissions</h1>
        <p className="text-slate-500 mt-1 text-sm">Review and evaluate student submissions.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {[['all', 'All'], ['pending', 'Pending'], ['evaluating', 'Evaluating'], ['evaluated', 'Evaluated'], ['reviewed', 'Reviewed'], ['approved', 'Approved']].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded-full text-sm border transition ${filter === k ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
            {l}
          </button>
        ))}
      </div>

      {loading ? <Loader size="lg" /> : filtered.length === 0 ? (
        <EmptyState icon="📭" title="No submissions yet" subtitle="Students haven't submitted any assessments in this view." />
      ) : (
        <div className="card">
          <div className="table-wrapper border-0">
            <table className="table">
              <thead><tr>
                <th>Student</th><th>Assessment</th><th>Submitted</th>
                <th>Score</th><th>Status</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div className="font-medium text-slate-800">{s.student_name}</div>
                      <div className="text-xs text-slate-500">{s.student_email}</div>
                    </td>
                    <td>{s.assessment_title}</td>
                    <td className="text-xs text-slate-500 whitespace-nowrap">{formatDate(s.submitted_at || s.created_at)}</td>
                    <td>
                      {s.status === 'approved' || s.status === 'reviewed' || s.status === 'evaluated' ? (
                        <div>
                          <span className="font-semibold">{s.total_marks_awarded || 0}</span>
                          <span className="text-slate-500 text-sm"> / {s.assessment_total_marks || s.total_marks_max || 0}</span>
                          {s.grade && <Badge variant="primary" className="ml-2">{s.grade}</Badge>}
                        </div>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td><StatusBadge status={s.status} /></td>
                    <td>
                      <Link to={`/teacher/submissions/${s.id}`} className="btn-primary text-xs">Open</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
