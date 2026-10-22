import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { changePassword } from '../api/auth'
import { ForgotPasswordUnavailableTrigger } from './ForgotPasswordUnavailable'
import { ApiError } from '../api/client'
import { AuthField } from './AuthField'
import { useDialog } from './dialogContext'
import { UI, cn } from '../lib/ui'

function errorText(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}

export function ChangePasswordSection({ compact = false }: { compact?: boolean }) {
  const dialog = useDialog()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => changePassword({ current_password: currentPassword, new_password: newPassword }),
    onSuccess: async () => {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setFormError(null)
      await dialog.success({
        title: 'Password updated',
        message: 'Your password was changed successfully.',
      })
    },
  })

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    if (newPassword !== confirmPassword) {
      setFormError('New password and confirmation do not match.')
      return
    }
    if (newPassword.length < 8) {
      setFormError('New password must be at least 8 characters.')
      return
    }
    mutation.mutate()
  }

  const apiError = mutation.error ? errorText(mutation.error, 'Could not change password') : null

  return (
    <section className={cn(!compact && UI.card, 'space-y-4')}>
      {!compact ? <div>
        <h2 className="text-lg font-medium tracking-tight text-zinc-50">Account security</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Update your password while signed in.{' '}
          <ForgotPasswordUnavailableTrigger className="text-indigo-300 hover:text-indigo-200 hover:underline">
            Forgot your password?
          </ForgotPasswordUnavailableTrigger>
        </p>
      </div> : null}
      <form onSubmit={onSubmit} className="space-y-4">
        <AuthField
          label="Current password"
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <AuthField
          label="New password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <AuthField
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        {formError ? (
          <p className="text-sm text-red-300" role="alert">{formError}</p>
        ) : null}
        {apiError ? (
          <p className="text-sm text-red-300" role="alert">{apiError}</p>
        ) : null}
        <button type="submit" disabled={mutation.isPending} className={cn(UI.btn, UI.btnPrimary, 'rounded-full')}>
          {mutation.isPending ? (
            <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="9" width="12" height="9" rx="2" />
              <path d="M7 9V6a3 3 0 1 1 6 0v3m-3 4v2" />
            </svg>
          )}
          <span className="pl-2">{mutation.isPending ? 'Saving…' : 'Change password'}</span>
        </button>
      </form>
    </section>
  )
}
