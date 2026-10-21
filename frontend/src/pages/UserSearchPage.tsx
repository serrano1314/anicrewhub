import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import { searchUsers } from '../api/sharing'
import { FollowActions } from '../components/FollowActions'
import { PageHeader } from '../components/PageHeader'
import { ErrorPanel } from '../components/PageStatus'
import { Pager } from '../components/Pager'
import { ProfileAvatar } from '../components/ProfileAvatar'
import { backFromUserSearch } from '../lib/navigation'
import { UI, cn } from '../lib/ui'

function parsePage(value: string | null): number {
  const page = Number(value)
  if (!Number.isInteger(page) || page < 1) {
    return 1
  }
  return page
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="8.5" cy="8.5" r="5.25" />
      <path d="m12.5 12.5 4 4" strokeLinecap="round" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="9" width="12" height="8" rx="2" />
      <path d="M7 9V7a3 3 0 0 1 6 0v2" />
    </svg>
  )
}

function FollowersIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <circle cx="7" cy="7" r="2.2" />
      <circle cx="13" cy="7.5" r="1.8" />
      <path d="M3.5 15.5v-1A3.5 3.5 0 0 1 7 11h0a3.5 3.5 0 0 1 3.5 3.5" />
      <path d="M11 14.8v-.3A2.8 2.8 0 0 1 13.8 11.7h0a2.8 2.8 0 0 1 2.7 2.8v.3" />
    </svg>
  )
}

export function UserSearchPage() {
  const [params, setParams] = useSearchParams()
  const urlQuery = params.get('q')?.trim() ?? ''
  const [input, setInput] = useState(urlQuery)
  const trimmed = input.trim()
  const page = trimmed === urlQuery ? parsePage(params.get('page')) : 1
  const searchQuery = useQuery({
    queryKey: ['user-search', trimmed, page],
    queryFn: () => searchUsers(trimmed, page),
    enabled: trimmed.length > 0,
    placeholderData: keepPreviousData,
  })

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (trimmed === urlQuery) {
        return
      }
      const nextParams = new URLSearchParams()
      if (trimmed) {
        nextParams.set('q', trimmed)
      }
      setParams(nextParams, { replace: true })
    }, 80)
    return () => window.clearTimeout(timer)
  }, [setParams, trimmed, urlQuery])

  useEffect(() => {
    function onPopState() {
      setInput(new URLSearchParams(window.location.search).get('q')?.trim() ?? '')
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const results = trimmed ? searchQuery.data?.results : undefined
  const showInitialLoading = Boolean(trimmed) && searchQuery.isPending && !searchQuery.data

  return (
    <div className={UI.page}>
      <PageHeader eyebrow="People" title="Search users" description="Find a profile by username." />

      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
          <SearchIcon />
        </span>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Username"
          aria-label="Search users by username"
          maxLength={50}
          autoFocus
          className="h-12 w-full rounded-full border border-white/10 bg-zinc-950/55 pl-11 pr-12 text-sm text-zinc-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] outline-none transition placeholder:text-zinc-500 hover:border-white/20 focus:border-indigo-400/45 focus:bg-zinc-950/80"
        />
        {trimmed ? (
          <button
            type="button"
            aria-label="Clear search"
            title="Clear search"
            onClick={() => setInput('')}
            className="absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="m5 5 10 10M15 5 5 15" />
            </svg>
          </button>
        ) : null}
      </div>

      {!trimmed ? (
        <p className="flex items-center gap-2 text-sm text-zinc-500">
          <SearchIcon />
          Type a username
        </p>
      ) : null}

      {showInitialLoading ? (
        <p className="text-sm text-zinc-400" role="status">Searching…</p>
      ) : null}

      {searchQuery.isError && trimmed ? (
        <ErrorPanel
          message={searchQuery.error instanceof ApiError ? searchQuery.error.message : 'Could not search users'}
          onRetry={() => { void searchQuery.refetch() }}
        />
      ) : null}

      {results && results.length === 0 && !searchQuery.isFetching ? (
        <p className="text-sm text-zinc-400">No matches</p>
      ) : null}

      {results && results.length > 0 ? (
        <ul
          className={cn(
            'overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
            searchQuery.isFetching && 'opacity-80',
          )}
        >
          {results.map((result) => (
            <li key={result.username} className="border-b border-white/8 last:border-b-0">
              <div className="flex items-center gap-3 px-3 py-2.5">
                <Link
                  to={`/users/${encodeURIComponent(result.username)}`}
                  state={{ back: backFromUserSearch(new URLSearchParams(trimmed ? { q: trimmed, ...(page > 1 ? { page: String(page) } : {}) } : {})) }}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-xl py-1 transition hover:text-indigo-100"
                >
                  <ProfileAvatar username={result.username} avatarId={result.avatar_id} size="sm" />
                  <span className="min-w-0 truncate font-medium text-zinc-50">{result.username}</span>
                  {!result.profile_public ? <span className="sr-only">Private</span> : null}
                </Link>
                <span className="flex shrink-0 items-center gap-2 text-zinc-400">
                  {!result.profile_public ? (
                    <span title="Private" className="inline-flex size-7 items-center justify-center text-amber-300/90">
                      <LockIcon />
                    </span>
                  ) : null}
                  {result.follower_count != null ? (
                    <span
                      title={`${result.follower_count} ${result.follower_count === 1 ? 'follower' : 'followers'}`}
                      className="inline-flex items-center gap-1 text-xs tabular-nums text-zinc-300"
                    >
                      <FollowersIcon />
                      {result.follower_count}
                    </span>
                  ) : null}
                </span>
                <FollowActions target={result} />
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {searchQuery.data && trimmed && trimmed === urlQuery ? (
        <Pager
          page={searchQuery.data.page}
          hasNext={searchQuery.data.has_next_page}
          onPage={(nextPage) => {
            const nextParams = new URLSearchParams()
            nextParams.set('q', trimmed)
            nextParams.set('page', String(nextPage))
            setParams(nextParams)
          }}
        />
      ) : null}
    </div>
  )
}
