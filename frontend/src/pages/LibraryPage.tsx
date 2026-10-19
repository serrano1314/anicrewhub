import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import { fetchLibrary, setEpisodeWatched, updateLibrary } from '../api/library'
import { EmptyState, ErrorPanel } from '../components/PageStatus'
import { Pager } from '../components/Pager'
import { ProgressMeter } from '../components/ProgressMeter'
import { Select } from '../components/Select'
import { StarRating } from '../components/StarRating'
import { WatchLinksDialog } from '../components/WatchLinksDialog'
import { displayTitle, metaLine } from '../lib/display'
import { nextEpisodeToMark } from '../lib/episodes'
import { PageHeader } from '../components/PageHeader'
import { backFromLibrary } from '../lib/navigation'
import { UI, cn } from '../lib/ui'
import {
  STATUS_LABELS,
  isLibraryStatus,
  type LibrarySort,
  type LibraryStatus,
} from '../types/library'

type DisplayMode = 'compact' | 'normal' | 'wide'

const DISPLAY_MODES: { id: DisplayMode; label: string }[] = [
  { id: 'compact', label: 'Compact' },
  { id: 'normal', label: 'Normal' },
  { id: 'wide', label: 'Wide' },
]
const DISPLAY_MODE_STORAGE_KEY = 'anitracker.library.displayMode'
const SORT_OPTIONS: { value: LibrarySort; label: string }[] = [
  { value: 'updated', label: 'Recently updated' },
  { value: 'title', label: 'Title A–Z' },
  { value: 'rating', label: 'Highest rating' },
  { value: 'progress', label: 'Most progress' },
]

function isLibrarySort(value: string | null): value is LibrarySort {
  return value === 'updated' || value === 'title' || value === 'rating' || value === 'progress'
}

function isDisplayMode(value: string | null): value is DisplayMode {
  return value === 'compact' || value === 'normal' || value === 'wide'
}

function getSavedDisplayMode(): DisplayMode {
  try {
    const saved = window.localStorage.getItem(DISPLAY_MODE_STORAGE_KEY)
    return isDisplayMode(saved) ? saved : 'normal'
  } catch (error) {
    console.warn('Unable to load the saved library layout preference.', error)
    return 'normal'
  }
}

const TABS: { id: string; label: string; status?: LibraryStatus; favorites?: boolean }[] = [
  { id: 'all', label: 'All' },
  { id: 'favorites', label: 'Favorites', favorites: true },
  { id: 'watching', label: STATUS_LABELS.watching, status: 'watching' },
  { id: 'completed', label: STATUS_LABELS.completed, status: 'completed' },
  { id: 'plan_to_watch', label: STATUS_LABELS.plan_to_watch, status: 'plan_to_watch' },
  { id: 'on_hold', label: STATUS_LABELS.on_hold, status: 'on_hold' },
  { id: 'dropped', label: STATUS_LABELS.dropped, status: 'dropped' },
]

function LibraryStatusIcon({ status }: { status: LibraryStatus }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
      {status === 'watching' ? (
        <path fill="currentColor" d="M10 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17ZM8 6l6 4-6 4z" />
      ) : status === 'completed' ? (
        <path
          fill="currentColor"
          d="M10 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Zm-1.1 12.2-3-3 1.4-1.4 1.6 1.6 3.8-4 1.5 1.4z"
        />
      ) : status === 'plan_to_watch' ? (
        <path
          fill="currentColor"
          d="M4 2.5h12a1 1 0 0 1 1 1v14l-7-3.7-7 3.7v-14a1 1 0 0 1 1-1Zm1 2v9.7l5-2.6 5 2.6V4.5z"
        />
      ) : status === 'on_hold' ? (
        <path fill="currentColor" d="M10 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17ZM7 6h2.5v8H7zm4.5 0H14v8h-2.5z" />
      ) : (
        <path
          fill="currentColor"
          d="M10 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Zm3.4 10.5-1.4 1.4-2-2-2 2-1.4-1.4 2-2-2-2 1.4-1.4 2 2 2-2 1.4 1.4-2 2z"
        />
      )}
    </svg>
  )
}

function parsePage(value: string | null): number {
  const page = Number(value)
  if (!Number.isInteger(page) || page < 1) {
    return 1
  }
  return page
}

