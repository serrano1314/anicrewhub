import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import { fetchLibrary } from '../api/library'
import { useAuth } from '../auth/AuthProvider'
import { PresetAvatarArt, ProfileAvatar } from '../components/ProfileAvatar'
import { discoverAvatarPresets, type AvatarPreset } from '../lib/avatarPresets'
import { UI, cn } from '../lib/ui'
import type { AvatarId } from '../types/auth'

type EditableField = 'username' | 'email'

const plainIconButton =
  'inline-flex size-6 shrink-0 items-center justify-center text-zinc-400 transition hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/70 disabled:opacity-40'

function SaveSpinner() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-3.5 animate-spin">
      <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeOpacity=".25" strokeWidth="2" />
      <path d="M10 3a7 7 0 0 1 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function SavedCheck() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m4 10 4 4 8-8" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  )
}

export function ProfilePage() {
  const { user, updateAvatar, updateProfile } = useAuth()
  const navigate = useNavigate()
  const titleId = useId()
  const avatarMenuRef = useRef<HTMLDivElement>(null)
  const fieldInputRef = useRef<HTMLInputElement>(null)
  const [email, setEmail] = useState(user?.email ?? '')
  const [username, setUsername] = useState(user?.username ?? '')
  const [editingField, setEditingField] = useState<EditableField | null>(null)
  const [savingAvatar, setSavingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [savedField, setSavedField] = useState<EditableField | null>(null)
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false)
  const hasUnsavedChanges =
    user != null &&
    ((editingField === 'username' && username.trim() !== user.username) ||
      (editingField === 'email' && email.trim() !== user.email))
  const avatarPresetsQuery = useQuery({
    queryKey: ['avatar-presets'],
    queryFn: discoverAvatarPresets,
    staleTime: Infinity,
  })
  const collectionQuery = useQuery({
    queryKey: ['library', 'all', false, 1, '', 'updated'],
    queryFn: () => fetchLibrary(undefined, 1),
  })
  const avatarPresets: AvatarPreset[] = avatarPresetsQuery.data ?? []
  const summary = collectionQuery.data?.summary

  useEffect(() => {
    if (!user || hasUnsavedChanges || editingField) {
      return
    }
    setEmail(user.email)
    setUsername(user.username)
  }, [editingField, hasUnsavedChanges, user])

  useEffect(() => {
    if (editingField) {
      fieldInputRef.current?.focus()
    }
  }, [editingField])

  useEffect(() => {
    if (!savedField) {
      return
    }
    const timer = window.setTimeout(() => setSavedField(null), 2000)
    return () => window.clearTimeout(timer)
  }, [savedField])

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return
    }
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [hasUnsavedChanges])

  useEffect(() => {
    if (!hasUnsavedChanges || savingProfile) {
      return
    }
    function onDocumentClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return
      }
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!(anchor instanceof HTMLAnchorElement)) {
        return
      }
      if (anchor.target && anchor.target !== '_self') {
        return
      }
      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      setPendingHref(`${url.pathname}${url.search}${url.hash}`)
    }
    document.addEventListener('click', onDocumentClick, true)
    return () => document.removeEventListener('click', onDocumentClick, true)
  }, [hasUnsavedChanges, savingProfile])

  useEffect(() => {
    if (!avatarMenuOpen) {
      return
    }
    function onPointerDown(event: MouseEvent) {
      if (!avatarMenuRef.current?.contains(event.target as Node)) {
        setAvatarMenuOpen(false)
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setAvatarMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [avatarMenuOpen])

  if (!user) {
    return null
  }

  function beginEdit(field: EditableField) {
    if (savingProfile || hasUnsavedChanges) {
      return
    }
    setProfileError(null)
    setSavedField(null)
    setUsername(user?.username ?? '')
    setEmail(user?.email ?? '')
    setEditingField(field)
  }

  function cancelEdit() {
    setUsername(user?.username ?? '')
    setEmail(user?.email ?? '')
    setProfileError(null)
    setEditingField(null)
  }

  async function selectAvatar(avatarId: AvatarId | null) {
    setAvatarError(null)
    setSavingAvatar(true)
    try {
      await updateAvatar(avatarId)
      setAvatarMenuOpen(false)
    } catch (error) {
      setAvatarError(error instanceof ApiError ? error.message : 'Could not update your avatar.')
    } finally {
      setSavingAvatar(false)
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user || !hasUnsavedChanges) {
      setEditingField(null)
      return
    }
    setProfileError(null)
    setSavingProfile(true)
    const savedEmail = (editingField === 'email' ? email : user.email).trim()
    const savedUsername = (editingField === 'username' ? username : user.username).trim()
    try {
      await updateProfile(savedEmail, savedUsername)
      setEmail(savedEmail)
      setUsername(savedUsername)
      setSavedField(editingField)
      setEditingField(null)
    } catch (error) {
      setProfileError(error instanceof ApiError ? error.message : 'Could not update your profile.')
    } finally {
      setSavingProfile(false)
    }
  }

  const collectionStats = summary
    ? [
        { label: 'Saved', value: summary.total, to: '/' },
        { label: 'Watching', value: summary.watching, to: '/?status=watching' },
        { label: 'Completed', value: summary.completed, to: '/?status=completed' },
        { label: 'Plan to watch', value: summary.plan_to_watch, to: '/?status=plan_to_watch' },
        { label: 'Favorites', value: summary.favorites, to: '/?favorites=true' },
      ]
    : []

  return (
    <section className="space-y-5 pb-8 mt-10">
      <header className="relative isolate overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/55 px-5 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl sm:px-7 sm:py-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 -z-10 size-64 rounded-full bg-indigo-500/20 blur-3xl" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-indigo-200/80">Account</p>
        <h1 id={titleId} className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
          Profile
        </h1>
        <p className="mt-1 max-w-xl text-sm leading-relaxed text-zinc-400">
          Your avatar, account details, and a snapshot of your collection.
        </p>
      </header>

      <section className="rounded-3xl border border-white/10 bg-zinc-900/55 p-5 sm:p-6">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
          <div ref={avatarMenuRef} className="relative shrink-0">
            <ProfileAvatar username={user.username} avatarId={user.avatar_id} size="lg" className="size-24 text-2xl" />
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={avatarMenuOpen}
              aria-label="Change avatar"
              title="Change avatar"
              disabled={savingAvatar}
              onClick={() => setAvatarMenuOpen((open) => !open)}
              className="absolute bottom-2 right-0 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] transition hover:text-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/80 disabled:opacity-50"
            >
              <CameraIcon />
            </button>
            {avatarMenuOpen ? (
              <div
                role="listbox"
                aria-label="Profile avatar choices"
                className="absolute left-1/2 top-full z-30 mt-3 grid max-h-64 w-64 -translate-x-1/2 grid-cols-5 gap-2 overflow-y-auto rounded-2xl border border-white/10 bg-zinc-900/95 p-3 shadow-2xl shadow-black/50 backdrop-blur-xl"
              >
                <button
                  type="button"
                  role="option"
                  aria-label="Use initials"
                  aria-selected={!user.avatar_id}
                  disabled={savingAvatar}
                  onClick={() => void selectAvatar(null)}
                  className={cn(
                    'rounded-full transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:opacity-50',
                    !user.avatar_id && 'ring-2 ring-indigo-300',
                  )}
                >
                  <ProfileAvatar username={user.username} size="sm" className="size-10 text-xs" />
                </button>
                {avatarPresets.map((avatar) => {
                  const selected = user.avatar_id === avatar.id
                  return (
                    <button
                      key={avatar.id}
                      type="button"
                      role="option"
                      aria-label={`Avatar ${avatar.id}`}
                      aria-selected={selected}
                      disabled={savingAvatar}
                      onClick={() => void selectAvatar(avatar.id)}
                      className={cn(
                        'rounded-full transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:opacity-50',
                        selected && 'ring-2 ring-indigo-300',
                      )}
                    >
                      <PresetAvatarArt avatarId={avatar.id} className="size-10" />
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>

          <form onSubmit={saveProfile} className="min-w-0 flex-1 space-y-3 text-center sm:text-left">
            <div className="flex items-center justify-center gap-1.5 sm:justify-start">
              {editingField === 'username' ? (
                <input
                  ref={fieldInputRef}
                  aria-label="Username"
                  type="text"
                  autoComplete="username"
                  minLength={3}
                  maxLength={32}
                  pattern="[a-zA-Z0-9_]+"
                  required
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="field-sizing-content max-w-full border-0 border-b border-white/30 bg-transparent px-0 py-0 text-xl font-semibold text-zinc-50 outline-none focus:border-indigo-300"
                />
              ) : (
                <h2 className="truncate text-xl font-semibold text-zinc-50">{user.username}</h2>
              )}
              {editingField === 'username' ? (
                <>
                  <button type="submit" disabled={savingProfile || !hasUnsavedChanges} aria-label={savingProfile ? 'Saving username' : 'Save username'} title={savingProfile ? 'Saving username' : 'Save username'} className={plainIconButton}>
                    {savingProfile ? <SaveSpinner /> : <SavedCheck />}
                  </button>
                  <button type="button" disabled={savingProfile} aria-label="Cancel username edit" title="Cancel" onClick={cancelEdit} className={plainIconButton}>
                    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <path d="m5 5 10 10M15 5 5 15" />
                    </svg>
                  </button>
                </>
              ) : (
                savedField === 'username' ? (
                  <span className="inline-flex size-6 items-center justify-center text-emerald-300" role="status" aria-label="Username saved">
                    <SavedCheck />
                  </span>
                ) : (
                  <button type="button" aria-label="Edit username" title="Edit username" onClick={() => beginEdit('username')} className={plainIconButton}>
                    <EditIcon />
                  </button>
                )
              )}
            </div>

            <div className="flex items-center justify-center gap-1.5 sm:justify-start">
              {editingField === 'email' ? (
                <input
                  ref={fieldInputRef}
                  aria-label="Email"
                  type="email"
                  autoComplete="email"
                  maxLength={255}
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="field-sizing-content max-w-full border-0 border-b border-white/30 bg-transparent px-0 py-0 text-sm text-zinc-400 outline-none focus:border-indigo-300"
                />
              ) : (
                <p className="truncate text-sm text-zinc-400">{user.email}</p>
              )}
              {editingField === 'email' ? (
                <>
                  <button type="submit" disabled={savingProfile || !hasUnsavedChanges} aria-label={savingProfile ? 'Saving email' : 'Save email'} title={savingProfile ? 'Saving email' : 'Save email'} className={plainIconButton}>
                    {savingProfile ? <SaveSpinner /> : <SavedCheck />}
                  </button>
                  <button type="button" disabled={savingProfile} aria-label="Cancel email edit" title="Cancel" onClick={cancelEdit} className={plainIconButton}>
                    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <path d="m5 5 10 10M15 5 5 15" />
                    </svg>
                  </button>
                </>
              ) : (
                savedField === 'email' ? (
                  <span className="inline-flex size-6 items-center justify-center text-emerald-300" role="status" aria-label="Email saved">
                    <SavedCheck />
                  </span>
                ) : (
                  <button type="button" aria-label="Edit email" title="Edit email" onClick={() => beginEdit('email')} className={plainIconButton}>
                    <EditIcon />
                  </button>
                )
              )}
            </div>

            {savingAvatar ? <p className="text-xs text-zinc-400" role="status">Updating avatar…</p> : null}
            {avatarError ? <p className="text-xs text-rose-300" role="alert">{avatarError}</p> : null}
            {avatarPresetsQuery.isPending && avatarMenuOpen ? (
              <p className="text-xs text-zinc-400" role="status">Loading avatars…</p>
            ) : null}
            {profileError ? <p className="text-sm text-rose-300" role="alert">{profileError}</p> : null}
          </form>
        </div>
      </section>

      <section aria-labelledby={`${titleId}-collection`} className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2 id={`${titleId}-collection`} className="text-sm font-semibold text-zinc-200">
            Your collection
          </h2>
          <Link to="/" className="text-xs text-indigo-300 transition hover:text-indigo-200">
            Open collection
          </Link>
        </div>
        {collectionQuery.isPending ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" aria-hidden="true">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-xl border border-white/8 bg-zinc-900/35" />
            ))}
          </div>
        ) : collectionQuery.isError ? (
          <p className="text-sm text-zinc-400">Collection totals could not be loaded.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {collectionStats.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className="rounded-xl border border-white/8 bg-zinc-900/35 px-3 py-2.5 transition hover:border-indigo-300/30 hover:bg-indigo-500/10"
              >
                <span className="block text-xs text-zinc-400">{item.label}</span>
                <span className="mt-1 block text-lg font-semibold tabular-nums text-zinc-100">{item.value}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-zinc-950/40 px-4 py-3 text-sm text-zinc-400">
        Password and watch-site preferences live in{' '}
        <Link to="/settings" className="text-indigo-300 hover:text-indigo-200">
          Settings
        </Link>
        .
      </section>

      {pendingHref ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/75 p-5 backdrop-blur-md">
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`${titleId}-discard-title`}
            aria-describedby={`${titleId}-discard-description`}
            className="w-full max-w-sm rounded-2xl border border-white/15 bg-zinc-900/90 p-5 shadow-2xl shadow-black/50"
          >
            <h2 id={`${titleId}-discard-title`} className="text-base font-semibold text-zinc-50">
              Discard unsaved changes?
            </h2>
            <p id={`${titleId}-discard-description`} className="mt-2 text-sm leading-6 text-zinc-400">
              Your username or email edits haven’t been saved.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setPendingHref(null)} className={cn(UI.btn, UI.btnSecondary)}>
                Keep editing
              </button>
              <button
                type="button"
                onClick={() => {
                  const href = pendingHref
                  setPendingHref(null)
                  navigate(href)
                }}
                className={cn(UI.btn, 'border border-rose-300/20 bg-rose-500/15 text-rose-100 hover:bg-rose-500/25')}
              >
                Discard changes
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  )
}
