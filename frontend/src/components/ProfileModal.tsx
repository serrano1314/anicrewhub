import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ApiError } from '../api/client'
import type { AvatarId, User } from '../types/auth'
import { AuthField } from './AuthField'
import { PresetAvatarArt, ProfileAvatar } from './ProfileAvatar'
import { UI, cn } from '../lib/ui'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import { discoverAvatarPresets, type AvatarPreset } from '../lib/avatarPresets'

type ProfileModalProps = {
  open: boolean
  user: User
  onClose: () => void
  onAvatarChange: (avatarId: AvatarId | null) => Promise<void>
  onProfileChange: (email: string, username: string) => Promise<void>
  onLogout: () => Promise<void>
}

export function ProfileModal({ open, user, onClose, onAvatarChange, onProfileChange, onLogout }: ProfileModalProps) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const avatarTriggerRef = useRef<HTMLButtonElement>(null)
  const [email, setEmail] = useState(user.email)
  const [username, setUsername] = useState(user.username)
  const [savingAvatar, setSavingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false)
  const hasUnsavedChanges = email.trim() !== user.email || username.trim() !== user.username
  const avatarPresetsQuery = useQuery({
    queryKey: ['avatar-presets'],
    queryFn: discoverAvatarPresets,
    enabled: open,
    staleTime: Infinity,
  })
  const avatarPresets: AvatarPreset[] = avatarPresetsQuery.data ?? []
  useBodyScrollLock(open)

  const requestClose = useCallback(() => {
    if (savingProfile) return
    if (hasUnsavedChanges) {
      setConfirmDiscard(true)
      return
    }
    onClose()
  }, [hasUnsavedChanges, onClose, savingProfile])

  useEffect(() => {
    if (!open) {
      return
    }
    closeRef.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (confirmDiscard) {
          setConfirmDiscard(false)
        } else {
          requestClose()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [confirmDiscard, open, requestClose])

  if (!open) {
    return null
  }

  async function selectAvatar(avatarId: AvatarId | null) {
    setAvatarError(null)
    setSavingAvatar(true)
    try {
      await onAvatarChange(avatarId)
      setAvatarMenuOpen(false)
    } catch (error) {
      setAvatarError(error instanceof ApiError ? error.message : 'Could not update your avatar.')
    } finally {
      setSavingAvatar(false)
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setProfileError(null)
    setSavingProfile(true)
    const savedEmail = email.trim()
    const savedUsername = username.trim()
    try {
      await onProfileChange(savedEmail, savedUsername)
      setEmail(savedEmail)
      setUsername(savedUsername)
    } catch (error) {
      setProfileError(error instanceof ApiError ? error.message : 'Could not update your profile.')
    } finally {
      setSavingProfile(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/75 px-4 py-5 backdrop-blur-sm sm:py-8"
      onMouseDown={requestClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="auth-modal-enter auth-panel relative my-auto max-h-full w-full max-w-lg space-y-6 overflow-y-auto p-5 sm:space-y-7 sm:p-8"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-indigo-400/10 to-transparent" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">Account</p>
            <h2 id={titleId} className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">
              Profile
            </h2>
            <p className="mt-1 text-sm text-zinc-400">View your account details and profile settings.</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={requestClose}
            className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100 focus-visible:outline-2 focus-visible:outline-indigo-300"
            aria-label="Close profile"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5">
              <path d="m5 5 10 10M15 5 5 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <section className="relative flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-zinc-950/45 p-5 text-center sm:flex-row sm:text-left">
          <span className="auth-logo-ring flex size-20 shrink-0 items-center justify-center rounded-full border border-indigo-300/20 bg-zinc-900/80">
            <ProfileAvatar username={user.username} avatarId={user.avatar_id} size="lg" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-xl font-semibold text-zinc-50">{user.username}</h3>
            <p className="mt-1 break-all text-sm text-zinc-400">{user.email}</p>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/15 bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-200">
              <span className="size-1.5 rounded-full bg-emerald-300" aria-hidden="true" />
              Account active
            </span>
          </div>
        </section>

        <section className="relative space-y-3" aria-labelledby={`${titleId}-settings`}>
          <div className="flex items-center justify-between gap-3">
            <h3 id={`${titleId}-settings`} className="text-sm font-semibold text-zinc-200">Profile settings</h3>
          </div>
          <section className="space-y-3 rounded-2xl border border-white/10 bg-zinc-950/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-medium text-zinc-200">Profile avatar</h4>
                <p className="mt-0.5 text-xs text-zinc-500">Choose a preset image or use your initials.</p>
              </div>
              <div
                className="relative"
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setAvatarMenuOpen(false)
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape' && avatarMenuOpen) {
                    event.preventDefault()
                    event.stopPropagation()
                    setAvatarMenuOpen(false)
                    avatarTriggerRef.current?.focus()
                  }
                }}
              >
                <button
                  ref={avatarTriggerRef}
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={avatarMenuOpen}
                  aria-label={`Choose profile avatar. Current: ${avatarPresets.find((avatar) => avatar.id === user.avatar_id)?.name ?? (user.avatar_id ? `Avatar ${user.avatar_id}` : 'Initials')}`}
                  title="Change profile avatar"
                  onClick={() => setAvatarMenuOpen((isOpen) => !isOpen)}
                  className="group relative inline-flex size-14 shrink-0 items-center justify-center rounded-full border border-white/35 bg-white/15 p-1 text-white shadow-[0_8px_24px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.45)] backdrop-blur-2xl backdrop-saturate-150 transition duration-200 hover:scale-105 hover:border-white/55 hover:bg-white/25 hover:shadow-[0_10px_30px_rgba(99,102,241,0.28),inset_0_1px_0_rgba(255,255,255,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 active:scale-95"
                >
                  <ProfileAvatar username={user.username} avatarId={user.avatar_id} size="md" className="size-full ring-0" />
                  <span className="absolute bottom-0 right-0 flex size-5 items-center justify-center rounded-full border border-white/40 bg-zinc-900/65 text-white shadow-md backdrop-blur-xl transition group-hover:bg-indigo-500/80">
                    <svg viewBox="0 0 20 20" aria-hidden="true" className={cn('size-3 transition-transform', avatarMenuOpen && 'rotate-180')}>
                      <path d="m5 7.5 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </button>
                {avatarMenuOpen ? (
                  <div
                    role="listbox"
                    aria-label="Profile avatar choices"
                    className="absolute right-0 top-full z-20 mt-2 max-h-64 w-56 overflow-y-auto rounded-xl border border-white/10 bg-zinc-900/95 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl"
                  >
                    <button
                      type="button"
                      role="option"
                      aria-selected={!user.avatar_id}
                      disabled={savingAvatar}
                      onClick={() => void selectAvatar(null)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-white/5 disabled:opacity-50',
                        !user.avatar_id && 'bg-indigo-500/15 text-indigo-100',
                      )}
                    >
                      <ProfileAvatar username={user.username} size="sm" />
                      <span className="flex-1">Use initials</span>
                      {!user.avatar_id ? <span aria-hidden="true" className="text-indigo-300">✓</span> : null}
                    </button>
                    {avatarPresetsQuery.isPending ? (
                      <p className="px-2.5 py-3 text-xs text-zinc-400" role="status">Loading avatars…</p>
                    ) : avatarPresets.length === 0 ? (
                      <p className="px-2.5 py-3 text-xs text-zinc-400">Add consecutive numbered PNGs to <code>frontend/public/avatars</code>.</p>
                    ) : null}
                    {avatarPresets.map((avatar) => {
                      const selected = user.avatar_id === avatar.id
                      return (
                        <button
                          key={avatar.id}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          disabled={savingAvatar}
                          onClick={() => void selectAvatar(avatar.id)}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-white/5 disabled:opacity-50',
                            selected && 'bg-indigo-500/15 text-indigo-100',
                          )}
                        >
                          <PresetAvatarArt avatarId={avatar.id} className="size-8" />
                          <span className="flex-1">{avatar.name}</span>
                          {selected ? <span aria-hidden="true" className="text-indigo-300">✓</span> : null}
                        </button>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            </div>
            {savingAvatar ? <p className="text-xs text-zinc-400" role="status">Updating avatar…</p> : null}
            {avatarError ? <p className="text-xs text-rose-300" role="alert">{avatarError}</p> : null}
          </section>
          <form onSubmit={saveProfile} className="space-y-4 rounded-2xl border border-white/10 bg-zinc-950/40 p-4">
            <div>
              <h4 className="text-sm font-medium text-zinc-200">Account details</h4>
              <p className="mt-0.5 text-xs text-zinc-500">Update the username and email address used for your account.</p>
            </div>
            <AuthField
              label="Username"
              type="text"
              autoComplete="username"
              minLength={3}
              maxLength={32}
              pattern="[a-zA-Z0-9_]+"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
            <AuthField
              label="Email"
              type="email"
              autoComplete="email"
              maxLength={255}
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            {profileError ? <p className="text-sm text-rose-300" role="alert">{profileError}</p> : null}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-zinc-500">Email changes take effect immediately.</p>
              <div className="flex items-center gap-2 self-end">
                {hasUnsavedChanges ? (
                  <button
                    type="button"
                    disabled={savingProfile}
                    aria-label="Undo unsaved changes"
                    title="Undo changes"
                    onClick={() => {
                      setEmail(user.email)
                      setUsername(user.username)
                      setProfileError(null)
                    }}
                    className="inline-flex size-10 items-center justify-center rounded-full border border-white/30 bg-white/10 text-zinc-200 shadow-[0_8px_24px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.35)] backdrop-blur-2xl backdrop-saturate-150 transition hover:border-white/50 hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:opacity-50"
                  >
                    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5">
                      <path d="M4 8a6.5 6.5 0 1 1-.2 4M4 4v4h4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                ) : null}
                <button
                  type="submit"
                  disabled={savingProfile || !hasUnsavedChanges}
                  aria-label={savingProfile ? 'Saving profile changes' : 'Save profile changes'}
                  title={savingProfile ? 'Saving…' : 'Save changes'}
                  className="inline-flex size-10 items-center justify-center rounded-full border border-indigo-200/45 bg-indigo-400/25 text-indigo-50 shadow-[0_8px_24px_rgba(99,102,241,0.2),inset_0_1px_0_rgba(255,255,255,0.4)] backdrop-blur-2xl backdrop-saturate-150 transition hover:border-indigo-100/65 hover:bg-indigo-400/40 hover:shadow-[0_10px_28px_rgba(99,102,241,0.35),inset_0_1px_0_rgba(255,255,255,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {savingProfile ? (
                    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5 animate-spin">
                      <circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" strokeOpacity=".25" strokeWidth="2.5" />
                      <path d="M10 2.5a7.5 7.5 0 0 1 7.5 7.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5">
                      <path d="M3.5 3.5h10l3 3v10h-13v-13Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                      <path d="M6 3.8v4.4h7V3.8M6.5 16.2v-5h7v5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                    </svg>
                  )}
                  <span className="sr-only">{savingProfile ? 'Saving…' : 'Save changes'}</span>
                </button>
              </div>
            </div>
          </form>
        </section>

        {confirmDiscard ? (
          <div className="absolute inset-0 z-30 flex items-center justify-center rounded-2xl bg-zinc-950/75 p-5 backdrop-blur-md">
            <section
              role="alertdialog"
              aria-modal="true"
              aria-labelledby={`${titleId}-discard-title`}
              aria-describedby={`${titleId}-discard-description`}
              className="w-full max-w-sm rounded-2xl border border-white/15 bg-zinc-900/90 p-5 shadow-2xl shadow-black/50"
            >
              <h3 id={`${titleId}-discard-title`} className="text-base font-semibold text-zinc-50">
                Discard unsaved changes?
              </h3>
              <p id={`${titleId}-discard-description`} className="mt-2 text-sm leading-6 text-zinc-400">
                Your username or email edits haven’t been saved.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDiscard(false)}
                  className={cn(UI.btn, UI.btnSecondary)}
                >
                  Keep editing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmail(user.email)
                    setUsername(user.username)
                    setConfirmDiscard(false)
                    onClose()
                  }}
                  className={cn(UI.btn, 'border border-rose-300/20 bg-rose-500/15 text-rose-100 hover:bg-rose-500/25')}
                >
                  Discard changes
                </button>
              </div>
            </section>
          </div>
        ) : null}

        <div className="relative flex justify-end border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={() => void onLogout()}
            className={cn(
              UI.btn,
              'gap-2 border border-rose-300/20 bg-rose-500/10 text-rose-200 hover:border-rose-300/35 hover:bg-rose-500/20 hover:text-rose-100',
            )}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4" aria-hidden="true">
              <path d="M10 17l5-5-5-5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M15 12H3" strokeLinecap="round" />
              <path d="M13 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Log out
          </button>
        </div>

        {/* <div className="relative flex justify-end border-t border-white/10 pt-5">
          <button type="button" onClick={onClose} className={cn(UI.btn, UI.btnPrimary)}>
            Close
          </button>
        </div> */}
      </div>
    </div>
  )
}
