import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import * as service from '../../services/assessments'
import { unwrap, getMessage } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { Loader, StatusBadge, formatDate } from '../../components/Common'

export default function TeacherAssessmentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', durationMinutes: '' })

  const load = async () => {
    try {
      setLoading(true)
      const a = unwrap(await service.getAssessment(id, true))
      setData(a)
      setForm({
        title: a.title, description: a.description || '',
        durationMinutes: a.duration_minutes || '',
      })
    } catch (e) { toast.error(getMessage(e, 'Failed to load assessment')) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [id])

  const onPublish = async () => {
    try {
      await service.publishAssessment(id)
      toast.success('Assessment published successfully')
      load()
    } catch (e) { toast.error(getMessage(e, 'Publish failed')) }
  }

  const save = async () => {
    try {
      await service.updateAssessment(id, {
        title: form.title, description: form.description,
        durationMinutes: form.durationMinutes ? parseInt(form.durationMinutes) : null,
      })
      toast.success('Saved')
      setEditing(false)
      load()
    } catch (e) { toast.error(getMessage(e, 'Save failed')) }
  }

  if (loading) return <Loader size="lg" text="Loading..." />
  if (!data) return null

  const questions = data.questions || []

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/teacher/assessments" className="hover:text-brand-600">Assessments</Link>
        <span>/</span><span className="text-slate-700">{data.title}</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 truncate">{data.title}</h1>
            <StatusBadge status={data.status} />
          </div>
          <p className="text-slate-500 mt-1">{data.description || 'No description provided.'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.status === 'draft' && (
            <button onClick={onPublish}
              disabled={questions.length === 0}
              title={questions.length === 0 ? 'Add questions first' : ''}
              className="btn-success">Publish</button>
          )}
          <Link to={`/teacher/assessments/${id}/questions`} className="btn-primary">Manage Questions</Link>
          <button onClick={() => setEditing((e) => !e)} className="btn-secondary">{editing ? 'Cancel' : 'Edit'}</button>
        </div>
      </div>

      {editing && (
        <div className="card">
          <div className="card-body space-y-4">
            <h3 className="font-semibold">Edit details</h3>
            <div>
              <label className="label">Title</label>
              <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="textarea" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <label className="label">Duration (minutes)</label>
              <input type="number" className="input" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
              <button onClick={save} className="btn-primary">Save</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wide">Questions</div>
          <div className="text-2xl font-bold mt-1">{questions.length}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wide">Total Marks</div>
          <div className="text-2xl font-bold mt-1">{data.total_marks}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wide">Duration</div>
          <div className="text-2xl font-bold mt-1">{data.duration_minutes ? `${data.duration_minutes} m` : '—'}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wide">Created</div>
          <div className="text-sm font-semibold mt-1">{formatDate(data.created_at)}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="font-semibold">Questions</h3>
          <Link to={`/teacher/assessments/${id}/questions`} className="btn-primary text-sm">+ Add Question</Link>
        </div>
        <div className="card-body">
          {questions.length === 0 ? (
            <div className="text-center py-10 text-slate-500">
              <div className="text-4xl mb-3">Q</div>
              No questions yet. <Link className="text-brand-600 font-medium" to={`/teacher/assessments/${id}/questions`}>Add your first question</Link>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="table">
                <thead><tr>
                  <th>#</th><th>Type</th><th>Title</th><th>Marks</th><th>Rubric/Tests</th>
                </tr></thead>
                <tbody>
                  {questions.map((q) => (
                    <tr key={q.id}>
                      <td className="font-semibold text-slate-700">{q.question_number}</td>
                      <td>
                        <span className={`badge ${q.question_type === 'subjective' ? 'bg-brand-50 text-brand-700' : 'bg-violet-50 text-violet-700'}`}>
                          {q.question_type}
                        </span>
                      </td>
                      <td>
                        <div className="font-medium text-slate-800">{q.title}</div>
                        <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{q.description}</div>
                      </td>
                      <td className="font-semibold">{q.max_marks}</td>
                      <td className="text-sm text-slate-600">
                        {q.question_type === 'subjective'
                          ? (<span className={parseInt(q.criteria_count || 0) > 0 ? 'text-emerald-600' : 'text-amber-600'}>
                              {q.criteria_count || 0} criteria
                            </span>)
                          : (<span className={parseInt(q.test_case_count || 0) > 0 ? 'text-emerald-600' : 'text-amber-600'}>
                              {q.test_case_count || 0} test cases
                            </span>)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
