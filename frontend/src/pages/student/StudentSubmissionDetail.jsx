import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import * as service from '../../services/submissions'
import { unwrap, getMessage } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { Loader, StatusBadge, formatDate, Badge, MarkDisplay } from '../../components/Common'

export default function StudentSubmissionDetail() {
  const { id } = useParams()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [sub, setSub] = useState(null)

  const load = async () => {
    try {
      setLoading(true)
      setSub(unwrap(await service.getSubmission(id)))
    } catch (e) { toast.error(getMessage(e)) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [id])

  if (loading) return <Loader size="lg" />
  if (!sub) return null

  const evalsById = Object.fromEntries((sub.evaluations || []).map((e) => [e.question_id, e]))
  const approved = sub.status === 'approved'
  const all = [
    ...(sub.subjective_answers || []).map((a) => ({ ...a, kind: 'subjective' })),
    ...(sub.programming_submissions || []).map((a) => ({ ...a, kind: 'programming' })),
  ].sort((a, b) => a.question_number - b.question_number)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/student/assessments" className="hover:text-brand-600">Assessments</Link>
        <span>/</span><span className="text-slate-700">{sub.assessment_title}</span>
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
                Submitted: {formatDate(sub.submitted_at || sub.created_at)}
              </div>
              {!approved && (
                <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                  ⏳ Your submission is being processed. Your teacher will review and release the final marks soon.
                </div>
              )}
            </div>
            {(sub.status === 'evaluated' || sub.status === 'reviewed' || approved) && (
              <div className="text-right">
                <div className="text-xs uppercase tracking-wide text-slate-500">Total Score</div>
                <MarkDisplay awarded={sub.total_marks_awarded || 0} max={sub.assessment_total_marks || sub.total_marks_max || 0} />
                {approved && (
                  <div className="mt-2 flex items-center justify-end gap-2">
                    {sub.percentage != null && <Badge variant="primary">{parseFloat(sub.percentage).toFixed(1)}%</Badge>}
                    <Badge variant="success">Grade: {sub.grade || '—'}</Badge>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {all.length === 0 ? (
          <div className="card"><div className="card-body text-center text-slate-500 py-10">No answers were submitted.</div></div>
        ) : all.map((ans) => {
          const e = evalsById[ans.question_id]
          const visible = e && (e.is_approved || (e.status === 'completed' && (sub.status === 'evaluated' || sub.status === 'reviewed' || approved)))
          return (
            <div key={ans.id || Math.random()} className="card">
              <div className="card-header">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs uppercase font-bold text-slate-400">Q{ans.question_number}</span>
                  <h3 className="font-semibold text-slate-800">{ans.question_title}</h3>
                  <span className={`badge ${ans.kind === 'subjective' ? 'bg-brand-50 text-brand-700' : 'bg-violet-50 text-violet-700'}`}>{ans.kind}</span>
                  <span className="badge bg-slate-100 text-slate-700">{ans.max_marks} marks</span>
                </div>
              </div>
              <div className="card-body grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <div className="text-xs uppercase font-semibold text-slate-500 mb-2">Your Answer</div>
                  {ans.kind === 'subjective' ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 min-h-[180px] space-y-3">
                      {ans.uploaded_file_path && (
                        <div className="rounded-lg bg-white p-3 border border-slate-200">
                          <Link to={ans.uploaded_file_path} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline text-sm">
                            📄 {ans.uploaded_file_name || 'Uploaded file'}
                          </Link>
                        </div>
                      )}
                      {ans.extracted_text && (
                        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                          <div className="text-xs font-semibold text-amber-700 mb-1">OCR Extracted Text</div>
                          <div className="whitespace-pre-wrap text-sm">{ans.extracted_text}</div>
                        </div>
                      )}
                      {ans.text_answer && <div className="whitespace-pre-wrap text-sm text-slate-800">{ans.text_answer}</div>}
                    </div>
                  ) : (
                    <div className="rounded-lg overflow-hidden border border-slate-200">
                      <div className="bg-slate-800 px-4 py-2 text-xs text-slate-300">{ans.programming_language}</div>
                      <pre className="p-4 bg-slate-900 text-slate-100 text-xs overflow-auto max-h-[300px] whitespace-pre-wrap font-mono">{ans.source_code}</pre>
                      {(ans.compilation_output || ans.runtime_error) && (
                        <pre className="p-3 bg-red-50 text-red-800 text-xs whitespace-pre-wrap border-t border-red-200">{ans.compilation_output}{ans.runtime_error}</pre>
                      )}
                      {ans.test_case_results && Array.isArray(ans.test_case_results) && ans.test_case_results.length > 0 && (
                        <div className="border-t border-slate-200">
                          <div className="px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-600">Test Cases</div>
                          <div className="divide-y">
                            {ans.test_case_results.map((t, i) => (
                              <div key={i} className="px-3 py-2 text-xs">
                                <span className={`badge mr-2 ${t.verdict === 'passed' ? 'bg-emerald-50 text-emerald-700' : t.verdict === 'error' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                                  {t.verdict}
                                </span>
                                <span className="font-mono">{t.marks_awarded}/{t.marks || t.max_marks || '?'}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-xs uppercase font-semibold text-slate-500 mb-2">Evaluation & Feedback</div>
                  {!visible || !e ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-500 min-h-[180px] flex items-center justify-center">
                      <div>
                        <div className="text-4xl mb-2">⏳</div>
                        <div className="text-sm">Results pending teacher review and release.</div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between rounded-lg bg-slate-50 p-4 border border-slate-200">
                        <div>
                          <div className="text-xs uppercase tracking-wide text-slate-500">Marks</div>
                          <MarkDisplay awarded={parseFloat(e.total_marks_awarded || 0)} max={e.total_marks_max || ans.max_marks} />
                        </div>
                        <div className="text-xs text-slate-500">
                          {e.is_teacher_reviewed && <Badge variant="primary" className="mr-1">Teacher reviewed</Badge>}
                          {e.is_approved && <Badge variant="success">Final</Badge>}
                        </div>
                      </div>
                      {e.criteria && e.criteria.length > 0 && (
                        <div className="rounded-lg border divide-y">
                          {e.criteria.map((c) => (
                            <div key={c.id} className="p-3">
                              <div className="flex items-center justify-between">
                                <div className="font-medium text-sm">{c.criterion_name}</div>
                                <div className="text-sm font-semibold">
                                  {parseFloat(c.teacher_override_marks ?? c.awarded_marks ?? 0).toFixed(1)}
                                  <span className="text-slate-500 font-normal"> / {c.max_marks}</span>
                                </div>
                              </div>
                              {c.reason && <p className="text-xs text-slate-600 mt-1">{c.reason}</p>}
                              {c.teacher_notes && <p className="text-xs text-brand-700 mt-1 bg-brand-50 rounded p-2">📝 {c.teacher_notes}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                      {e.overall_feedback && (
                        <div className="rounded-lg bg-brand-50/60 border border-brand-100 p-4">
                          <div className="text-xs uppercase tracking-wide text-brand-700 font-semibold mb-1">Feedback</div>
                          <div className="text-sm whitespace-pre-wrap">{e.overall_feedback}</div>
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
    </div>
  )
}
