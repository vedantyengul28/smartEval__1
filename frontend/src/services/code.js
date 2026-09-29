import api from './api'

export function submitCode(payload) {
  return api.post('/code/submit', payload)
}

export function runCodeSingle(payload) {
  return api.post('/code/run', payload)
}

export function getTeacherResults() {
  return api.get('/code/teacher/results')
}

export function getStudentResults() {
  return api.get('/code/student/results')
}
