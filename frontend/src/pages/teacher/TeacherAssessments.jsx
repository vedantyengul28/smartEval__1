import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import * as service from '../../services/assessments'
import { unwrap, getMessage } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { Loader, EmptyState, StatusBadge, formatDate } from '../../components/Common'

export default function TeacherAssessments() {
  const toast = useToast()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  const load = async () => {
    try {
      setLoading(true)
      setList(unwrap(await service.listAssessments()) || [])
    } catch (e) { toast.error(getMessage(e, 'Failed to load assessments')) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const onDelete = async (id, title) => {
    if (!confirm(`Delete assessment "${title}"? This cannot be undone.`)) return
    try {
      await service.deleteAssessment(id)
      toast.success('Assessment deleted')
      load()
    } catch (e) { toast.error(getMessage(e, 'Delete failed')) }
  }

  const onPublish = async (id) => {
    try {
      await service.publishAssessment(id)
      toast.success('Assessment published!')
      load()
    } catch (e) { toast.error(getMessage(e, 'Publish failed')) }
  }

  const filtered = filter === 'all' ? list : list.filter((a) => a.status === filter)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Assessments</h1>
          <p className="text-slate-500 mt-1 text-sm">Create, manage, and publish your assessments.</p>
        </div>
        <Link to="/teacher/assessments/create" className="btn-primary">+ New Assessment</Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {[['all', 'All'], ['draft', 'Draft'], ['published', 'Published'], ['closed', 'Closed']].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded-full text-sm border transition ${filter === k ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
            {l}
          </button>
        ))}
      </div>

      {loading ? <Loader size="lg" text="Loading assessments..." /> : filtered.length === 0 ? (
        <EmptyState icon="📑" title="No assessments found"
          subtitle="Create your first assessment to begin evaluating."
          action={<Link to="/teacher/assessments/create" className="btn-primary">Create Assessment</Link>} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((a) => (
            <div key={a.id} className="card hover:shadow-md transition">
              <div className="card-body space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-800">{a.title}</h3>
                    {a.description && <p className="text-sm text-slate-500 mt-1 line-clamp-2">{a.description}</p>}
                  </div>
                  <StatusBadge status={a.status} />
                </div>
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
                    <div className="text-lg font-semibold">{a.submission_count || 0}</div>
                    <div className="text-[10px] uppercase text-slate-500">Subs</div>
                  </div>
                </div>
                <div className="text-xs text-slate-500">Created {formatDate(a.created_at)}</div>
                <div className="flex flex-wrap gap-2">
                  <Link to={`/teacher/assessments/${a.id}`} className="btn-secondary flex-1 text-xs">View</Link>
                  <Link to={`/teacher/assessments/${a.id}/questions`} className="btn-secondary flex-1 text-xs">Questions</Link>
                  {a.status === 'draft' && (
                    <button onClick={() => onPublish(a.id)} className="btn-success flex-1 text-xs">Publish</button>
                  )}
                  <button onClick={() => onDelete(a.id, a.title)} className="btn-ghost text-red-600 text-xs">🗑</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
