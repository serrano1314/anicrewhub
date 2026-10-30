import { useEffect, useRef, useState, type ReactNode } from 'react'
import { UI, cn } from '../lib/ui'

type LoadingProps = {
  label?: string
}

export function LoadingIndicator({ label = 'Loading…' }: LoadingProps) {
  return (
    <div className="flex items-center gap-3 text-zinc-400" role="status" aria-live="polite">
      <span
        className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-indigo-400"
        aria-hidden="true"
      />
      <span className="text-sm">{label}</span>
    </div>
  )
}

type ErrorPanelProps = {
  message: string
  onRetry?: () => void
}

export function ErrorPanel({ message, onRetry }: ErrorPanelProps) {
  return (
    <div className="ui-card space-y-3 border-red-500/30 bg-red-500/5">
      <p className="text-sm text-red-300">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className={cn(UI.btn, UI.btnSecondary, 'py-2')}
        >
          Try again
        </button>
      ) : null}
    </div>
  )
}

type RateLimitRecoveryProps = {
  retryAfterSeconds: number | null
  onRetry: () => void
}

export function RateLimitRecovery({ retryAfterSeconds, onRetry }: RateLimitRecoveryProps) {
  const retryRef = useRef(onRetry)
  const totalSeconds = Math.max(1, Math.ceil(retryAfterSeconds ?? 10))
  const [remainingSeconds, setRemainingSeconds] = useState(totalSeconds)

  retryRef.current = onRetry

  useEffect(() => {
    setRemainingSeconds(totalSeconds)
    const startedAt = Date.now()
    const timer = window.setInterval(() => {
      const elapsedSeconds = (Date.now() - startedAt) / 1_000
      const remaining = Math.max(0, totalSeconds - elapsedSeconds)
      setRemainingSeconds(remaining)
      if (remaining <= 0) {
        window.clearInterval(timer)
        retryRef.current()
      }
    }, 100)
    return () => window.clearInterval(timer)
  }, [totalSeconds])

  const progress = Math.min(100, Math.max(0, ((totalSeconds - remainingSeconds) / totalSeconds) * 100))

  return (
    <div
      className="ui-card space-y-3 border-white/10 bg-zinc-900/70 shadow-lg shadow-black/20"
      role="status"
      aria-live="polite"
    >
      <p className="text-sm text-zinc-300">AniList is temporarily rate-limited.</p>
      <div
        className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/[0.08]"
        role="progressbar"
        aria-label="Waiting to retry"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-violet-400 to-indigo-300 shadow-[0_0_12px_rgba(129,140,248,0.55)] transition-[width] duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

type EmptyStateProps = {
  children: ReactNode
}

export function EmptyState({ children }: EmptyStateProps) {
  return <p className="ui-card text-sm text-zinc-400">{children}</p>
}
