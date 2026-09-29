import api from './api'

export function createQuestion(payload) {
  return api.post('/questions', payload)
}

export function getQuestion(id, includeDetails = true) {
  return api.get(`/questions/${id}`, { params: { includeDetails } })
}

export function updateQuestion(id, payload) {
  return api.put(`/questions/${id}`, payload)
}

export function deleteQuestion(id) {
  return api.delete(`/questions/${id}`)
}

export function createRubric(payload) {
  return api.post('/questions/rubrics', payload)
}

export function createTestCase(payload) {
  return api.post('/questions/test-cases', payload)
}
