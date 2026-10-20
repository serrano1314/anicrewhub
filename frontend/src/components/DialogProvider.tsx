import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import {
  DialogContext,
  type ConfirmOptions,
  type DialogApi,
  type DialogTone,
  type NoticeOptions,
} from './dialogContext'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'

type DialogKind = 'confirm' | 'error' | 'success'

type ActiveDialog = {
  kind: DialogKind
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  tone: DialogTone
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const titleId = useId()
  const messageId = useId()
  const resolver = useRef<((confirmed: boolean) => void) | null>(null)
  const confirmButtonRef = useRef<HTMLButtonElement>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const [dialog, setDialog] = useState<ActiveDialog | null>(null)
  useBodyScrollLock(dialog !== null)

  const finish = useCallback((confirmed: boolean) => {
    resolver.current?.(confirmed)
    resolver.current = null
    setDialog(null)
  }, [])

  const open = useCallback((next: ActiveDialog) => {
    return new Promise<boolean>((resolve) => {
      resolver.current?.(false)
      resolver.current = resolve
      setDialog(next)
    })
  }, [])

  const api: DialogApi = {
    confirm: (options: ConfirmOptions) =>
      open({
        kind: 'confirm',
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel ?? 'Confirm',
        cancelLabel: options.cancelLabel ?? 'Cancel',
        tone: options.tone ?? 'default',
      }),
    error: (options: NoticeOptions) =>
      open({
        kind: 'error',
        title: options.title,
        message: options.message,
        confirmLabel: 'OK',
        cancelLabel: '',
        tone: 'danger',
      }).then(() => undefined),
    success: (options: NoticeOptions) =>
      open({
        kind: 'success',
        title: options.title,
        message: options.message,
        confirmLabel: 'OK',
        cancelLabel: '',
        tone: 'default',
      }).then(() => undefined),
  }

  useEffect(() => {
    if (!dialog) {
      return
    }
    const current = dialog
    const focusTarget = current.kind === 'confirm' ? cancelButtonRef.current : confirmButtonRef.current
    focusTarget?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        finish(current.kind !== 'confirm')
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [dialog, finish])

  return (
    <DialogContext.Provider value={api}>
      {children}
      {dialog ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4 backdrop-blur-[2px]"
          onMouseDown={() => finish(dialog.kind !== 'confirm')}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={messageId}
            className="ui-modal-panel w-full max-w-md p-6"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <DialogIcon kind={dialog.kind} />
              <div className="min-w-0 flex-1 space-y-2">
                <h2 id={titleId} className="text-lg font-semibold text-zinc-50">
                  {dialog.title}
                </h2>
                <p id={messageId} className="text-sm text-zinc-300">
                  {dialog.message}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2 border-t border-white/10 pt-4">
              {dialog.kind === 'confirm' ? (
                <button
                  ref={cancelButtonRef}
                  type="button"
                  onClick={() => finish(false)}
                  className="rounded-xl border border-white/10 bg-zinc-900/70 px-4 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:border-white/20 hover:bg-zinc-800"
                >
                  {dialog.cancelLabel}
                </button>
              ) : null}
              <button
                ref={confirmButtonRef}
                type="button"
                onClick={() => finish(true)}
                className={
                  dialog.tone === 'danger'
                    ? 'rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-500'
                    : 'rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-400'
                }
              >
                {dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </DialogContext.Provider>
  )
}

function DialogIcon({ kind }: { kind: DialogKind }) {
  if (kind === 'success') {
    return (
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
        <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5 fill-current">
          <path d="M10 1.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zm3.7 5.8-4.4 5.5-2.9-2.6a1 1 0 0 0-1.3 1.5l3.6 3.2a1 1 0 0 0 1.4-.1l5-6.3a1 1 0 1 0-1.4-1.2z" />
        </svg>
      </span>
    )
  }
  if (kind === 'error') {
    return (
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-400">
        <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5 fill-current">
          <path d="M10 1.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17zm-1 4.5a1 1 0 0 0 2 0v5a1 1 0 1 0-2 0zm1 8.8a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4z" />
        </svg>
      </span>
    )
  }
  return (
    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-300">
      <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5 fill-current">
        <path d="M9.1 2.6a1 1 0 0 1 1.8 0l7 14A1 1 0 0 1 17 18H3a1 1 0 0 1-.9-1.4zM10 7a1 1 0 0 0-1 1v4a1 1 0 1 0 2 0V8a1 1 0 0 0-1-1zm0 9.2a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4z" />
      </svg>
    </span>
  )
}
