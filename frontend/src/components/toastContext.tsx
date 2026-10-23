import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

type ToastContextValue = {
  showToast: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null)
  const timeoutRef = useRef<number | null>(null)

  const showToast = useCallback((nextMessage: string) => {
    setMessage(nextMessage)
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = window.setTimeout(() => {
      setMessage(null)
      timeoutRef.current = null
    }, 2200)
  }, [])

  useEffect(() => () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
    }
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {message ? (
        <div className="pointer-events-none fixed inset-x-0 top-[4.5rem] z-[100] flex justify-center px-4 md:top-34" role="status" aria-live="polite">
          <div className="toast-pop rounded-full border border-emerald-300/25 bg-zinc-900/90 px-4 py-2 text-sm text-emerald-100 shadow-xl shadow-black/30 backdrop-blur-xl">
            {message}
          </div>
        </div>
      ) : null}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}
