// components/ui/toast.tsx
'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id: string
  title: string
  description?: string
  variant?: ToastVariant
  duration?: number
}

type ToastContextValue = {
  toast: (item: Omit<ToastItem, 'id'>) => void
  dismiss: (id: string) => void
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

const variantConfig: Record<
  ToastVariant,
  { icon: React.ReactNode; classes: string }
> = {
  default: {
    icon: <Info className="h-4 w-4 shrink-0 text-neutral-500" />,
    classes:
      'bg-white border-neutral-200 text-neutral-900 dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-100',
  },
  success: {
    icon: <CheckCircle className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />,
    classes:
      'bg-white border-green-200 text-neutral-900 dark:bg-neutral-900 dark:border-green-800 dark:text-neutral-100',
  },
  error: {
    icon: <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />,
    classes:
      'bg-white border-red-200 text-neutral-900 dark:bg-neutral-900 dark:border-red-800 dark:text-neutral-100',
  },
  warning: {
    icon: <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />,
    classes:
      'bg-white border-amber-200 text-neutral-900 dark:bg-neutral-900 dark:border-amber-800 dark:text-neutral-100',
  },
  info: {
    icon: <Info className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />,
    classes:
      'bg-white border-blue-200 text-neutral-900 dark:bg-neutral-900 dark:border-blue-800 dark:text-neutral-100',
  },
}

// Singleton event emitter so `toast()` can be called from outside the tree
type Listener = (item: Omit<ToastItem, 'id'>) => void
const listeners: Set<Listener> = new Set()

/** Call this anywhere in the app to show a toast */
export function toast(item: Omit<ToastItem, 'id'>) {
  listeners.forEach((fn) => fn(item))
}

function ToastMessage({
  item,
  onDismiss,
}: {
  item: ToastItem
  onDismiss: (id: string) => void
}) {
  const variant = item.variant ?? 'default'
  const config = variantConfig[variant]

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        'pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-lg w-full max-w-sm',
        'animate-in slide-in-from-right-full fade-in duration-300',
        config.classes
      )}
    >
      {config.icon}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight">{item.title}</p>
        {item.description && (
          <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400 leading-snug">
            {item.description}
          </p>
        )}
      </div>
      <button
        onClick={() => onDismiss(item.id)}
        aria-label="Dismiss notification"
        className={cn(
          'shrink-0 rounded p-0.5 transition-colors',
          'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'
        )}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([])
  const timersRef = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
  }, [])

  const addToast = React.useCallback(
    (item: Omit<ToastItem, 'id'>) => {
      const id = Math.random().toString(36).slice(2)
      const duration = item.duration ?? 4000
      setToasts((prev) => [...prev.slice(-4), { ...item, id }])
      const timer = setTimeout(() => dismiss(id), duration)
      timersRef.current.set(id, timer)
    },
    [dismiss]
  )

  // Subscribe to singleton emitter
  React.useEffect(() => {
    listeners.add(addToast)
    return () => {
      listeners.delete(addToast)
    }
  }, [addToast])

  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  return (
    <ToastContext.Provider value={{ toast: addToast, dismiss }}>
      {children}
      {mounted &&
        createPortal(
          <div
            aria-label="Notifications"
            className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 items-end pointer-events-none"
          >
            {toasts.map((item) => (
              <ToastMessage key={item.id} item={item} onDismiss={dismiss} />
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return ctx
}
