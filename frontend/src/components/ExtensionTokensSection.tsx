import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import { INPUT_PLACEHOLDERS } from '../lib/placeholders'
import { createExtensionToken, fetchExtensionTokens, revokeExtensionToken } from '../api/extension'
import type { ExtensionToken } from '../types/extension'
import { ErrorPanel, LoadingIndicator } from './PageStatus'
import { useDialog } from './dialogContext'
import { UI, cn } from '../lib/ui'

function errorText(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}

function formatWhen(value: string | null): string {
  if (!value) {
    return 'Not used yet'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Not used yet'
  }
  return `Last used ${date.toLocaleString()}`
}

export function ExtensionTokensSection({ compact = false }: { compact?: boolean }) {
  const queryClient = useQueryClient()
  const dialog = useDialog()
  const [name, setName] = useState('')
  const [freshToken, setFreshToken] = useState<string | null>(null)
  const [copyNote, setCopyNote] = useState<string | null>(null)

  const tokensQuery = useQuery({
    queryKey: ['extension-tokens'],
    queryFn: fetchExtensionTokens,
  })

  const createMutation = useMutation({
    mutationFn: () => createExtensionToken(name.trim()),
    onSuccess: async (created) => {
      setName('')
      setFreshToken(created.token)
      setCopyNote(null)
      await queryClient.invalidateQueries({ queryKey: ['extension-tokens'] })
    },
  })

  const revokeMutation = useMutation({
    mutationFn: revokeExtensionToken,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['extension-tokens'] })
    },
  })

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFreshToken(null)
    createMutation.mutate()
  }

  async function onCopy() {
    if (!freshToken) {
      return
    }
    try {
      await navigator.clipboard.writeText(freshToken)
      setCopyNote('Copied')
    } catch {
      setCopyNote('Select the token and copy it')
    }
  }

  async function onRevoke(token: ExtensionToken) {
    const confirmed = await dialog.confirm({
      title: 'Revoke extension token',
      message: `Revoke ${token.name}? The extension will stop saving progress until you paste a new token.`,
      confirmLabel: 'Revoke',
      tone: 'danger',
    })
    if (!confirmed) {
      return
    }
    try {
      await revokeMutation.mutateAsync(token.id)
    } catch (error) {
      await dialog.error({
        title: 'Could not revoke token',
        message: errorText(error, 'Could not revoke this token.'),
      })
    }
  }

  const error = tokensQuery.error ?? createMutation.error ?? revokeMutation.error

  return (
    <section className="space-y-4">
      {!compact ? <div>
        <h2 className="text-xl font-semibold">Extension tokens</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Create a token and paste it into the Chrome extension. The token is shown once. It is
          separate from your login session.
        </p>
      </div> : null}
      <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-zinc-950/25 p-4 sm:flex-row sm:items-end">
        <label className="block flex-1 space-y-1.5">
          <span className={UI.fieldLabel}>Token name</span>
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={INPUT_PLACEHOLDERS.extensionTokenName}
            className={UI.input}
          />
        </label>
        <button
          type="submit"
          disabled={createMutation.isPending}
          className={cn(UI.btn, UI.btnPrimary, 'rounded-full px-5')}
        >
          {createMutation.isPending ? (
            <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 3v14M3 10h14" />
            </svg>
          )}
          {createMutation.isPending ? 'Creating…' : 'Create token'}
        </button>
      </form>
      {freshToken ? (
        <div className="space-y-3 rounded-2xl border border-amber-200/15 bg-amber-400/[0.06] p-4">
          <div className="flex items-start gap-2.5">
            <svg viewBox="0 0 20 20" aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-200" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 2.5 18 17H2z" />
              <path d="M10 7v4m0 3h.01" />
            </svg>
            <p className="text-sm text-amber-100">Copy this token now. It will not be shown again.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              readOnly
              value={freshToken}
              aria-label="New extension token"
              className={cn(UI.input, 'font-mono text-xs')}
            />
            <button
              type="button"
              onClick={() => {
                void onCopy()
              }}
              className={cn(UI.btn, UI.btnSecondary, 'shrink-0 rounded-full')}
            >
              {copyNote === 'Copied' ? (
                <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m4 10 4 4 8-8" />
                </svg>
              ) : (
                <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="7" y="7" width="10" height="10" rx="2" />
                  <path d="M13 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
                </svg>
              )}
              {copyNote === 'Copied' ? 'Copied' : 'Copy token'}
            </button>
          </div>
          {copyNote && copyNote !== 'Copied' ? <p className="text-xs text-amber-100/80">{copyNote}</p> : null}
        </div>
      ) : null}
      {tokensQuery.isPending ? <LoadingIndicator label="Loading tokens…" /> : null}
      {tokensQuery.isError ? (
        <ErrorPanel
          message={errorText(tokensQuery.error, 'Could not load extension tokens')}
          onRetry={() => {
            void tokensQuery.refetch()
          }}
        />
      ) : null}
      {tokensQuery.data?.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-zinc-950/20 px-4 py-6 text-center">
          <span className="mx-auto flex size-10 items-center justify-center rounded-2xl bg-violet-400/[0.08] text-violet-200">
            <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="10" cy="10" r="7.5" />
              <path d="M10 6v8M6 10h8" />
            </svg>
          </span>
          <p className="mt-3 text-sm font-medium text-zinc-200">No extension tokens yet</p>
          <p className="mt-1 text-xs text-zinc-500">Create a token above to connect your browser extension.</p>
        </div>
      ) : null}
      {tokensQuery.data?.length ? (
        <ul className="space-y-2">
          {tokensQuery.data.map((token) => (
            <li
              key={token.id}
              className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 transition hover:border-white/[0.14] hover:bg-white/[0.04] sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-xl bg-violet-400/[0.08] text-violet-200">
                    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="7" cy="13" r="3.5" />
                      <path d="m9.5 10.5 6-6 2 2-6 6M14 6l2 2" />
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-100">{token.name}</p>
                    <p className="text-xs text-zinc-500">{formatWhen(token.last_used_at)}</p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                disabled={revokeMutation.isPending}
                aria-label={`Revoke ${token.name}`}
                title="Revoke token"
                onClick={() => {
                  void onRevoke(token)
                }}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-rose-200/15 bg-rose-400/[0.04] px-3 text-xs font-medium text-rose-200/80 transition hover:border-rose-200/30 hover:bg-rose-400/[0.1] hover:text-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200/60 disabled:opacity-50"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 5.5h12M8 5.5V3h4v2.5m3 0-.7 10.2a1.5 1.5 0 0 1-1.5 1.3H8.2a1.5 1.5 0 0 1-1.5-1.3L6 5.5m2.5 3v5m3-5v5" />
                </svg>
                Revoke
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="text-sm text-red-400">{errorText(error, 'Could not update extension tokens')}</p> : null}
    </section>
  )
}
