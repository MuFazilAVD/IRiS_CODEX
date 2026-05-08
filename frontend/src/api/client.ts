import axios from 'axios'
import type { AxiosError } from 'axios'

import { useAuthStore } from '../store/authStore'

const deployedApiBaseUrl = 'http://d3sok4f0t46eww.cloudfront.net/iris/api/v1'

function getDefaultBaseUrl() {
  if (import.meta.env.PROD) {
    return deployedApiBaseUrl
  }

  if (typeof window === 'undefined') {
    return 'http://localhost:8000/iris/api/v1'
  }

  return `http://${window.location.hostname}:8000/iris/api/v1`
}

const baseURL = import.meta.env.VITE_API_URL ?? getDefaultBaseUrl()

export const api = axios.create({
  baseURL,
})

api.interceptors.request.use((config) => {
  const { token, activeRole, user } = useAuthStore.getState()

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  if (user?.role === 'super_admin' && activeRole) {
    config.headers['X-Active-Role'] = activeRole
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const requestUrl = error.config?.url ?? ''
    const isAuthEntryRequest = requestUrl.endsWith('/auth/login') || requestUrl.endsWith('/auth/sso')

    if (error.response?.status === 401 && !isAuthEntryRequest) {
      useAuthStore.getState().logout()

      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.replace('/login')
      }
    }

    return Promise.reject(error)
  },
)
