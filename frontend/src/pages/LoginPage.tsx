import { useQuery } from '@tanstack/react-query'
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import { AnimeSpotlightCarousel } from '../components/AnimeSpotlightCarousel'
import { AuthField } from '../components/AuthField'
import { AuthFormShell } from '../components/AuthFormShell'
import { ContactSupportFooterButton } from '../components/ContactSupportSection'
import { ForgotPasswordUnavailableTrigger } from '../components/ForgotPasswordUnavailable'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import { fetchTerms } from '../api/sharing'
import { APP_VERSION } from '../lib/config'
import { UI, cn } from '../lib/ui'

type AuthModal = 'signin' | 'signup' | null

export function LoginPage() {
  const { login, register } = useAuth()
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const [authModal, setAuthModal] = useState<AuthModal>(null)
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const termsQuery = useQuery({
    queryKey: ['terms'],
    queryFn: fetchTerms,
    enabled: authModal === 'signup',
  })
  useBodyScrollLock(authModal !== null)

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [])

  useEffect(() => {
    if (!authModal) return
    closeButtonRef.current?.focus({ preventScroll: true })
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAuthModal(null)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [authModal])

  function openAuthModal(mode: Exclude<AuthModal, null>) {
    setError(null)
    setAcceptedTerms(false)
    setAuthModal(mode)
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!authModal) return
    setError(null)
    setSubmitting(true)
    try {
      if (authModal === 'signin') {
        await login(email, password)
      } else {
        if (!termsQuery.data) {
          setError('Terms are still loading. Try again in a moment.')
          return
        }
        if (!acceptedTerms) {
          setError('Accept the terms to create an account.')
          return
        }
        await register(email, username, password, termsQuery.data.version)
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : authModal === 'signin'
            ? 'Could not sign in'
            : 'Could not create account',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const isSigningUp = authModal === 'signup'

  return (
    <div className="flex min-h-screen w-full flex-col items-center px-4 pb-8 pt-5">
      <section className="w-full max-w-3xl px-2 py-4 text-center sm:py-6">
        <div className="flex justify-center mb-4">
        <img src="/favicon.svg" alt="" className="size-11 drop-shadow-sm" width={44} height={44} />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">AnimeCrew Hub</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
          Build your collection.
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-zinc-300 sm:text-base">
          Join the community to build your anime collection, manage your watchlist, and save favorites. Sign in to access your saved anime.
          {/* Create an account to track episodes, manage your watchlist, and save favorites. Sign in to access your saved anime. */}
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => openAuthModal('signup')}
            className={cn(UI.btn, UI.btnPrimary, 'min-h-12 rounded-full px-7 text-base shadow-lg shadow-indigo-950/40')}
          >
            Join the crew
            <span aria-hidden="true" className="ml-1">→</span>
          </button>
          <button
            type="button"
            onClick={() => openAuthModal('signin')}
            className={cn(UI.btn, UI.btnSecondary, 'min-h-12 rounded-full border-white/15 px-7 text-base')}
          >
            Sign in
          </button>
        </div>
      </section>

      <main className="flex w-full flex-1 flex-col items-center justify-center py-8 mb-10">
        <AnimeSpotlightCarousel hideUnauthenticatedSave />
      </main>
      <p className="text-xs text-zinc-500 mb-10">Version {APP_VERSION}</p>
      <ContactSupportFooterButton />

      {authModal
        ? createPortal(
            <div
              className="auth-modal-backdrop fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/75 px-4 py-6 backdrop-blur-sm"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setAuthModal(null)
              }}
            >
              <div
                key={authModal}
                role="dialog"
                aria-modal="true"
                aria-label={isSigningUp ? 'Create an account' : 'Sign in'}
                className="auth-modal-enter relative my-auto max-h-full w-full max-w-md overflow-y-auto"
              >
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={() => setAuthModal(null)}
                  aria-label="Close authentication dialog"
                  className="absolute right-3 top-3 z-10 rounded-lg p-2 text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100 focus-visible:outline-2 focus-visible:outline-indigo-300"
                >
                  <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5">
                    <path d="m5 5 10 10M15 5 5 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
                <AuthFormShell
                  title={isSigningUp ? 'Create your account' : 'Welcome back'}
                  description={
                    isSigningUp
                      ? 'Start tracking every episode, score, and favorite.'
                      : 'Sign in to continue tracking your anime.'
                  }
                  footer={
                    isSigningUp ? (
                      <>
                        Already have an account?{' '}
                        <button
                          type="button"
                          onClick={() => openAuthModal('signin')}
                          className="font-medium text-indigo-300 hover:text-indigo-200 hover:underline"
                        >
                          Sign in
                        </button>
                      </>
                    ) : (
                      <>
                        New to AnimeCrew Hub?{' '}
                        <button
                          type="button"
                          onClick={() => openAuthModal('signup')}
                          className="font-medium text-indigo-300 hover:text-indigo-200 hover:underline"
                        >
                          Create an account
                        </button>
                      </>
                    )
                  }
                >
                  <form onSubmit={onSubmit} className="space-y-5">
                    <AuthField
                      label="Email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                    {isSigningUp ? (
                      <AuthField
                        label="Username"
                        type="text"
                        autoComplete="username"
                        placeholder="Choose a username"
                        minLength={3}
                        maxLength={32}
                        required
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                      />
                    ) : null}
                    <div className="space-y-2">
                      <AuthField
                        label="Password"
                        type="password"
                        showPasswordToggle
                        autoComplete={isSigningUp ? 'new-password' : 'current-password'}
                        placeholder={isSigningUp ? 'At least 8 characters' : undefined}
                        minLength={isSigningUp ? 8 : undefined}
                        required
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                      />
                      {!isSigningUp ? (
                        <p className="text-right text-sm">
                          <ForgotPasswordUnavailableTrigger />
                        </p>
                      ) : null}
                    </div>
                    {isSigningUp ? (
                      <label className="flex items-start gap-3 text-sm text-zinc-200">
                        <input
                          type="checkbox"
                          checked={acceptedTerms}
                          onChange={(event) => setAcceptedTerms(event.target.checked)}
                          className="mt-0.5 size-4 rounded border-white/20 bg-zinc-950 text-indigo-400"
                        />
                        <span>
                          I agree to the{' '}
                          <Link to="/terms" target="_blank" className="text-indigo-300 hover:text-indigo-200">
                            Terms
                          </Link>
                          {termsQuery.data ? ` (version ${termsQuery.data.version})` : ''}.
                        </span>
                      </label>
                    ) : null}
                    {error ? (
                      <p
                        className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"
                        role="alert"
                      >
                        {error}
                      </p>
                    ) : null}
                    <button
                      type="submit"
                      disabled={submitting || (isSigningUp && (!acceptedTerms || !termsQuery.data))}
                      className={cn(UI.btn, UI.btnPrimary, 'w-full gap-2 py-3')}
                    >
                      {submitting
                        ? isSigningUp ? 'Creating account…' : 'Signing in…'
                        : isSigningUp ? 'Create your account' : 'Sign in'}
                      {!submitting ? <span aria-hidden="true">→</span> : null}
                    </button>
                  </form>
                </AuthFormShell>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
