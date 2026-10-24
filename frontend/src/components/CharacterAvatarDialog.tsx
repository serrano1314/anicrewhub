import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useInfiniteQuery } from '@tanstack/react-query'
import { fetchCharacterAvatars, type CharacterAvatar } from '../api/characterAvatars'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import { cn } from '../lib/ui'
import type { AvatarId } from '../types/auth'
import { ProfileAvatar } from './ProfileAvatar'

type CharacterAvatarDialogProps = {
  username: string
  avatarUrl: string | null
  onSelect: (avatarId: AvatarId | null, avatarUrl: string | null) => void
  onClose: () => void
}

export function CharacterAvatarDialog({
  username,
  avatarUrl,
  onSelect,
  onClose,
}: CharacterAvatarDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useBodyScrollLock(true)

  useEffect(() => {
    closeButtonRef.current?.focus({ preventScroll: true })
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 350)
    return () => window.clearTimeout(timer)
  }, [search])

  const charactersQuery = useInfiniteQuery({
    queryKey: ['character-avatars', debouncedSearch],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchCharacterAvatars(debouncedSearch, pageParam),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.has_more ? allPages.reduce((total, page) => total + page.results.length, 0) : undefined,
  })
  const characters = charactersQuery.data?.pages.flatMap((page) => page.results) ?? []

  function renderCharacter(character: CharacterAvatar) {
    const selected = avatarUrl === character.image_url
    return (
      <button
        key={character.anilist_id}
        type="button"
        aria-label={`Use ${character.name} avatar`}
        aria-pressed={selected}
        disabled={charactersQuery.isPending}
        onClick={() => onSelect(null, character.image_url)}
        className={cn(
          'group flex size-16 items-center justify-center rounded-full border border-white/10 bg-zinc-950/35 p-1 transition hover:border-indigo-300/50 hover:bg-indigo-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:opacity-50',
          selected && 'border-indigo-300 bg-indigo-500/15 ring-1 ring-indigo-300',
        )}
      >
        <ProfileAvatar
          username={username}
          avatarUrl={character.image_url}
          size="md"
          className="size-14"
        />
      </button>
    )
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-dialog-title"
        className="ui-modal-panel max-h-full w-full max-w-md overflow-y-auto p-5 sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-indigo-300">Profile</p>
            <h2 id="avatar-dialog-title" className="mt-1 text-lg font-semibold text-zinc-50">
              Choose your avatar
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Pick from your collection or search AniList characters.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close avatar picker"
            className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100 focus-visible:outline-2 focus-visible:outline-indigo-300"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="m5 5 10 10M15 5 5 15" />
            </svg>
          </button>
        </div>

        <label className="mt-5 block">
          <span className="sr-only">Search characters or anime titles</span>
          <span className="relative block">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search character or anime title…"
              className="w-full rounded-xl border border-white/10 bg-zinc-950/60 px-4 py-3 pr-10 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-indigo-300/70"
            />
            {search ? (
              <button
                type="button"
                aria-label="Clear character search"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/10 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="m5 5 10 10M15 5 5 15" />
                </svg>
              </button>
            ) : null}
          </span>
        </label>

        <div className="mt-5">
          <h3 className="text-sm font-semibold text-zinc-200">
            {debouncedSearch ? 'Search results' : 'Recommended characters'}
          </h3>
          {charactersQuery.isPending ? (
            <p className="py-8 text-center text-sm text-zinc-400">Finding characters…</p>
          ) : null}
          {charactersQuery.isError ? (
            <p className="py-8 text-center text-sm text-zinc-400">
              Characters are unavailable right now.
            </p>
          ) : null}
          {charactersQuery.isSuccess && !characters.length ? (
            <p className="py-8 text-center text-sm text-zinc-400">No characters found.</p>
          ) : null}
          {charactersQuery.isSuccess ? (
            <div className="mx-auto mt-3 grid w-fit max-w-full grid-cols-5 justify-items-center gap-1.5">
              {characters.map(renderCharacter)}
            </div>
          ) : null}
          {charactersQuery.hasNextPage ? (
            <button
              type="button"
              disabled={charactersQuery.isFetchingNextPage}
              onClick={() => void charactersQuery.fetchNextPage()}
              className="mx-auto mt-4 block text-sm font-medium text-indigo-300 underline decoration-indigo-300/50 underline-offset-4 transition hover:text-indigo-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:opacity-50"
            >
              {charactersQuery.isFetchingNextPage ? 'Loading more…' : 'Load more avatars'}
            </button>
          ) : null}
        </div>

        <div className="mt-6 border-t border-white/10 pt-5">
          <h3 className="text-sm font-semibold text-zinc-200">Default avatar</h3>
          <button
            type="button"
            aria-label="Change back to initials avatar"
            aria-pressed={!avatarUrl}
            onClick={() => onSelect(null, null)}
            className={cn(
              'mt-3 inline-flex items-center gap-3 rounded-full border border-white/10 bg-zinc-950/35 p-1 pr-3 transition hover:border-indigo-300/50 hover:bg-indigo-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300',
              !avatarUrl && 'border-indigo-300 bg-indigo-500/15 ring-1 ring-indigo-300',
            )}
          >
            <ProfileAvatar username={username} size="md" className="size-12" />
            <span className="text-sm text-zinc-300">Use initials</span>
          </button>
        </div>

      </section>
    </div>,
    document.body,
  )
}
