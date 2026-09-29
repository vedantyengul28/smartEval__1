import api from './api'

export function createSubmission(formData) {
  return api.post('/submissions', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export function getSubmission(id) {
  return api.get(`/submissions/${id}`)
}

export function listTeacherSubmissions(assessmentId = null) {
  const params = assessmentId ? { assessmentId } : {}
  return api.get('/submissions/teacher/all', { params })
}

export function listMySubmissions() {
  return api.get('/submissions/student/my')
}

export function evaluateSubmission(submissionId) {
  return api.post(`/submissions/${submissionId}/evaluate`)
}

export function getEvaluation(submissionId) {
  return api.get(`/submissions/evaluations/${submissionId}`)
}

export function reviewEvaluation(evaluationId, payload) {
  return api.put(`/submissions/evaluations/${evaluationId}/review`, payload)
}

export function approveEvaluation(evaluationId) {
  return api.post(`/submissions/evaluations/${evaluationId}/approve`)
}
