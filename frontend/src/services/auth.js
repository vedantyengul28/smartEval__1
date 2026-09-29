import api from './api'

export function register(payload) {
  return api.post('/auth/register', payload)
}

export function login(payload) {
  return api.post('/auth/login', payload)
}

export function logout() {
  return api.post('/auth/logout')
}

export function getProfile() {
  return api.get('/auth/profile')
}
