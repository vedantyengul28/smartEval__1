import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as service from '../../services/assessments'
import { getMessage } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { Loader } from '../../components/Common'

export default function TeacherCreateAssessment() {
  const navigate = useNavigate()
  const toast = useToast()
  const [form, setForm] = useState({
    title: '', description: '', durationMinutes: '', startsAt: '', endsAt: '',
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const onSubmit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!form.title.trim()) errs.title = 'Title is required'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSubmitting(true)
    try {
      const payload = {
        ...form,
        durationMinutes: form.durationMinutes ? parseInt(form.durationMinutes) : null,
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
      }
      const res = await service.createAssessment(payload)
      const id = res.data?.data?.id
      toast.success('Assessment created! Now add questions.')
      navigate(`/teacher/assessments/${id}/questions`)
    } catch (err) {
      toast.error(getMessage(err, 'Failed to create assessment'))
    } finally { setSubmitting(false) }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Create Assessment</h1>
        <p className="text-slate-500 mt-1 text-sm">Fill in the details. You'll add questions next.</p>
      </div>
      <div className="card max-w-3xl">
        <div className="card-body">
          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label className="label">Title <span className="text-red-500">*</span></label>
              <input className="input" value={form.title} onChange={update('title')} placeholder="e.g. CS101 Midterm — Data Structures" />
              {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title}</p>}
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="textarea" rows={4} value={form.description} onChange={update('description')}
                placeholder="Briefly describe what this assessment covers, learning outcomes, etc." />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">Duration (minutes)</label>
                <input type="number" min={1} className="input" value={form.durationMinutes} onChange={update('durationMinutes')} placeholder="90" />
              </div>
              <div>
                <label className="label">Starts at</label>
                <input type="datetime-local" className="input" value={form.startsAt} onChange={update('startsAt')} />
              </div>
              <div>
                <label className="label">Ends at</label>
                <input type="datetime-local" className="input" value={form.endsAt} onChange={update('endsAt')} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
              <button type="button" onClick={() => navigate('/teacher/assessments')} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? <Loader size="sm" text="Saving..." /> : 'Create & Add Questions'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
