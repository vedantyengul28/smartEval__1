import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import * as service from '../../services/submissions'
import { unwrap, getMessage } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { Loader, StatusBadge, formatDate, Modal, MarkDisplay } from '../../components/Common'
import Editor from '@monaco-editor/react'

export default function TeacherSubmissionDetail() {
  const { id } = useParams()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [sub, setSub] = useState(null)
  const [evaluating, setEvaluating] = useState(false)
  const [reviewEval, setReviewEval] = useState(null)
  const [reviewForm, setReviewForm] = useState({ finalMarks: 0, teacherFeedback: '' })

  const load = async () => {
    try {
      setLoading(true)
      setSub(unwrap(await service.getSubmission(id)))
    } catch (e) { toast.error(getMessage(e)) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [id])

  const triggerEvaluate = async () => {
    setEvaluating(true)
    try {
      await service.evaluateSubmission(id)
      toast.success('Evaluation pipeline completed!')
      load()
    } catch (e) { toast.error(getMessage(e, 'Evaluation failed')) }
    finally { setEvaluating(false) }
  }

  const openReview = (evalRow) => {
    setReviewEval(evalRow)
    setReviewForm({
      finalMarks: evalRow.final_marks || evalRow.ai_marks || 0,
      teacherFeedback: evalRow.teacher_feedback || '',
    })
  }

  const saveReview = async () => {
    try {
      await service.reviewEvaluation(reviewEval.id, reviewForm)
      toast.success('Review saved')
      setReviewEval(null)
      load()
    } catch (e) { toast.error(getMessage(e, 'Save review failed')) }
  }

  const approveEval = async (evalId) => {
    if (!confirm('Approve marks? Students will be able to see results once all evaluations are approved.')) return
    try {
      await service.approveEvaluation(evalId)
      toast.success('Approved!')
      load()
    } catch (e) { toast.error(getMessage(e, 'Approval failed')) }
  }

  if (loading) return <Loader size="lg" />
  if (!sub) return null

  const evalsById = Object.fromEntries((sub.evaluations || []).map((e) => [e.question_id, e]))
  const allAnswers = [
    ...(sub.answers || []).map((a) => ({ ...a, kind: 'subjective' })),
    ...(sub.programming_submissions || []).map((a) => ({ ...a, kind: 'programming' })),
  ].sort((a, b) => (a.question_number || 0) - (b.question_number || 0))

  const readyToEvaluate = (sub.status === 'pending') && allAnswers.length > 0
  const totalMax = allAnswers.reduce((sum, a) => sum + (a.marks || 0), 0)
  const totalAwarded = (sub.evaluations || []).reduce((sum, e) => sum + (e.final_marks || e.ai_marks || 0), 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/teacher/submissions" className="hover:text-brand-600">Submissions</Link>
        <span>/</span><span className="text-slate-700">#{id.slice(0, 8)}</span>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-900">{sub.assessment_title}</h1>
                <StatusBadge status={sub.status} />
              </div>
              <div className="mt-2 text-sm text-slate-600">
                <span className="font-medium text-slate-800">{sub.student_name}</span>
                <span className="mx-2">·</span>{sub.student_email}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Submitted: {formatDate(sub.submitted_at || sub.created_at)}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-right">
                <div className="text-xs text-slate-500 uppercase tracking-wide">Total</div>
                <MarkDisplay awarded={totalAwarded} max={totalMax} />
              </div>
              {readyToEvaluate && (
                <button onClick={triggerEvaluate} disabled={evaluating} className="btn-primary">
                  {evaluating ? <Loader size="sm" text="Evaluating..." /> : 'Run AI Evaluation'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {allAnswers.length === 0 ? (
        <div className="card"><div className="card-body text-center text-slate-500 py-10">No answers submitted.</div></div>
      ) : (
        <div className="space-y-5">
          {allAnswers.map((ans) => {
            const evalRow = evalsById[ans.question_id]
            const isProgramming = ans.kind === 'programming'
            return (
              <div key={ans.id} className="card animate-fade-in">
                <div className="card-header flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs uppercase font-bold text-slate-400">Q{ans.question_number || '?'}</span>
                      <h3 className="font-semibold text-slate-800">{ans.question_text?.slice(0, 100) || 'Question'}</h3>
                      <span className={`badge ${isProgramming ? 'bg-violet-50 text-violet-700' : 'bg-indigo-50 text-indigo-700'}`}>
                        {isProgramming ? 'Programming' : 'Subjective'}
                      </span>
                      <span className="badge bg-slate-100 text-slate-700">{ans.marks} marks</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {evalRow && (
                      <button onClick={() => openReview(evalRow)} className="btn-secondary text-xs">Edit Marks</button>
                    )}
                    {evalRow && evalRow.status === 'reviewed' && (
                      <button onClick={() => approveEval(evalRow.id)} className="btn-success text-xs">Approve</button>
                    )}
                    {evalRow?.status === 'approved' && (
                      <span className="badge bg-emerald-50 text-emerald-700">Approved</span>
                    )}
                  </div>
                </div>
                <div className="card-body grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <div className="text-xs uppercase font-semibold text-slate-500 mb-2">Student Answer</div>
                    {isProgramming ? (
                      <div className="rounded-lg border border-slate-300 overflow-hidden">
                        <div className="bg-slate-800 px-4 py-2 text-xs text-slate-300 flex items-center justify-between">
                          <span className="uppercase font-semibold">Source Code — {ans.programming_language}</span>
                          <span className="text-slate-400">{ans.status || ''}</span>
                        </div>
                        <Editor
                          height="300px"
                          language={ans.programming_language || 'python'}
                          value={ans.source_code || ''}
                          theme="vs-dark"
                          options={{
                            readOnly: true,
                            minimap: { enabled: false },
                            fontSize: 14,
                            lineNumbers: 'on',
                            scrollBeyondLastLine: false,
                          }}
                        />
                      </div>
                    ) : (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 min-h-[180px] space-y-3">
                        {ans.file_path && (
                          <div className="rounded-lg bg-white p-3 border border-slate-200">
                            <div className="text-xs font-semibold text-slate-500 mb-1">Uploaded file</div>
                              <div className="text-brand-600 text-sm break-all">{ans.file_path.split('\\').pop()}</div>
                          </div>
                        )}
                        {evalRow?.extracted_text && (
                          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                            <div className="text-xs font-semibold text-amber-700 mb-1">Text extracted via OCR</div>
                            <div className="whitespace-pre-wrap text-sm text-amber-900">{evalRow.extracted_text}</div>
                          </div>
                        )}
                        {ans.answer_text && (
                          <div className="whitespace-pre-wrap text-sm text-slate-800">{ans.answer_text}</div>
                        )}
                        {!ans.answer_text && !evalRow?.extracted_text && !ans.file_path && (
                          <div className="text-slate-400 text-sm italic">No answer submitted</div>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-xs uppercase font-semibold text-slate-500 mb-2">Evaluation</div>
                    {!evalRow ? (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-500 min-h-[180px] flex items-center justify-center">
                        <div>
                          <div className="text-sm">Run AI evaluation above to generate marks.</div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between rounded-lg bg-slate-50 p-4 border border-slate-200">
                          <div>
                            <div className="text-xs uppercase tracking-wide text-slate-500">Marks Awarded</div>
                            <MarkDisplay awarded={parseFloat(evalRow.final_marks || evalRow.ai_marks || 0)} max={ans.marks} />
                          </div>
                          <div className="text-right space-y-1">
                            <div className="text-xs">
                              {evalRow.status === 'reviewed' && <span className="badge bg-brand-50 text-brand-700 mr-1">Reviewed</span>}
                              {evalRow.status === 'approved' ? (
                                <span className="badge bg-emerald-50 text-emerald-700">Approved</span>
                              ) : <span className="badge bg-amber-50 text-amber-700">Pending Review/Approval</span>}
                            </div>
                          </div>
                        </div>
                        {evalRow.ai_feedback && (
                          <div className="rounded-lg bg-brand-50/60 border border-brand-100 p-4">
                            <div className="text-xs uppercase tracking-wide text-brand-700 font-semibold mb-1">AI Feedback</div>
                            <div className="text-sm text-slate-700 whitespace-pre-wrap">{evalRow.ai_feedback}</div>
                          </div>
                        )}
                        {evalRow.teacher_feedback && (
                          <div className="rounded-lg bg-indigo-50/60 border border-indigo-100 p-4">
                            <div className="text-xs uppercase tracking-wide text-indigo-700 font-semibold mb-1">Teacher Feedback</div>
                            <div className="text-sm text-slate-700 whitespace-pre-wrap">{evalRow.teacher_feedback}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal
        open={!!reviewEval}
        onClose={() => setReviewEval(null)}
        title="Adjust Marks & Review"
        size="md"
        actions={<>
          <button onClick={() => setReviewEval(null)} className="btn-secondary">Cancel</button>
          <button onClick={saveReview} className="btn-primary">Save Review</button>
        </>}
      >
        <div className="space-y-4">
          <div className="text-sm text-slate-500">
            You can modify the AI-generated marks and provide feedback to the student.
          </div>
          <div>
            <label className="label">Final Marks</label>
            <input type="number" min={0} step={0.1}
              className="input"
              value={reviewForm.finalMarks}
              onChange={(e) => setReviewForm({ ...reviewForm, finalMarks: parseFloat(e.target.value) || 0 })} />
          </div>
          <div>
            <label className="label">Teacher Feedback</label>
            <textarea className="textarea" rows={4} value={reviewForm.teacherFeedback}
              onChange={(e) => setReviewForm({ ...reviewForm, teacherFeedback: e.target.value })}
              placeholder="Add your feedback for the student..." />
          </div>
        </div>
      </Modal>
    </div>
  )
}
