import { useAuth } from '../auth/AuthProvider'

export function AuthRecoveryScreen() {
  const { retryAuth } = useAuth()

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-10 text-zinc-50">
      <section
        className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-900/70 p-6 text-center shadow-2xl shadow-black/30 backdrop-blur-2xl sm:p-8"
        role="alert"
      >
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-amber-200/15 bg-amber-400/[0.08] text-amber-200">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3 22 20H2z" />
            <path d="M12 9v4m0 3h.01" />
          </svg>
        </span>
        <h1 className="mt-4 text-lg font-semibold">Can’t restore your session</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          Your sign-in may still be active, but Anime Tracker couldn’t reach the account service.
          Check your connection and try again.
        </p>
        <button
          type="button"
          onClick={retryAuth}
          className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-full bg-indigo-500 px-5 text-sm font-medium text-white shadow-lg shadow-indigo-950/30 transition hover:bg-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200/70"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16.5 8A6.5 6.5 0 0 0 5 5.5L3.5 7" />
            <path d="M3.5 3.5V7H7M3.5 12A6.5 6.5 0 0 0 15 14.5l1.5-1.5" />
            <path d="M16.5 16.5V13H13" />
          </svg>
          Try again
        </button>
      </section>
    </main>
  )
}
