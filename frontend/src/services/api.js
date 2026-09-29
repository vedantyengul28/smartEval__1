import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

const instance = axios.create({
  baseURL: API_BASE,
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json',
  },
})

instance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('smarteval_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (err) => Promise.reject(err),
)

instance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('smarteval_token')
      localStorage.removeItem('smarteval_user')
      if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
        window.location.href = '/login?expired=1'
      }
    }
    return Promise.reject(error)
  },
)

export function unwrap(axiosResponse) {
  return axiosResponse.data?.data
}

export function getMessage(err, fallback = 'Something went wrong') {
  return err?.response?.data?.message || err?.message || fallback
}

export default instance
