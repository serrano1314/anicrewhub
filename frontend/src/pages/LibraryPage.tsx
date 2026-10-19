import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import { fetchLibrary, setEpisodeWatched } from '../api/library'
import { EmptyState, ErrorPanel, LoadingIndicator } from '../components/PageStatus'
import { Pager } from '../components/Pager'
import { ProgressMeter } from '../components/ProgressMeter'
import { displayTitle, metaLine } from '../lib/display'
import { nextEpisodeToMark } from '../lib/episodes'
import { PageHeader } from '../components/PageHeader'
import { backFromLibrary } from '../lib/navigation'
import { UI, cn } from '../lib/ui'
import { STATUS_LABELS, isLibraryStatus, type LibraryStatus } from '../types/library'

const TABS: { id: string; label: string; status?: LibraryStatus }[] = [
  { id: 'all', label: 'All' },
  { id: 'watching', label: STATUS_LABELS.watching, status: 'watching' },
  { id: 'completed', label: STATUS_LABELS.completed, status: 'completed' },
  { id: 'plan_to_watch', label: STATUS_LABELS.plan_to_watch, status: 'plan_to_watch' },
  { id: 'on_hold', label: STATUS_LABELS.on_hold, status: 'on_hold' },
  { id: 'dropped', label: STATUS_LABELS.dropped, status: 'dropped' },
]

function parsePage(value: string | null): number {
  const page = Number(value)
  if (!Number.isInteger(page) || page < 1) {
    return 1
  }
  return page
}

export function LibraryPage() {
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const statusParam = params.get('status')
  const status = statusParam && isLibraryStatus(statusParam) ? statusParam : undefined
  const page = parsePage(params.get('page'))
  const activeTab = status ?? 'all'
  const [searchInput, setSearchInput] = useState(params.get('q') ?? '')

  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = searchInput.trim()
      const updated = new URLSearchParams(params)
      if (trimmed) {
        updated.set('q', trimmed)
        updated.delete('page')
      } else {
        updated.delete('q')
      }
      setParams(updated)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput, params, setParams])

  const query = params.get('q')?.trim() ?? ''
  const listQuery = useQuery({
    queryKey: ['library', status ?? 'all', page, query],
    queryFn: () => fetchLibrary(status, page, query),
  })

  const plusOne = useMutation({
    mutationFn: (input: { anilistId: number; episode: number }) =>
      setEpisodeWatched(input.anilistId, input.episode, true),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['library'] })
      await queryClient.invalidateQueries({ queryKey: ['episodes'] })
      await queryClient.invalidateQueries({ queryKey: ['library-entry'] })
    },
  })

  function setTab(next: LibraryStatus | undefined) {
    const updated = new URLSearchParams(params)
    if (next) {
      updated.set('status', next)
    } else {
      updated.delete('status')
    }
    updated.delete('page')
    setParams(updated)
  }

  function setPage(next: number) {
    const updated = new URLSearchParams(params)
    if (next <= 1) {
      updated.delete('page')
    } else {
      updated.set('page', String(next))
    }
    setParams(updated)
  }

  const errorMessage =
    plusOne.error instanceof ApiError
      ? plusOne.error.message
      : plusOne.error
        ? 'Could not update progress'
        : listQuery.error instanceof ApiError
          ? listQuery.error.message
          : listQuery.error
            ? 'Could not load your list'
            : null

  return (
    <section className={UI.page}>
      <PageHeader title="My List" description="Track progress and jump back into any show." />
      <div className="mb-4">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search your saved anime…"
          className={cn(UI.input, 'w-full', 'rounded-full')}
          aria-label="Search your saved anime"
        />
      </div>
      <div className="ui-tablist" role="tablist" aria-label="List status">
        {TABS.map((tab) => {
          const selected = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(tab.status)}
              className={cn(UI.pill, selected && UI.pillActive)}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
      {errorMessage && !listQuery.isError ? <p className="text-sm text-red-400">{errorMessage}</p> : null}
      {listQuery.isPending ? <LoadingIndicator label="Loading your list…" /> : null}
      {listQuery.isError ? (
        <ErrorPanel
          message={errorMessage ?? 'Could not load your list'}
          onRetry={() => {
            void listQuery.refetch()
          }}
        />
      ) : null}
      {listQuery.data && listQuery.data.results.length === 0 ? (
        <EmptyState>
          Nothing here yet.{' '}
          <Link to="/search" className="text-indigo-400 hover:underline">
            Search for an anime
          </Link>{' '}
          to add it.
        </EmptyState>
      ) : null}
      <ul className="search-results grid gap-4 sm:grid-cols-2">
        {listQuery.data?.results.map((entry) => {
          const title = displayTitle(entry)
          const next = nextEpisodeToMark(entry.last_episode_watched, entry.total_episodes)
          const pending =
            plusOne.isPending && plusOne.variables?.anilistId === entry.anilist_id
          return (
            <li key={entry.anilist_id} className={cn(UI.card, UI.cardInteractive, 'search-results-card')}>
              <Link
                to={`/anime/${entry.anilist_id}`}
                state={{ back: backFromLibrary(params) }}
                className="flex gap-3"
              >
                {entry.cover_url ? (
                  <img
                    src={entry.cover_url}
                    alt=""
                    className="h-24 w-16 shrink-0 rounded-lg object-cover ring-1 ring-white/10"
                  />
                ) : (
                  <div className="h-24 w-16 shrink-0 rounded-md bg-zinc-800" />
                )}
                <div className="min-w-0 flex-1 space-y-2">
                  <div>
                    <h2 className="truncate font-medium">{title}</h2>
                    <p className="truncate text-xs text-zinc-500">
                      {[STATUS_LABELS[entry.status], metaLine(entry.format, null, null)]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <ProgressMeter
                    watchedCount={entry.watched_count}
                    totalEpisodes={entry.total_episodes}
                    lastEpisodeWatched={entry.last_episode_watched}
                  />
                </div>
              </Link>
              <button
                type="button"
                disabled={next == null || pending}
                aria-label={next == null ? 'No next episode' : `Mark episode ${next} watched`}
                onClick={() => {
                  if (next != null) {
                    plusOne.mutate({ anilistId: entry.anilist_id, episode: next })
                  }
                }}
                className={cn(UI.btn, UI.btnSecondary, 'mt-4 w-full py-2')}
              >
                {pending ? 'Saving…' : '+1 episode'}
              </button>
            </li>
          )
        })}
      </ul>
      {listQuery.data ? (
        <Pager page={listQuery.data.page} hasNext={listQuery.data.has_next_page} onPage={setPage} />
      ) : null}
    </section>
  )
}
