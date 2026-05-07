import { create } from 'zustand'

export type ToastTone = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id: string
  title?: string
  message: string
  tone: ToastTone
  durationMs?: number
}

interface UiState {
  sidebarCollapsed: boolean
  chatbotOpen: boolean
  toasts: ToastItem[]
  toggleSidebar: () => void
  setChatbotOpen: (open: boolean) => void
  toggleChatbot: () => void
  pushToast: (toast: Omit<ToastItem, 'id'> & { id?: string }) => string
  removeToast: (id: string) => void
  clearToasts: () => void
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  chatbotOpen: false,
  toasts: [],
  toggleSidebar: () =>
    set((state) => ({
      sidebarCollapsed: !state.sidebarCollapsed,
    })),
  setChatbotOpen: (open) => set({ chatbotOpen: open }),
  toggleChatbot: () =>
    set((state) => ({
      chatbotOpen: !state.chatbotOpen,
    })),
  pushToast: (toast) => {
    const id = toast.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    set((state) => ({
      toasts: [
        ...state.toasts,
        {
          ...toast,
          id,
        },
      ],
    }))
    return id
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    })),
  clearToasts: () => set({ toasts: [] }),
}))
