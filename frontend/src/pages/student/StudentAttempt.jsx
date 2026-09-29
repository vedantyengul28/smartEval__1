import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import * as aService from '../../services/assessments'
import * as sService from '../../services/submissions'
import * as cService from '../../services/code'
import { unwrap, getMessage } from '../../services/api'
import { useToast } from '../../context/ToastContext'
import { Loader, Badge, Modal } from '../../components/Common'
import Editor from '@monaco-editor/react'

export default function StudentAttempt() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [assessment, setAssessment] = useState(null)
  const [answers, setAnswers] = useState({})
  const [files, setFiles] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [runningCode, setRunningCode] = useState(false)
  const [testResults, setTestResults] = useState({})

  const load = async () => {
    try {
      setLoading(true)
      const a = unwrap(await aService.getAssessment(id, true))
      setAssessment(a)
      const ans = {}
      for (const q of a.questions || []) {
        if (q.question_type === 'programming') {
          ans[q.id] = { questionType: 'programming', sourceCode: '', programmingLanguage: 'python' }
        } else {
          ans[q.id] = { questionType: 'subjective', textAnswer: '' }
        }
      }
      setAnswers(ans)
    } catch (e) { toast.error(getMessage(e)) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [id])

  const questions = useMemo(() => assessment?.questions || [], [assessment])

  const setSubjectiveAnswer = (qid, value) => {
    setAnswers((prev) => ({ ...prev, [qid]: { ...prev[qid], textAnswer: value } }))
  }

  const setCodeAnswer = (qid, value) => {
    setAnswers((prev) => ({ ...prev, [qid]: { ...prev[qid], sourceCode: value } }))
  }

  const setLanguage = (qid, value) => {
    setAnswers((prev) => ({ ...prev, [qid]: { ...prev[qid], programmingLanguage: value } }))
  }

  const onFileChange = (qid, list) => {
    if (list && list[0]) {
      setFiles((prev) => ({ ...prev, [qid]: list[0] }))
    }
  }
  const removeFile = (qid) => {
    setFiles((prev) => { const n = { ...prev }; delete n[qid]; return n })
  }

  const runCode = async (qid) => {
    const a = answers[qid] || {}
    if (!a.sourceCode) {
      toast.error('Please write some code first')
      return
    }
    setRunningCode(true)
    try {
      const result = await cService.runCodeSingle({
        sourceCode: a.sourceCode,
        programmingLanguage: a.programmingLanguage,
      })
      setTestResults((prev) => ({ ...prev, [qid]: result }))
      toast.success('Code executed successfully')
    } catch (e) {
      toast.error(getMessage(e, 'Code execution failed'))
    } finally {
      setRunningCode(false)
    }
  }

  const prepareSubmission = () => {
    const fd = new FormData()
    const answersPayload = []
    for (const q of questions) {
      const a = answers[q.id] || {}
      if (q.question_type === 'programming') {
        const entry = { questionId: q.id, questionType: 'programming', sourceCode: a.sourceCode || '', programmingLanguage: a.programmingLanguage || 'python' }
        answersPayload.push(entry)
      } else {
        const entry = { questionId: q.id, questionType: 'subjective', textAnswer: a.textAnswer || '' }
        if (files[q.id]) {
          fd.append(`file_${q.id}`, files[q.id], files[q.id].name)
        }
        answersPayload.push(entry)
      }
    }
    fd.append('assessmentId', id)
    fd.append('answers', JSON.stringify(answersPayload))
    return fd
  }

  const submitAll = async () => {
    setSubmitting(true)
    try {
      const fd = prepareSubmission()
      const r = await sService.createSubmission(fd)
      const submissionId = r.data?.data?.id
      toast.success('Answers submitted successfully!')
      navigate(`/student/submissions/${submissionId}`)
    } catch (e) { toast.error(getMessage(e, 'Submission failed')) }
    finally {
      setSubmitting(false)
      setConfirmOpen(false)
    }
  }

  if (loading) return <Loader size="lg" />
  if (!assessment) return null

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/student/assessments" className="hover:text-brand-600">Assessments</Link>
        <span>/</span>
        <Link to={`/student/assessments/${id}`} className="hover:text-brand-600">{assessment.title}</Link>
        <span>/</span><span className="text-slate-700">Attempt</span>
      </div>
      <div className="sticky top-[73px] z-10 bg-white border-b border-slate-200 rounded-xl shadow-sm px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{assessment.title}</h1>
          <p className="text-xs text-slate-500 mt-0.5">{questions.length} questions · {assessment.total_marks} marks</p>
        </div>
        <div className="flex gap-2">
          <Link to={`/student/assessments/${id}`} className="btn-secondary text-sm">Save & Exit</Link>
          <button onClick={() => setConfirmOpen(true)} disabled={submitting} className="btn-success text-sm">
            {submitting ? <Loader size="sm" text="Submitting..." /> : 'Submit Assessment'}
          </button>
        </div>
      </div>
      <div className="space-y-6">
        {questions.map((q) => {
          const ans = answers[q.id] || {}
          const isProgramming = q.question_type === 'programming'
          return (
            <div key={q.id} className="card animate-fade-in">
              <div className="card-header">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-lg ${isProgramming ? 'bg-gradient-to-br from-violet-100 to-purple-100 text-violet-700' : 'bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-700'} font-bold flex items-center justify-center shrink-0`}>
                    {q.question_number}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-slate-900">{q.question_text?.slice(0, 100) || 'Question'}</h3>
                      <span className={`badge ${isProgramming ? 'bg-violet-50 text-violet-700' : 'bg-indigo-50 text-indigo-700'}`}>
                        {isProgramming ? 'Programming' : 'Subjective'}
                      </span>
                      <span className="badge bg-slate-100 text-slate-700">{q.marks} marks</span>
                    </div>
                    <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{q.question_text}</p>
                  </div>
                </div>
              </div>
              <div className="card-body space-y-4">
                {isProgramming ? (
                  <>
                    <div className="flex items-center gap-4">
                      <label className="label mb-0">Language:</label>
                      <select
                        value={ans.programmingLanguage || 'python'}
                        onChange={(e) => setLanguage(q.id, e.target.value)}
                        className="input w-auto"
                      >
                        <option value="python">Python</option>
                        <option value="javascript">JavaScript</option>
                        <option value="java">Java</option>
                        <option value="cpp">C++</option>
                        <option value="c">C</option>
                      </select>
                      <button
                        onClick={() => runCode(q.id)}
                        disabled={runningCode}
                        className="btn-secondary text-sm"
                      >
                        {runningCode ? <Loader size="sm" text="Running..." /> : '▶ Run Code'}
                      </button>
                    </div>
                    <div className="rounded-lg border border-slate-300 overflow-hidden">
                      <Editor
                        height="300px"
                        language={ans.programmingLanguage || 'python'}
                        value={ans.sourceCode || ''}
                        onChange={(value) => setCodeAnswer(q.id, value || '')}
                        theme="vs-dark"
                        options={{
                          minimap: { enabled: false },
                          fontSize: 14,
                          lineNumbers: 'on',
                          scrollBeyondLastLine: false,
                        }}
                      />
                    </div>
                    {testResults[q.id] && (
                      <div className="rounded-lg bg-slate-900 p-4 text-sm">
                        <div className="text-slate-400 mb-2">Output:</div>
                        <pre className="text-green-400 whitespace-pre-wrap">{testResults[q.id].stdout || testResults[q.id].stderr || testResults[q.id].compile_output || 'No output'}</pre>
                        {testResults[q.id].status && (
                          <div className={`mt-2 ${testResults[q.id].status === 'accepted' ? 'text-green-400' : 'text-red-400'}`}>
                            Status: {testResults[q.id].status}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div>
                      <label className="label">Your Answer</label>
                      <textarea
                        value={ans.textAnswer || ''}
                        onChange={(e) => setSubjectiveAnswer(q.id, e.target.value)}
                        rows={8}
                        className="textarea"
                        placeholder="Write your answer here..."
                      />
                      <p className="text-xs text-slate-400 mt-1">{(ans.textAnswer || '').split(/\s+/).filter(Boolean).length} words</p>
                    </div>
                    <div>
                      <label className="label">Or upload handwritten answer (PNG, JPG, PDF)</label>
                      <p className="text-xs text-slate-500 mb-2">Upload will be processed using OCR for AI evaluation</p>
                      {files[q.id] ? (
                        <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 p-4 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold truncate text-slate-800">📄 {files[q.id].name}</div>
                            <div className="text-xs text-slate-500">{Math.round(files[q.id].size / 1024)} KB</div>
                          </div>
                          <button onClick={() => removeFile(q.id)} className="btn-ghost text-sm text-red-600">Remove</button>
                        </div>
                      ) : (
                        <label className="block border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-gradient-to-br hover:from-indigo-50 hover:to-purple-50 rounded-xl p-8 cursor-pointer transition text-center">
                          <input type="file" accept=".png,.jpg,.jpeg,.pdf" className="hidden"
                            onChange={(e) => onFileChange(q.id, e.target.files)} />
                          <div className="text-4xl mb-3">📤</div>
                          <div className="text-sm text-slate-700 font-semibold">Click to upload handwritten answer</div>
                          <div className="text-xs text-slate-500 mt-1">Supports PNG, JPG, PDF up to 10MB</div>
                        </label>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm Submission"
        actions={<>
          <button onClick={() => setConfirmOpen(false)} className="btn-secondary">Cancel</button>
          <button onClick={submitAll} disabled={submitting} className="btn-success">Yes, Submit</button>
        </>}>
        <p className="text-slate-700">
          Are you ready to submit your answers? After submission, your work will be sent for AI evaluation, and your teacher will review and finalize the marks.
        </p>
        <ul className="text-sm text-slate-600 mt-3 space-y-1 list-disc pl-5">
          <li>Subjective answers will be evaluated using semantic similarity and rubric-based scoring.</li>
          <li>Handwritten uploads (if any) will be processed via OCR first.</li>
        </ul>
      </Modal>
    </div>
  )
}