function ScrollingTitle({ title }: { title: string }) {
  const containerRef = useRef<HTMLHeadingElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const [scrollDistance, setScrollDistance] = useState(0)

  useEffect(() => {
    const container = containerRef.current
    const text = textRef.current
    if (!container || !text) return

    const measure = () => {
      setScrollDistance(Math.max(0, text.scrollWidth - container.clientWidth))
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    observer.observe(text)
    return () => observer.disconnect()
  }, [title])

  const style: CSSProperties & { '--title-scroll-distance'?: string; '--title-scroll-duration'?: string } =
    scrollDistance > 0
      ? {
          '--title-scroll-distance': `${scrollDistance}px`,
          '--title-scroll-duration': `${Math.max(8, scrollDistance / 24 + 4)}s`,
        }
      : {}

  return (
    <h2 ref={containerRef} title={title} className="min-w-0 overflow-hidden whitespace-nowrap font-medium">
      <span
        ref={textRef}
        style={style}
        className={cn(
          'inline-block max-w-full truncate align-bottom',
          scrollDistance > 0 && 'library-title-marquee max-w-none',
        )}
      >
        {title}
      </span>
    </h2>
  )
}

export function LibraryPage() {
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const statusParam = params.get('status')
  const status = statusParam && isLibraryStatus(statusParam) ? statusParam : undefined
  const page = parsePage(params.get('page'))
  const favorites = params.get('favorites') === 'true'
  const sortParam = params.get('sort')
  const sort = isLibrarySort(sortParam) ? sortParam : 'updated'
  const activeTab = favorites ? 'favorites' : status ?? 'all'
  const activeTabLabel = TABS.find((tab) => tab.id === activeTab)?.label ?? 'All'
  const [searchInput, setSearchInput] = useState(params.get('q') ?? '')
  const [displayMode, setDisplayModeValue] = useState<DisplayMode>(getSavedDisplayMode)
  const [openActionsId, setOpenActionsId] = useState<number | null>(null)
  const [watchSelection, setWatchSelection] = useState<{
    anilistId: number
    title: string
    episode: number
  } | null>(null)

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

  useEffect(() => {
    try {
      window.localStorage.setItem(DISPLAY_MODE_STORAGE_KEY, displayMode)
    } catch (error) {
      console.warn('Unable to save the library layout preference.', error)
    }
  }, [displayMode])

  const query = params.get('q')?.trim() ?? ''
  const listQuery = useQuery({
    queryKey: ['library', status ?? 'all', favorites, page, query, sort],
    queryFn: () => fetchLibrary(status, page, query, favorites, sort),
  })

  const episodeMutation = useMutation({
    mutationFn: (input: { anilistId: number; episode: number; watched: boolean }) =>
      setEpisodeWatched(input.anilistId, input.episode, input.watched),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['library'] })
      await queryClient.invalidateQueries({ queryKey: ['episodes'] })
      await queryClient.invalidateQueries({ queryKey: ['library-entry'] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: (input: {
      anilistId: number
      changes: { status?: LibraryStatus; score?: number | null; is_favorite?: boolean }
    }) => updateLibrary(input.anilistId, input.changes),
    onSuccess: async (_entry, input) => {
      await queryClient.invalidateQueries({ queryKey: ['library'] })
      await queryClient.invalidateQueries({ queryKey: ['library-entry', input.anilistId] })
    },
  })

  function setTab(tab: (typeof TABS)[number]) {
    const updated = new URLSearchParams(params)
    if (tab.status) {
      updated.set('status', tab.status)
    } else {
      updated.delete('status')
    }
    if (tab.favorites) {
      updated.set('favorites', 'true')
    } else {
      updated.delete('favorites')
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

  function setSort(next: string) {
    if (!isLibrarySort(next)) return
    const updated = new URLSearchParams(params)
    if (next === 'updated') {
      updated.delete('sort')
    } else {
      updated.set('sort', next)
    }
    updated.delete('page')
    setParams(updated)
  }

  function setDisplayMode(next: DisplayMode) {
    setDisplayModeValue(next)
  }

  const errorMessage =
    episodeMutation.error instanceof ApiError
      ? episodeMutation.error.message
      : episodeMutation.error
        ? 'Could not update progress'
        : updateMutation.error instanceof ApiError
          ? updateMutation.error.message
          : updateMutation.error
            ? 'Could not update your list'
            : listQuery.error instanceof ApiError
              ? listQuery.error.message
              : listQuery.error
                ? 'Could not load your list'
                : null

  return (
    <section className={UI.page}>
      <PageHeader title="My Collection" description="Track progress and jump back into any show." />
      {listQuery.data?.summary ? (
        <div
          className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"
          aria-label="Collection overview"
        >
          {[
            { label: 'Saved', value: listQuery.data.summary.total, tone: 'text-zinc-100' },
            { label: 'Watching', value: listQuery.data.summary.watching, tone: 'text-indigo-200' },
            { label: 'Completed', value: listQuery.data.summary.completed, tone: 'text-emerald-200' },
            { label: 'Plan to watch', value: listQuery.data.summary.plan_to_watch, tone: 'text-sky-200' },
            { label: 'Favorites', value: listQuery.data.summary.favorites, tone: 'text-rose-200' },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between gap-2 rounded-xl border border-white/8 bg-zinc-900/35 px-3 py-2.5"
            >
              <span className="truncate text-xs text-zinc-400">{item.label}</span>
              <span className={cn('text-sm font-semibold tabular-nums', item.tone)}>{item.value}</span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="relative">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search your saved anime…"
          className={cn(UI.input, 'w-full rounded-full pr-11')}
          aria-label="Search your saved anime"
        />
        {searchInput ? (
          <button
            type="button"
            aria-label="Clear search"
            title="Clear search"
            onClick={() => setSearchInput('')}
            className="absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
              <path d="m5 5 10 10M15 5 5 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}
      </div>
      <div className="ui-tablist" role="tablist" aria-label="List view">
        {TABS.map((tab) => {
          const selected = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-label={tab.label}
              title={tab.label}
              onClick={() => setTab(tab)}
              className={cn(UI.pill, 'p-2.5', selected && UI.pillActive)}
            >
              <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
                {tab.id === 'all' ? (
                  <path
                    fill="currentColor"
                    d="M3 3h14v3H3zm0 5.5h14v3H3zm0 5.5h14v3H3z"
                  />
                ) : tab.id === 'favorites' ? (
                  <path
                    d="M16.8 3.8a4.5 4.5 0 0 0-6.4 0L10 4.2l-.4-.4a4.5 4.5 0 0 0-6.4 6.4l.4.4 6.4 6.1 6.4-6.1.4-.4a4.5 4.5 0 0 0 0-6.4Z"
                    fill="currentColor"
                  />
                ) : tab.id === 'watching' ? (
                  <path
                    fill="currentColor"
                    d="M10 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17ZM8 6l6 4-6 4z"
                  />
                ) : tab.id === 'completed' ? (
                  <path
                    fill="currentColor"
                    d="M10 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Zm-1.1 12.2-3-3 1.4-1.4 1.6 1.6 3.8-4 1.5 1.4z"
                  />
                ) : tab.id === 'plan_to_watch' ? (
                  <path
                    fill="currentColor"
                    d="M4 2.5h12a1 1 0 0 1 1 1v14l-7-3.7-7 3.7v-14a1 1 0 0 1 1-1Zm1 2v9.7l5-2.6 5 2.6V4.5z"
                  />
                ) : tab.id === 'on_hold' ? (
                  <path
                    fill="currentColor"
                    d="M10 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17ZM7 6h2.5v8H7zm4.5 0H14v8h-2.5z"
                  />
                ) : (
                  <path
                    fill="currentColor"
                    d="M10 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Zm3.4 10.5-1.4 1.4-2-2-2 2-1.4-1.4 2-2-2-2 1.4-1.4 2 2 2-2 1.4 1.4-2 2z"
                  />
                )}
              </svg>
            </button>
          )
        })}
      </div>
      {errorMessage && !listQuery.isError ? <p className="text-sm text-red-400">{errorMessage}</p> : null}
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
          <div className="space-y-2">
            <p className="font-medium text-zinc-200">
              {query
                ? `No anime match “${query}”.`
                : favorites
                  ? 'No favorites yet.'
                  : status
                    ? `No ${STATUS_LABELS[status].toLowerCase()} anime yet.`
                    : 'Your collection is empty.'}
            </p>
            <p className="text-zinc-400">
              {query
                ? 'Try another title or clear your search to see your collection.'
                : favorites
                  ? 'Mark shows as favorites to keep them easy to find.'
                  : status
                    ? 'You can change a show’s status from its quick actions.'
                    : 'Search for a show and add it to start tracking your watch progress.'}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {query ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  title="Clear search"
                  onClick={() => setSearchInput('')}
                  className={cn(UI.btn, UI.btnSecondary, 'size-9 rounded-full p-0 text-indigo-200')}
                >
                  <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
                    <path d="m5 5 10 10M15 5 5 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              ) : favorites || status ? (
                <button
                  type="button"
                  aria-label="View all saved anime"
                  title="View all saved anime"
                  onClick={() => setTab(TABS[0])}
                  className={cn(UI.btn, UI.btnSecondary, 'size-9 rounded-full p-0 text-indigo-200')}
                >
                  <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
                    <path d="M3 3h14v3H3zm0 5.5h14v3H3zm0 5.5h14v3H3z" fill="currentColor" />
                  </svg>
                </button>
              ) : (
                <Link
                  to="/search"
                  aria-label="Search anime"
                  title="Search anime"
                  className={cn(UI.btn, UI.btnSecondary, 'size-9 rounded-full p-0 text-indigo-200')}
                >
                  <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <circle cx="8.5" cy="8.5" r="5.5" />
                    <path d="m12.5 12.5 4 4" strokeLinecap="round" />
                  </svg>
                </Link>
              )}
            </div>
          </div>
        </EmptyState>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-base font-medium tracking-wide text-zinc-300" aria-live="polite">
          {activeTabLabel}
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Select
            value={sort}
            onChange={setSort}
            options={SORT_OPTIONS}
            aria-label="Sort collection"
            className="w-48"
          />
          <div
            className="hidden rounded-full border border-white/10 bg-zinc-950/40 p-1 px-1.5 lg:flex"
            role="group"
            aria-label="Card display size"
          >
            {DISPLAY_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              aria-label={`${mode.label} card layout`}
              title={`${mode.label} card layout`}
              aria-pressed={displayMode === mode.id}
              onClick={() => setDisplayMode(mode.id)}
              className={cn(
                'rounded-full p-2 transition-colors',
                displayMode === mode.id ? 'bg-indigo-500/20 text-indigo-100' : 'text-zinc-400 hover:text-zinc-100',
              )}
            >
              <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
                {mode.id === 'compact' ? (
                  <>
                    <rect x="2" y="2" width="6" height="7" rx="1" fill="currentColor" />
                    <rect x="9" y="2" width="6" height="7" rx="1" fill="currentColor" />
                    <rect x="2" y="11" width="6" height="7" rx="1" fill="currentColor" />
                    <rect x="9" y="11" width="6" height="7" rx="1" fill="currentColor" />
                    <rect x="16" y="2" width="2" height="16" rx="1" fill="currentColor" opacity=".55" />
                  </>
                ) : mode.id === 'normal' ? (
                  <>
                    <rect x="2" y="2" width="7" height="7" rx="1" fill="currentColor" />
                    <rect x="11" y="2" width="7" height="7" rx="1" fill="currentColor" />
                    <rect x="2" y="11" width="7" height="7" rx="1" fill="currentColor" />
                    <rect x="11" y="11" width="7" height="7" rx="1" fill="currentColor" />
                  </>
                ) : (
                  <>
                    <rect x="2" y="3" width="16" height="5" rx="1" fill="currentColor" />
                    <rect x="2" y="10" width="16" height="2" rx="1" fill="currentColor" opacity=".7" />
                    <rect x="2" y="14" width="12" height="2" rx="1" fill="currentColor" opacity=".7" />
                  </>
                )}
              </svg>
            </button>
            ))}
          </div>
        </div>
      </div>
      {listQuery.isPending ? (
        <div className="sr-only" role="status" aria-live="polite">
          Loading your list…
        </div>
      ) : null}
      <ul
        className={cn(
          'search-results grid items-start gap-4',
          displayMode === 'compact' && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4',
          displayMode === 'normal' && 'grid-cols-1 md:grid-cols-2',
          displayMode === 'wide' && 'grid-cols-1',
        )}
      >
        {listQuery.isPending
          ? Array.from({ length: 6 }, (_, index) => (
              <li
                key={`loading-${index}`}
                aria-hidden="true"
                className={cn(
                  UI.card,
                  'flex min-h-40 animate-pulse flex-col gap-4 overflow-hidden p-4 sm:p-5',
                  displayMode === 'compact' && 'sm:p-3',
                  displayMode === 'wide' && 'sm:flex-row sm:items-center',
                )}
              >
                <div className="flex min-w-0 flex-1 gap-3">
                  <div
                    className={cn(
                      'h-24 w-16 shrink-0 rounded-lg bg-white/[0.06]',
                      displayMode === 'compact' && 'h-20 w-14',
                      displayMode === 'wide' && 'sm:h-28 sm:w-20',
                    )}
                  />
                  <div className="flex min-w-0 flex-1 flex-col justify-center gap-3 py-1">
                    <div className="h-4 w-3/4 rounded bg-white/[0.08]" />
                    <div className="h-3 w-1/2 rounded bg-white/[0.05]" />
                    <div className="h-2 w-full max-w-56 rounded-full bg-white/[0.06]" />
                  </div>
                </div>
                <div className="flex justify-center gap-1.5 py-1">
                  {Array.from({ length: 5 }, (_, starIndex) => (
                    <span
                      key={starIndex}
                      className="h-4 w-4 rounded-sm bg-white/[0.06]"
                    />
                  ))}
                </div>
              </li>
            ))
          : listQuery.data?.results.map((entry) => {
          const title = displayTitle(entry)
          const next = nextEpisodeToMark(entry.last_episode_watched, entry.total_episodes)
          const episodePending =
            episodeMutation.isPending && episodeMutation.variables?.anilistId === entry.anilist_id
          const updatePending =
            updateMutation.isPending && updateMutation.variables?.anilistId === entry.anilist_id
          const actionsOpen = openActionsId === entry.anilist_id
          const actionsToggle = (
            <button
              type="button"
              aria-label={actionsOpen ? 'Close quick actions' : 'Open quick actions'}
              aria-expanded={actionsOpen}
              aria-controls={`library-actions-${entry.anilist_id}`}
              onClick={() => setOpenActionsId(actionsOpen ? null : entry.anilist_id)}
              className={cn(
                'relative z-10 flex flex-col items-center gap-1.5 py-2 text-zinc-300 transition-colors hover:text-white',
                actionsOpen
                  ? '-mx-3 -mb-3 w-[calc(100%+1.5rem)] rounded-b-2xl border-t border-white/15'
                  : cn(
                      'mt-3 rounded-b-2xl border-t border-white/15 sm:mt-4',
                      displayMode === 'compact'
                        ? '-mx-3 -mb-3 w-auto px-3'
                        : '-mx-4 -mb-4 w-auto px-4 sm:-mx-5 sm:-mb-5 sm:px-5',
                      displayMode === 'wide' && 'sm:col-span-2',
                    ),
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'h-0.5 w-8 rounded-full bg-white/35 transition-all duration-200',
                  actionsOpen && 'w-10 bg-indigo-300/70',
                )}
              />
              <svg
                viewBox="0 0 20 20"
                aria-hidden="true"
                className={cn('h-4 w-4 transition-transform duration-200', actionsOpen && 'rotate-180')}
              >
                <path
                  fill="currentColor"
                  d="M5.3 7.7a1 1 0 0 1 1.4 0L10 11l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z"
                />
              </svg>
            </button>
          )
          return (
            <li
              key={entry.anilist_id}
              className={cn(
                UI.cardInteractive,
                'search-results-card group relative flex flex-col overflow-hidden',
                displayMode === 'compact' ? 'p-3 sm:p-3' : 'p-4 sm:p-5',
                displayMode === 'wide' && 'sm:grid sm:grid-cols-[minmax(0,1fr)_9rem] sm:items-center sm:gap-x-5',
              )}
            >
              {entry.cover_url ? (
                <img
                  src={entry.cover_url}
                  alt=""
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 z-0 h-full w-full scale-105 object-cover opacity-45 saturate-150 blur-[2px] transition-opacity duration-300 group-hover:opacity-60"
                />
              ) : null}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-br from-zinc-950/80 via-zinc-950/55 to-zinc-950/80"
              />
              <Link
                to={`/anime/${entry.anilist_id}`}
                state={{ back: backFromLibrary(params) }}
                className={cn(
                  'relative z-10 flex min-w-0 flex-1 gap-3 pr-8',
                  displayMode === 'wide' && 'sm:items-center',
                )}
              >
                {entry.cover_url ? (
                  <img
                    src={entry.cover_url}
                    alt=""
                    className={cn(
                      'shrink-0 rounded-lg object-cover ring-1 ring-white/10',
                      displayMode === 'compact' ? 'h-20 w-14' : 'h-24 w-16',
                      displayMode === 'wide' && 'sm:h-28 sm:w-20',
                    )}
                  />
                ) : (
                  <div
                    className={cn(
                      'shrink-0 rounded-md bg-zinc-800',
                      displayMode === 'compact' ? 'h-20 w-14' : 'h-24 w-16',
                      displayMode === 'wide' && 'sm:h-28 sm:w-20',
                    )}
                  />
                )}
                <div
                  className={cn(
                    'min-w-0 flex-1 space-y-2',
                    displayMode === 'wide' && 'sm:flex sm:items-center sm:gap-8',
                  )}
                >
                  <div className={cn('min-w-0', displayMode === 'wide' && 'sm:flex-1')}>
                    <ScrollingTitle title={title} />
                    <p className="truncate text-xs text-zinc-500">
                      {[STATUS_LABELS[entry.status], metaLine(entry.format, null, null)]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <div className={cn(displayMode === 'wide' && 'sm:w-56 sm:shrink-0')}>
                    <ProgressMeter
                      watchedCount={entry.watched_count}
                      totalEpisodes={entry.total_episodes}
                      lastEpisodeWatched={entry.last_episode_watched}
                    />
                  </div>
                </div>
              </Link>
              <div className="relative z-10 mt-2 flex min-w-0 items-center justify-center">
                <StarRating
                  value={entry.score}
                  disabled={updatePending}
                  onChange={(score) =>
                    updateMutation.mutate({
                      anilistId: entry.anilist_id,
                      changes: { score },
                    })
                  }
                />
              </div>
              <button
                type="button"
                disabled={updatePending}
                aria-label={entry.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                aria-pressed={entry.is_favorite}
                title={entry.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                onClick={() =>
                  updateMutation.mutate({
                    anilistId: entry.anilist_id,
                    changes: { is_favorite: !entry.is_favorite },
                  })
                }
                className="absolute right-3 top-3 z-20 rounded-full p-1 text-rose-300 transition hover:bg-white/10 disabled:opacity-50"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
                  <path
                    d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"
                    fill={entry.is_favorite ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              {!actionsOpen ? actionsToggle : null}
              <div
                id={`library-actions-${entry.anilist_id}`}
                aria-hidden={!actionsOpen}
                inert={!actionsOpen}
                className={cn(
                  'library-actions relative z-10',
                  displayMode === 'wide' && 'sm:col-span-2',
                  displayMode === 'compact'
                    ? '-mx-3 -mb-3 w-auto'
                    : '-mx-4 -mb-4 w-auto sm:-mx-5 sm:-mb-5',
                )}
                data-open={actionsOpen}
              >
                <div className="library-actions__inner min-w-0 w-full rounded-b-2xl border-t border-white/10 bg-zinc-950/45 px-3 pb-3">
                  <div
                    className={cn(
                      'flex min-w-0 flex-col gap-4 pt-4',
                      displayMode !== 'compact' && 'sm:grid sm:grid-cols-2',
                    )}
                  >
                    <div className="w-full min-w-0 space-y-2 p-3">
                      <p className={UI.fieldLabel}>Quick progress</p>
                      <div className="flex gap-2">
                        <div className="flex min-w-0 flex-1">
                          <button
                            type="button"
                            disabled={entry.last_episode_watched < 1 || episodePending}
                            aria-label={
                              entry.last_episode_watched < 1
                                ? 'No watched episode to remove'
                                : `Unmark episode ${entry.last_episode_watched} watched`
                            }
                            title={
                              entry.last_episode_watched < 1
                                ? 'No watched episode to remove'
                                : `Remove episode ${entry.last_episode_watched} from progress`
                            }
                            onClick={() => {
                              if (entry.last_episode_watched > 0) {
                                episodeMutation.mutate({
                                  anilistId: entry.anilist_id,
                                  episode: entry.last_episode_watched,
                                  watched: false,
                                })
                              }
                            }}
                            className={cn(
                              UI.btn,
                              UI.btnSecondary,
                              'relative z-10 w-8 shrink-0 rounded-r-none px-1 py-2',
                            )}
                          >
                            <svg viewBox="0 0 20 20" aria-hidden="true" className="h-3.5 w-3.5">
                              <path
                                d="M4 10h12"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                              />
                            </svg>
                          </button>
                          <button
                            type="button"
                            disabled={next == null || episodePending}
                            aria-label={
                              next == null ? 'All episodes watched' : `Mark episode ${next} watched`
                            }
                            onClick={() => {
                              if (next != null) {
                                episodeMutation.mutate({
                                  anilistId: entry.anilist_id,
                                  episode: next,
                                  watched: true,
                                })
                              }
                            }}
                            className={cn(
                              UI.btn,
                              UI.btnPrimary,
                              'min-w-0 flex-1 -ml-px gap-2 rounded-l-none py-2',
                            )}
                          >
                            {episodePending ? (
                              'Saving…'
                            ) : next == null ? (
                              'All watched'
                            ) : (
                              <>
                                <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 shrink-0">
                                  <path
                                    fill="currentColor"
                                    d="M10 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Zm-1.1 12.2-3-3 1.4-1.4 1.6 1.6 3.8-4 1.5 1.4z"
                                  />
                                </svg>
                                <span className="truncate">Ep. {next}</span>
                              </>
                            )}
                          </button>
                        </div>
                        <button
                          type="button"
                          disabled={next == null}
                          aria-label={next == null ? 'No next episode to watch' : `Watch episode ${next}`}
                          title={next == null ? 'No next episode to watch' : `Watch episode ${next}`}
                          onClick={() => {
                            if (next != null) {
                              setWatchSelection({
                                anilistId: entry.anilist_id,
                                title,
                                episode: next,
                              })
                            }
                          }}
                          className={cn(UI.btn, UI.btnSecondary, 'shrink-0 gap-2 py-2')}
                        >
                          <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
                            <path
                              fill="currentColor"
                              d="M10 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17ZM8 6l6 4-6 4z"
                            />
                          </svg>
                          {/* Watch */}
                        </button>
                      </div>
                    </div>
                    <div className="w-full min-w-0 space-y-2 p-3">
                      <p className={UI.fieldLabel}>Change status</p>
                      <div
                        className={cn(
                          'grid w-full min-w-0 grid-cols-5 gap-2',
                          displayMode === 'wide' && 'justify-items-center gap-1.5',
                        )}
                        role="group"
                        aria-label="Change anime status"
                      >
                        {Object.entries(STATUS_LABELS).map(([value, label]) => {
                          if (!isLibraryStatus(value)) {
                            return null
                          }
                          const selected = entry.status === value
                          return (
                            <button
                              key={value}
                              type="button"
                              disabled={updatePending}
                              aria-label={label}
                              aria-pressed={selected}
                              title={label}
                              onClick={() =>
                                updateMutation.mutate({
                                  anilistId: entry.anilist_id,
                                  changes: { status: value },
                                })
                              }
                              className={cn(
                                'flex items-center justify-center rounded-full border transition-colors disabled:opacity-50',
                                displayMode === 'wide'
                                  ? 'h-15 w-15 p-1'
                                  : 'aspect-square w-full p-1.5',
                                selected
                                  ? 'border-indigo-400/40 bg-indigo-500/20 text-indigo-100'
                                  : 'border-white/10 bg-zinc-950/40 text-zinc-400 hover:border-white/20 hover:text-zinc-100',
                              )}
                            >
                              <span className={cn(displayMode === 'wide' && 'scale-90')}>
                                <LibraryStatusIcon status={value} />
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                  {actionsOpen ? actionsToggle : null}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
      {listQuery.data ? (
        <Pager
          page={listQuery.data.page}
          hasNext={listQuery.data.has_next_page}
          totalCount={listQuery.data.total_count}
          totalPages={listQuery.data.total_pages}
          onPage={setPage}
        />
      ) : null}
      {watchSelection ? (
        <WatchLinksDialog
          anilistId={watchSelection.anilistId}
          title={watchSelection.title}
          episode={watchSelection.episode}
          onClose={() => setWatchSelection(null)}
        />
      ) : null}
    </section>
  )
}
