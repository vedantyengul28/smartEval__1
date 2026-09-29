import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import * as aService from '../../services/assessments'
import * as qService from '../../services/questions'
import { unwrap, getMessage } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { Loader, EmptyState, Modal, Badge, StatusBadge } from '../../components/Common'

export default function TeacherAssessmentQuestions() {
  const { id } = useParams()
  const toast = useToast()
  const [assessment, setAssessment] = useState(null)
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showQModal, setShowQModal] = useState(false)
  const [showRubricModal, setShowRubricModal] = useState(false)
  const [activeQuestion, setActiveQuestion] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [fullDetail, setFullDetail] = useState(null)

  const [qForm, setQForm] = useState({
    questionType: 'subjective', questionNumber: 1, title: '', questionText: '',
    marks: 10, modelAnswer: '', answerMode: 'text',
  })
  const [rubricForm, setRubricForm] = useState([{ criterionName: '', description: '', maximumMarks: 0, keywords: '', sortOrder: 0 }])

  const load = async () => {
    try {
      setLoading(true)
      const a = unwrap(await aService.getAssessment(id, true))
      setAssessment(a)
      setQuestions(a.questions || [])
      if (a.questions && a.questions.length > 0) {
        setQForm((f) => ({ ...f, questionNumber: Math.max(...a.questions.map((q) => q.question_number)) + 1 }))
      }
    } catch (e) { toast.error(getMessage(e)) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [id])

  const openRubric = (q) => {
    setActiveQuestion(q)
    const existing = q.rubric?.criteria || []
    if (existing.length > 0) {
      setRubricForm(existing.map((c, i) => ({
        criterionName: c.criterion_name, description: c.description || '',
        maximumMarks: c.maximum_marks, keywords: c.keywords || '',
        sortOrder: c.sort_order ?? i,
      })))
    } else {
      setRubricForm([{ criterionName: '', description: '', maximumMarks: Math.round(q.max_marks / 2), keywords: '', sortOrder: 0 },
                     { criterionName: '', description: '', maximumMarks: q.max_marks - Math.round(q.max_marks / 2), keywords: '', sortOrder: 1 }])
    }
    setShowRubricModal(true)
  }

  const saveQuestion = async () => {
    try {
      await qService.createQuestion({ assessmentId: id, ...qForm })
      toast.success('Question added')
      setShowQModal(false)
      setQForm({ ...qForm, title: '', questionText: '', modelAnswer: '' })
      load()
    } catch (e) { toast.error(getMessage(e)) }
  }

  const saveRubric = async () => {
    const filtered = rubricForm.filter((r) => r.criterionName.trim())
    if (filtered.length === 0) { toast.error('Add at least one criterion'); return }
    const sum = filtered.reduce((s, r) => s + (r.maximumMarks || 0), 0)
    if (sum !== activeQuestion.marks) {
      toast.error(`Sum of criteria (${sum}) must equal question marks (${activeQuestion.marks})`)
      return
    }
    try {
      await qService.createRubric({ questionId: activeQuestion.id, criteria: filtered })
      toast.success('Rubric saved')
      setShowRubricModal(false)
      load()
    } catch (e) { toast.error(getMessage(e)) }
  }

  const viewDetail = async (q) => {
    setViewing(q.id)
    try {
      setFullDetail(unwrap(await qService.getQuestion(q.id, true)))
    } catch (e) { toast.error(getMessage(e)) }
    finally { setViewing(null) }
  }

  const onDelete = async (qid, title) => {
    if (!confirm(`Delete question "${title}"?`)) return
    try { await qService.deleteQuestion(qid); toast.success('Deleted'); load() }
    catch (e) { toast.error(getMessage(e)) }
  }

  if (loading) return <Loader size="lg" text="Loading questions..." />
  if (!assessment) return null

  const totalMarks = questions.reduce((s, q) => s + q.max_marks, 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/teacher/assessments" className="hover:text-brand-600">Assessments</Link>
        <span>/</span>
        <Link to={`/teacher/assessments/${id}`} className="hover:text-brand-600">{assessment.title}</Link>
        <span>/</span><span className="text-slate-700">Questions</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Questions for {assessment.title}</h1>
          <p className="text-slate-500 mt-1 text-sm">{questions.length} questions · {totalMarks} total marks · Status: </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={assessment.status} />
          <button onClick={() => setShowQModal(true)} disabled={assessment.status === 'published'}
            title={assessment.status === 'published' ? 'Unpublish first' : ''}
            className="btn-primary">+ Add Question</button>
        </div>
      </div>

      {questions.length === 0 ? (
        <EmptyState icon="❓" title="No questions yet"
          subtitle="Add subjective questions with rubrics."
          action={<button className="btn-primary" onClick={() => setShowQModal(true)}>+ Add First Question</button>} />
      ) : (
        <div className="space-y-4">
          {questions.map((q, idx) => (
            <div key={q.id} className="card">
              <div className="card-body space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-700 font-bold flex items-center justify-center shrink-0">
                      {q.question_number}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-slate-900">{q.title}</h3>
                        <Badge variant="primary">Subjective</Badge>
                        <Badge variant="default">{q.marks} marks</Badge>
                      </div>
                      <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{q.question_text}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button onClick={() => viewDetail(q)} disabled={viewing === q.id} className="btn-secondary text-xs">
                      {viewing === q.id ? 'Loading...' : 'View Details'}
                    </button>
                    {assessment.status !== 'published' && (
                      <button onClick={() => openRubric(q)} className="btn-secondary text-xs">Rubric</button>
                    )}
                    {assessment.status !== 'published' && (
                      <button onClick={() => onDelete(q.id, q.title)} className="btn-ghost text-red-600 text-xs">Delete</button>
                    )}
                  </div>
                </div>

                {fullDetail?.id === q.id && (
                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
                    <div className="rounded-lg bg-slate-50 p-4">
                      <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Model Answer</div>
                      <div className="text-sm whitespace-pre-wrap">{fullDetail.model_answer || '—'}</div>
                    </div>
                    {fullDetail.rubric?.criteria && (
                      <div>
                        <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Rubric Criteria</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {fullDetail.rubric.criteria.map((c) => (
                            <div key={c.id} className="rounded-lg border border-slate-200 p-3">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{c.criterion_name}</span>
                                <span className="badge bg-brand-50 text-brand-700">{c.maximum_marks} marks</span>
                              </div>
                              {c.description && <div className="text-xs text-slate-600 mt-1">{c.description}</div>}
                              {c.keywords && <div className="text-xs text-slate-500 mt-1">Keywords: <code>{c.keywords}</code></div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <button onClick={() => setFullDetail(null)} className="text-xs text-slate-500 hover:text-slate-700">Hide details</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showQModal} onClose={() => setShowQModal(false)} title="Add Question"
        actions={<>
          <button onClick={() => setShowQModal(false)} className="btn-secondary">Cancel</button>
          <button onClick={saveQuestion} className="btn-primary">Add Question</button>
        </>}>
        <div className="space-y-4">
          <div>
            <label className="label">Question #</label>
            <input type="number" min={1} className="input" value={qForm.questionNumber}
              onChange={(e) => setQForm({ ...qForm, questionNumber: parseInt(e.target.value) || 1 })} />
          </div>
          <div>
            <label className="label">Title</label>
            <input className="input" value={qForm.title} placeholder="Short title"
              onChange={(e) => setQForm({ ...qForm, title: e.target.value })} />
          </div>
          <div>
            <label className="label">Question Text *</label>
            <textarea className="textarea" rows={4} value={qForm.questionText}
              onChange={(e) => setQForm({ ...qForm, questionText: e.target.value })}
              placeholder="Full question text to display to students." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Marks *</label>
              <input type="number" min={1} className="input" value={qForm.marks}
                onChange={(e) => setQForm({ ...qForm, marks: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="label">Answer Mode</label>
              <select className="input" value={qForm.answerMode}
                onChange={(e) => setQForm({ ...qForm, answerMode: e.target.value })}>
                <option value="text">Text Answer</option>
                <option value="handwritten">Handwritten Upload</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Model Answer (for AI evaluation)</label>
            <textarea className="textarea" rows={4} value={qForm.modelAnswer}
              onChange={(e) => setQForm({ ...qForm, modelAnswer: e.target.value })}
              placeholder="Model answer the AI will compare student answers against." />
          </div>
        </div>
      </Modal>

      <Modal open={showRubricModal} onClose={() => setShowRubricModal(false)} title={`Rubric for Q${activeQuestion?.question_number} (${activeQuestion?.marks} marks)`} size="lg"
        actions={<>
          <button onClick={() => setShowRubricModal(false)} className="btn-secondary">Cancel</button>
          <button onClick={saveRubric} className="btn-primary">Save Rubric</button>
        </>}>
        <div className="space-y-4">
          <p className="text-xs text-slate-500">Sum of criteria marks must equal question total. Add keywords to help the AI mark accurately.</p>
          <div className="space-y-3">
            {rubricForm.map((c, i) => (
              <div key={i} className="p-4 rounded-lg border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700">Criterion #{i + 1}</span>
                  <button className="text-xs text-red-600 hover:underline"
                    onClick={() => setRubricForm((prev) => prev.filter((_, j) => j !== i))}>Remove</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <label className="label">Name</label>
                    <input className="input" placeholder="e.g. Definition, Explanation"
                      value={c.criterionName}
                      onChange={(e) => setRubricForm((prev) => prev.map((x, j) => j === i ? { ...x, criterionName: e.target.value } : x))} />
                  </div>
                  <div>
                    <label className="label">Marks</label>
                    <input type="number" min={0} className="input" value={c.maximumMarks}
                      onChange={(e) => setRubricForm((prev) => prev.map((x, j) => j === i ? { ...x, maximumMarks: parseInt(e.target.value) || 0 } : x))} />
                  </div>
                </div>
                <div>
                  <label className="label">Description (optional)</label>
                  <input className="input" placeholder="What students need to demonstrate"
                    value={c.description}
                    onChange={(e) => setRubricForm((prev) => prev.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
                </div>
                <div>
                  <label className="label">Keywords (comma separated)</label>
                  <input className="input font-mono text-xs" placeholder="LIFO, push, pop, call stack"
                    value={c.keywords}
                    onChange={(e) => setRubricForm((prev) => prev.map((x, j) => j === i ? { ...x, keywords: e.target.value } : x))} />
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <span className="text-slate-600">Total: </span>
              <span className="font-semibold text-slate-900">{rubricForm.reduce((s, r) => s + (r.maximumMarks || 0), 0)}</span>
              <span className="text-slate-500"> / {activeQuestion?.marks || 0}</span>
            </div>
            <button className="btn-secondary text-sm" onClick={() => setRubricForm((p) => [...p, { criterionName: '', description: '', maximumMarks: 0, keywords: '', sortOrder: p.length }])}>
              + Add Criterion
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
