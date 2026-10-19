import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import { AuthField } from '../components/AuthField'
import { AuthFormShell } from '../components/AuthFormShell'
import { APP_VERSION } from '../lib/config'
import { ForgotPasswordUnavailableTrigger } from '../components/ForgotPasswordUnavailable'
import { UI, cn } from '../lib/ui'

export function LoginPage() {
  const { isReady, isAuthenticated, login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (isReady && isAuthenticated) {
    return <Navigate to="/" replace />
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not log in')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex w-full flex-col items-center">
      <AuthFormShell
        title="Login to your account"
        description="Pick up exactly where you left off—your list and watch progress are waiting."
        footer={
          <>
            No account?{' '}
            <Link to="/register" className="font-medium text-indigo-300 hover:text-indigo-200 hover:underline">
              Register
            </Link>
          </>
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
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="space-y-2">
            <AuthField
              label="Password"
              type="password"
              showPasswordToggle
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-right text-sm">
              <ForgotPasswordUnavailableTrigger />
            </p>
          </div>
          {error ? (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" disabled={submitting} className={cn(UI.btn, UI.btnPrimary, 'w-full gap-2 py-3')}>
            {submitting ? 'Signing in…' : 'Sign in'}
            {!submitting ? <span aria-hidden="true">→</span> : null}
          </button>
        </form>
      </AuthFormShell>
      <p className="mt-4 text-xs text-zinc-500">Version {APP_VERSION}</p>
    </div>
  )
}
