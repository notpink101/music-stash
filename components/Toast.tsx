'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  message: string
  type: ToastType
}

interface ToastContextValue {
  toast: (message: string, type: ToastType) => void
}

// ── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null)

// ── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const toast = useCallback((message: string, type: ToastType) => {
    const id = nextId.current++

    setToasts((prev) => {
      const next = [...prev, { id, message, type }]
      // Keep at most 3 toasts; drop oldest first
      return next.length > 3 ? next.slice(next.length - 3) : next
    })

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-50 flex flex-col gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`flex items-center gap-3 rounded-xl bg-zinc-800 px-4 py-3 text-sm text-white shadow-lg border-l-4 ${
                t.type === 'success'
                  ? 'border-green-500'
                  : t.type === 'error'
                  ? 'border-red-500'
                  : 'border-blue-500'
              }`}
            >
              {t.message}
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
