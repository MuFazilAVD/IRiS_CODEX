import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { useEffect } from 'react'

import { useUiStore, type ToastItem } from '../../store/uiStore'

const DEFAULT_DURATION_MS = 4200

export function ToastViewport() {
  const toasts = useUiStore((state) => state.toasts)
  const removeToast = useUiStore((state) => state.removeToast)

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[90] flex w-full max-w-[420px] flex-col gap-3 sm:right-6 sm:top-6">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
      ))}
    </div>
  )
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  useEffect(() => {
    const timeout = window.setTimeout(onDismiss, toast.durationMs ?? DEFAULT_DURATION_MS)
    return () => window.clearTimeout(timeout)
  }, [onDismiss, toast.durationMs])

  const toneClass =
    toast.tone === 'success'
      ? 'border-[#CFE9D9] bg-[#F3FCF6] text-[#117A65]'
      : toast.tone === 'error'
        ? 'border-[#F4C8C9] bg-[#FFF7F7] text-[#922B21]'
        : toast.tone === 'warning'
          ? 'border-[#F9E79F] bg-[#FFFBEE] text-[#9A7D0A]'
          : 'border-[#D6EAF8] bg-[#F5FBFF] text-iris-blue'

  return (
    <section className={`pointer-events-auto rounded-[20px] border shadow-lg backdrop-blur ${toneClass}`}>
      <div className="flex items-start gap-3 px-4 py-3.5">
        <div className="mt-0.5">{iconForTone(toast.tone)}</div>
        <div className="min-w-0 flex-1">
          {toast.title ? <p className="text-[13px] font-semibold">{toast.title}</p> : null}
          <p className="text-[13px] leading-5 text-iris-text-primary">{toast.message}</p>
        </div>
        <button className="rounded-md p-1 text-iris-text-secondary transition hover:bg-white/60" onClick={onDismiss} type="button">
          <X className="h-4 w-4" />
        </button>
      </div>
    </section>
  )
}

function iconForTone(tone: ToastItem['tone']) {
  if (tone === 'success') {
    return <CheckCircle2 className="h-5 w-5" />
  }
  if (tone === 'error') {
    return <AlertCircle className="h-5 w-5" />
  }
  if (tone === 'warning') {
    return <AlertTriangle className="h-5 w-5" />
  }
  return <Info className="h-5 w-5" />
}
