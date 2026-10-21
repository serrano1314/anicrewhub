import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { AuthRecoveryScreen } from './AuthRecoveryScreen'
import { TermsGate } from './TermsGate'

export function ProtectedRoute() {
  const { isReady, isAuthenticated, authError, user } = useAuth()

  if (!isReady) {
    return (
      <main
        className="min-h-screen bg-zinc-950 text-zinc-50"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span className="sr-only">Loading your anime library…</span>
        <div className="border-b border-white/5 bg-zinc-950/85">
          <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4" aria-hidden="true">
            <div className="size-8 animate-pulse rounded-xl bg-zinc-800" />
            <div className="hidden h-4 w-28 animate-pulse rounded-full bg-zinc-800 sm:block" />
            <div className="mx-auto hidden items-center gap-2 md:flex">
              <div className="h-8 w-20 animate-pulse rounded-full bg-zinc-800/80" />
              <div className="h-8 w-20 animate-pulse rounded-full bg-zinc-800/80" />
              <div className="h-8 w-20 animate-pulse rounded-full bg-zinc-800/80" />
            </div>
            <div className="ml-auto size-9 animate-pulse rounded-full bg-zinc-800" />
          </div>
        </div>

        <div className="mx-auto max-w-5xl space-y-7 px-4 py-8" aria-hidden="true">
          <div className="space-y-3">
            <div className="h-8 w-48 animate-pulse rounded-lg bg-zinc-800" />
            <div className="h-4 w-72 max-w-full animate-pulse rounded-full bg-zinc-900" />
          </div>

          <div className="flex gap-2 overflow-hidden">
            <div className="h-9 w-20 shrink-0 animate-pulse rounded-full bg-zinc-800" />
            <div className="h-9 w-24 shrink-0 animate-pulse rounded-full bg-zinc-900" />
            <div className="h-9 w-20 shrink-0 animate-pulse rounded-full bg-zinc-900" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="overflow-hidden rounded-2xl border border-white/5 bg-zinc-900/45">
                <div className="aspect-[16/9] animate-pulse bg-zinc-800/75" />
                <div className="space-y-3 p-4">
                  <div className="h-5 w-3/4 animate-pulse rounded-full bg-zinc-800" />
                  <div className="h-3 w-1/2 animate-pulse rounded-full bg-zinc-800/65" />
                  <div className="h-7 w-full animate-pulse rounded-xl bg-zinc-800/55" />
                </div>
              </div>
            ))}
          </div>

          <div className="fixed inset-x-0 bottom-6 flex justify-center px-4 md:hidden">
            <div className="flex w-full max-w-xs gap-2 rounded-full border border-white/5 bg-zinc-900/80 p-2">
              <div className="h-10 flex-1 animate-pulse rounded-full bg-zinc-800" />
              <div className="h-10 flex-1 animate-pulse rounded-full bg-zinc-800/75" />
              <div className="h-10 flex-1 animate-pulse rounded-full bg-zinc-800/75" />
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (authError) {
    return <AuthRecoveryScreen />
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  if (user && !user.terms_accepted) {
    return <TermsGate />
  }

  return <Outlet />
}
