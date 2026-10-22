import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ApiError } from '../api/client'
import { fetchTerms } from '../api/sharing'
import { useAuth } from '../auth/AuthProvider'
import { TermsDocumentView } from './TermsDocumentView'
import { ErrorPanel, LoadingIndicator } from './PageStatus'
import { UI, cn } from '../lib/ui'

export function TermsGate() {
  const { acceptTerms, logout } = useAuth()
  const [accepted, setAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const termsQuery = useQuery({ queryKey: ['terms'], queryFn: fetchTerms })

  async function onAccept() {
    setError(null)
    setSubmitting(true)
    try {
      await acceptTerms()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record your acceptance')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-4 py-10">
      <div className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6 shadow-2xl shadow-black/30 sm:p-8">
        {termsQuery.isPending ? <LoadingIndicator label="Loading terms…" /> : null}
        {termsQuery.isError ? (
          <ErrorPanel message="Could not load the terms." onRetry={() => { void termsQuery.refetch() }} />
        ) : null}
        {termsQuery.data ? (
          <div className="space-y-6">
            <TermsDocumentView terms={termsQuery.data} />
            <p className="text-sm leading-relaxed text-zinc-400">
              Accept the current terms to keep using AnimeCrew Hub. You can still sign out or recover your account before accepting.
            </p>
            <label className="flex items-start gap-3 text-sm text-zinc-200">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
                className="mt-0.5 size-4 rounded border-white/20 bg-zinc-950 text-indigo-400"
              />
              <span>I agree to the Terms, version {termsQuery.data.version}.</span>
            </label>
            {error ? (
              <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200" role="alert">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={!accepted || submitting}
                onClick={() => { void onAccept() }}
                className={cn(UI.btn, UI.btnPrimary, 'px-5')}
              >
                {submitting ? 'Saving…' : 'Accept and continue'}
              </button>
              <button type="button" onClick={() => { void logout() }} className={cn(UI.btn, UI.btnSecondary)}>
                Log out
              </button>
              {/* <Link to="/forgot-password" className="text-sm text-indigo-300 hover:text-indigo-200">
                Account recovery
              </Link> */}
            </div>
          </div>
        ) : null}
      </div>
    </main>
  )
}
