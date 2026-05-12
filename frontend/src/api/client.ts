import axios from 'axios'
import type { AxiosError } from 'axios'

import { useAuthStore } from '../store/authStore'

const apiPath = '/api/v1'
const deployedBackendUrl = 'https://d2brdeqy144bwg.cloudfront.net/iris'

function getDefaultBackendUrl() {
  if (import.meta.env.PROD) {
    return deployedBackendUrl
  }

  if (typeof window === 'undefined') {
    return 'http://localhost:8000/iris'
  }

  return `http://${window.location.hostname}:8000/iris`
}

function toApiBaseUrl(backendUrl: string) {
  const normalizedBackendUrl = backendUrl.replace(/\/+$/, '')

  if (normalizedBackendUrl.endsWith(apiPath)) {
    return normalizedBackendUrl
  }

  return `${normalizedBackendUrl}${apiPath}`
}

const backendURL = import.meta.env.VITE_BACKEND_URL ?? import.meta.env.VITE_API_URL ?? getDefaultBackendUrl()
const baseURL = toApiBaseUrl(backendURL)

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
