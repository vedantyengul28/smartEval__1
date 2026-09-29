import api from './api'

export function listAssessments() {
  return api.get('/assessments')
}

export function getAssessment(id, includeQuestions = false) {
  return api.get(`/assessments/${id}`, { params: { includeQuestions } })
}

export function createAssessment(payload) {
  return api.post('/assessments', payload)
}

export function updateAssessment(id, payload) {
  return api.put(`/assessments/${id}`, payload)
}

export function deleteAssessment(id) {
  return api.delete(`/assessments/${id}`)
}

export function publishAssessment(id) {
  return api.post(`/assessments/${id}/publish`)
}
