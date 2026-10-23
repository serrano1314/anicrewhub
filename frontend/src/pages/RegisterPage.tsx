import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { fetchTerms } from '../api/sharing'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import { AuthField } from '../components/AuthField'
import { AuthFormShell } from '../components/AuthFormShell'
import { UI, cn } from '../lib/ui'

export function RegisterPage() {
  const { isReady, isAuthenticated, register } = useAuth()
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const termsQuery = useQuery({ queryKey: ['terms'], queryFn: fetchTerms })

  if (isReady && isAuthenticated) {
    return <Navigate to="/" replace />
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (!termsQuery.data || !acceptedTerms) {
        setError('Accept the current terms to create an account.')
        return
      }
      await register(email, username, password, termsQuery.data.version)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not register')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthFormShell
      title="Create account"
      description="Start a calmer way to track every episode, score, and favorite."
      footer={
        <>
          Already registered?{' '}
          <Link to="/" className="font-medium text-indigo-300 hover:text-indigo-200 hover:underline">
            Log in
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
        <AuthField
          label="Username"
          type="text"
          autoComplete="username"
          placeholder="Choose a username"
          minLength={3}
          maxLength={32}
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <AuthField
          label="Password"
          type="password"
          showPasswordToggle
          autoComplete="new-password"
          placeholder="At least 8 characters"
          minLength={8}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
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
            {/* {termsQuery.data ? ` (version ${termsQuery.data.version})` : ''}. */}
          </span>
        </label>
        {error ? (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={submitting || !acceptedTerms || !termsQuery.data} className={cn(UI.btn, UI.btnPrimary, 'w-full gap-2 py-3')}>
          {submitting ? 'Creating account…' : 'Create your account'}
          {!submitting ? <span aria-hidden="true">→</span> : null}
        </button>
      </form>
    </AuthFormShell>
  )
}
