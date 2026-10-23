import { useEffect, useRef, useState } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import { fetchLibrary, setEpisodeWatched, updateLibrary } from '../api/library'
import { EmptyState, ErrorPanel } from '../components/PageStatus'
import { AnimeSpotlightCarousel } from '../components/AnimeSpotlightCarousel'
import { ProgressMeter } from '../components/ProgressMeter'
import { StarRating } from '../components/StarRating'
import { ScrollingTitle } from '../components/ScrollingTitle'
import { WatchLinksDialog } from '../components/WatchLinksDialog'
import { displayTitle, metaLine } from '../lib/display'
import { nextEpisodeToMark } from '../lib/episodes'
import { PageHeader } from '../components/PageHeader'
import { backFromLibrary } from '../lib/navigation'
import { UI, cn } from '../lib/ui'
import { useToast } from '../components/toastContext'
import {
  STATUS_LABELS,
  isLibraryStatus,
  type LibraryEntry,
  type LibraryListResponse,
  type LibrarySort,
  type LibrarySummary,
  type LibraryStatus,
  type WatchedEpisodes,
} from '../types/library'

type DisplayMode = 'compact' | 'normal' | 'wide'
type LibraryInfiniteData = {
  pages: LibraryListResponse[]
  pageParams: unknown[]
}

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

const TABS: {
  id: string
  label: string
  status?: LibraryStatus
  favorites?: boolean
}[] = [
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
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5">
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

function DisplayModeIcon({ mode }: { mode: DisplayMode }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4">
      {mode === 'compact' ? (
        <>
          <rect x="2" y="2" width="6" height="7" rx="1" fill="currentColor" />
          <rect x="9" y="2" width="6" height="7" rx="1" fill="currentColor" />
          <rect x="2" y="11" width="6" height="7" rx="1" fill="currentColor" />
          <rect x="9" y="11" width="6" height="7" rx="1" fill="currentColor" />
          <rect x="16" y="2" width="2" height="16" rx="1" fill="currentColor" opacity=".55" />
        </>
      ) : mode === 'normal' ? (
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
  )
}

export function LibraryPage() {
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const statusParam = params.get('status')
  const status = statusParam && isLibraryStatus(statusParam) ? statusParam : undefined
  const favorites = params.get('favorites') === 'true'
  const sortParam = params.get('sort')
  const sort = isLibrarySort(sortParam) ? sortParam : 'updated'
  const activeTab = favorites ? 'favorites' : status ?? 'all'
  const [searchInput, setSearchInput] = useState(params.get('q') ?? '')
  const [searchOpen, setSearchOpen] = useState(Boolean(params.get('q')))
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const sortMenuRef = useRef<HTMLDivElement>(null)
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false)
  const layoutMenuRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<HTMLUListElement>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const [displayMode, setDisplayModeValue] = useState<DisplayMode>(getSavedDisplayMode)
  const [collectionSummary, setCollectionSummary] = useState<LibrarySummary | null>(null)
  const [openActionsId, setOpenActionsId] = useState<number | null>(null)
  const [watchSelection, setWatchSelection] = useState<{
    anilistId: number
    title: string
    episode: number
  } | null>(null)

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus({ preventScroll: true })
    }
  }, [searchOpen])

  useEffect(() => {
    if (!sortMenuOpen) return
    function closeOnOutsideClick(event: MouseEvent) {
      if (!sortMenuRef.current?.contains(event.target as Node)) {
        setSortMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [sortMenuOpen])

  useEffect(() => {
    if (!layoutMenuOpen) return
    function closeOnOutsideClick(event: MouseEvent) {
      if (!layoutMenuRef.current?.contains(event.target as Node)) {
        setLayoutMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [layoutMenuOpen])

  useEffect(() => {
    if (openActionsId === null) return
    function closeOnOutsideClick(event: PointerEvent) {
      const clickedCard =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>('[data-library-card-id]')
          : null
      if (clickedCard?.dataset.libraryCardId !== String(openActionsId)) {
        setOpenActionsId(null)
      }
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [openActionsId])

  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = searchInput.trim()
      const updated = new URLSearchParams(params)
      if (trimmed) {
        updated.set('q', trimmed)
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
  const listQuery = useInfiniteQuery({
    queryKey: ['library', status ?? 'all', favorites, query, sort],
    queryFn: ({ pageParam }) => fetchLibrary(status, pageParam, query, favorites, sort),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset ?? undefined,
  })

  useEffect(() => {
    const summary = listQuery.data?.pages[0]?.summary
    if (summary) {
      setCollectionSummary(summary)
    }
  }, [listQuery.data?.pages])

  useEffect(() => {
    const sentinel = loadMoreRef.current
    if (!sentinel || !listQuery.hasNextPage) {
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !listQuery.isFetchingNextPage) {
          void listQuery.fetchNextPage()
        }
      },
      { rootMargin: '480px 0px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [listQuery.fetchNextPage, listQuery.hasNextPage, listQuery.isFetchingNextPage])

  const episodeMutation = useMutation({
    mutationFn: (input: { anilistId: number; episode: number; watched: boolean }) =>
      setEpisodeWatched(input.anilistId, input.episode, input.watched),
    onSuccess: (_data, input) => {
      showToast(input.watched ? `Episode ${input.episode} marked watched` : `Episode ${input.episode} removed`)
    },
    onMutate: async ({ anilistId, episode, watched }) => {
      await queryClient.cancelQueries({ queryKey: ['library'] })
      await queryClient.cancelQueries({ queryKey: ['episodes', anilistId] })
      await queryClient.cancelQueries({ queryKey: ['library-entry', anilistId] })
      const previousLibrary = queryClient.getQueriesData<LibraryInfiniteData>({ queryKey: ['library'] })
      const previousEpisodes = queryClient.getQueryData<WatchedEpisodes>(['episodes', anilistId])
      const previousEntry = queryClient.getQueryData<LibraryEntry>(['library-entry', anilistId])
      const updateProgress = (entry: LibraryEntry) => ({
        ...entry,
        watched_count: Math.max(0, entry.watched_count + (watched ? 1 : -1)),
        last_episode_watched: watched ? episode : Math.max(0, episode - 1),
      })

      queryClient.setQueriesData<LibraryInfiniteData>({ queryKey: ['library'] }, (current) =>
        current
          ? {
              ...current,
              pages: current.pages.map((page) => ({
                ...page,
                items: page.items.map((entry) =>
                  entry.anilist_id === anilistId ? updateProgress(entry) : entry,
                ),
              })),
            }
          : current,
      )
      if (previousEpisodes) {
        const episodes = new Set(previousEpisodes.episodes)
        if (watched) {
          episodes.add(episode)
        } else {
          episodes.delete(episode)
        }
        queryClient.setQueryData<WatchedEpisodes>(['episodes', anilistId], {
          ...previousEpisodes,
          episodes: [...episodes].sort((left, right) => left - right),
        })
      }
      if (previousEntry) {
        queryClient.setQueryData<LibraryEntry>(['library-entry', anilistId], updateProgress(previousEntry))
      }
      return { previousLibrary, previousEpisodes, previousEntry }
    },
    onError: (_error, { anilistId }, context) => {
      context?.previousLibrary.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data)
      })
      if (context?.previousEpisodes) {
        queryClient.setQueryData(['episodes', anilistId], context.previousEpisodes)
      }
      if (context?.previousEntry) {
        queryClient.setQueryData(['library-entry', anilistId], context.previousEntry)
      }
    },
    onSettled: async (_data, _error, { anilistId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['library'] }),
        queryClient.invalidateQueries({ queryKey: ['episodes', anilistId] }),
        queryClient.invalidateQueries({ queryKey: ['library-entry', anilistId] }),
      ])
    },
  })

  const updateMutation = useMutation({
    mutationFn: (input: {
      anilistId: number
      changes: { status?: LibraryStatus; score?: number | null; is_favorite?: boolean }
    }) => updateLibrary(input.anilistId, input.changes),
    onSuccess: (_entry, { changes }) => {
      if (changes.is_favorite !== undefined) {
        showToast(changes.is_favorite ? 'Added to favorites' : 'Removed from favorites')
      } else if (changes.score !== undefined) {
        showToast(changes.score === null ? 'Rating cleared' : 'Rating updated')
      } else if (changes.status !== undefined) {
        showToast(`Status changed to ${STATUS_LABELS[changes.status]}`)
      }
    },
    onMutate: async ({ anilistId, changes }) => {
      await queryClient.cancelQueries({ queryKey: ['library'] })
      await queryClient.cancelQueries({ queryKey: ['library-entry', anilistId] })
      const previousLibrary = queryClient.getQueriesData<LibraryInfiniteData>({ queryKey: ['library'] })
      const previousEntry = queryClient.getQueryData<LibraryEntry>(['library-entry', anilistId])

      queryClient.setQueriesData<LibraryInfiniteData>({ queryKey: ['library'] }, (current) => {
        if (!current) {
          return current
        }
        return {
          ...current,
          pages: current.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
              item.anilist_id === anilistId ? { ...item, ...changes } : item,
            ),
            summary:
              changes.is_favorite === undefined
                ? page.summary
                : {
                    ...page.summary,
                    favorites: page.summary.favorites + (changes.is_favorite ? 1 : -1),
                  },
          })),
        }
      })
      if (previousEntry) {
        queryClient.setQueryData<LibraryEntry>(['library-entry', anilistId], {
          ...previousEntry,
          ...changes,
        })
      }
      return { previousLibrary, previousEntry }
    },
    onError: (_error, { anilistId }, context) => {
      context?.previousLibrary.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data)
      })
      if (context?.previousEntry) {
        queryClient.setQueryData(['library-entry', anilistId], context.previousEntry)
      }
    },
    onSettled: async (_entry, _error, input) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['library'] }),
        queryClient.invalidateQueries({ queryKey: ['library-entry', input.anilistId] }),
      ])
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
      <AnimeSpotlightCarousel />
      <PageHeader eyebrow="Collection" title="My Collection" description="Track progress and jump back into any show." />
      {collectionSummary ? (
        <div
          className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"
          aria-label="Collection overview"
        >
          {[
            { label: 'Saved', value: collectionSummary.total, tone: 'text-zinc-100' },
            { label: 'Watching', value: collectionSummary.watching, tone: 'text-indigo-200' },
            { label: 'Completed', value: collectionSummary.completed, tone: 'text-emerald-200' },
            { label: 'Plan to watch', value: collectionSummary.plan_to_watch, tone: 'text-sky-200' },
            { label: 'Favorites', value: collectionSummary.favorites, tone: 'text-rose-200' },
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
              className={cn(
                UI.pill,
                'inline-flex shrink-0 items-center justify-center whitespace-nowrap',
                selected
                  ? 'h-10 gap-2 px-3.5 py-2.5'
                  : 'size-10 !p-0',
                selected && UI.pillActive,
              )}
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
              <span
                aria-hidden={!selected}
                className={cn(
                  'grid transition-[grid-template-columns] duration-200 ease-out motion-reduce:transition-none',
                  selected ? 'grid-cols-[1fr]' : 'grid-cols-[0fr]',
                )}
              >
                <span
                  className={cn(
                    'min-w-0 overflow-hidden whitespace-nowrap transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none',
                    selected ? 'translate-x-0 opacity-100' : '-translate-x-1 opacity-0',
                  )}
                >
                  {tab.label}
                </span>
              </span>
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
      <div className="flex w-full items-center gap-3">
        <div
          className={cn(
            'relative h-10 min-w-0 transition-[flex-grow] duration-300 ease-out',
            searchOpen ? 'flex-[1_1_2.5rem]' : 'flex-[0_1_2.5rem]',
          )}
        >
          {searchOpen ? (
            <>
              <input
                ref={searchInputRef}
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    setSearchOpen(false)
                  }
                }}
                placeholder="Search your saved anime…"
                className={cn(UI.input, 'h-10 w-1/2 rounded-full pl-4 pr-12')}
                aria-label="Search your saved anime"
              />
              <button
                type="button"
                aria-label="Clear and close search"
                title="Clear and close search"
                onClick={() => {
                  setSearchInput('')
                  setSearchOpen(false)
                }}
                className="absolute left top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-white/10 hover:text-zinc-100"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4">
                  <path d="m5 5 10 10M15 5 5 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </>
          ) : (
            <button
              type="button"
              aria-label="Search your saved anime"
              title="Search your saved anime"
              onClick={() => setSearchOpen(true)}
              className="inline-flex size-10 items-center justify-center rounded-full border border-white/10 bg-zinc-900/50 text-zinc-400 transition hover:border-indigo-300/30 hover:bg-indigo-500/10 hover:text-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/60"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7">
                <circle cx="8.5" cy="8.5" r="5.5" />
                <path d="m12.5 12.5 4 4" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
        <div className="ml-auto flex shrink-0 items-center justify-end gap-2">
          <div ref={sortMenuRef} className="relative">
            <button
              type="button"
              aria-label={`Sort collection: ${SORT_OPTIONS.find((option) => option.value === sort)?.label ?? 'Recently updated'}`}
              title="Sort collection"
              aria-haspopup="listbox"
              aria-expanded={sortMenuOpen}
              onClick={() => setSortMenuOpen((open) => !open)}
              className={cn(
                'inline-flex size-10 items-center justify-center rounded-full border bg-zinc-900/60 text-zinc-300 transition hover:border-indigo-300/30 hover:bg-indigo-500/10 hover:text-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/60',
                sortMenuOpen ? 'border-indigo-300/40 text-indigo-100' : 'border-white/10',
              )}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                <path d="M4 7h10M18 7h2M4 17h2m4 0h10" />
                <circle cx="16" cy="7" r="2" fill="currentColor" stroke="none" />
                <circle cx="8" cy="17" r="2" fill="currentColor" stroke="none" />
              </svg>
            </button>
            {sortMenuOpen ? (
              <div
                role="listbox"
                aria-label="Sort collection"
                className="absolute right-0 top-full z-[60] mt-2 w-52 rounded-xl border border-white/10 bg-zinc-900/95 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl"
              >
                {SORT_OPTIONS.map((option) => {
                  const selected = option.value === sort
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        setSort(option.value)
                        setSortMenuOpen(false)
                      }}
                      className={cn(
                        'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-white/5',
                        selected ? 'bg-indigo-500/15 text-indigo-100' : 'text-zinc-300',
                      )}
                    >
                      {option.label}
                      {selected ? <span aria-hidden="true" className="text-indigo-300">✓</span> : null}
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>
          <div
            ref={layoutMenuRef}
            role="group"
            aria-label="Card display size"
            onKeyDown={(event) => {
              if (event.key === 'Escape') setLayoutMenuOpen(false)
            }}
            className={cn(
              'group relative hidden h-10 items-center justify-center overflow-hidden rounded-full border bg-zinc-900/60 text-zinc-300 transition-[width,background-color,border-color] duration-200 hover:border-indigo-300/30 hover:bg-indigo-500/10 hover:text-indigo-100 focus-within:border-indigo-300/40 focus-within:bg-indigo-500/10 lg:flex',
              layoutMenuOpen ? 'w-[104px] border-indigo-300/40' : 'w-10 border-white/10 hover:w-[104px] focus-within:w-[104px]',
            )}
          >
            <button
              type="button"
              aria-label={`Card layout: ${DISPLAY_MODES.find((mode) => mode.id === displayMode)?.label ?? 'Normal'}. Open layout choices`}
              title="Card layout"
              aria-haspopup="true"
              aria-expanded={layoutMenuOpen}
              onClick={() => setLayoutMenuOpen((open) => !open)}
              className="inline-flex size-10 shrink-0 items-center justify-center group-hover:hidden group-focus-within:hidden"
            >
              <DisplayModeIcon mode={displayMode} />
            </button>
            {DISPLAY_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                aria-label={`${mode.label} card layout`}
                title={`${mode.label} card layout`}
                aria-pressed={displayMode === mode.id}
                onClick={() => {
                  setDisplayMode(mode.id)
                  setLayoutMenuOpen(false)
                }}
                className={cn(
                  'hidden size-8 shrink-0 items-center justify-center rounded-full transition-colors group-hover:inline-flex group-focus-within:inline-flex',
                  displayMode === mode.id ? 'bg-indigo-500/20 text-indigo-100' : 'text-zinc-400 hover:text-zinc-100',
                )}
              >
                <DisplayModeIcon mode={mode.id} />
              </button>
            ))}
          </div>
        </div>
      </div>
      {listQuery.data && listQuery.data.pages[0]?.items.length === 0 ? (
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
      {listQuery.isPending ? (
        <div className="sr-only" role="status" aria-live="polite">
          Loading your list…
        </div>
      ) : null}
      <ul
        ref={cardsRef}
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
          : listQuery.data?.pages.flatMap((page) => page.items).map((entry) => {
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
              data-library-card-id={entry.anilist_id}
              className={cn(
                UI.cardInteractive,
                'search-results-card group relative flex flex-col overflow-hidden',
                entry.is_favorite &&
                  'library-favorite-card border-rose-300/25 hover:border-rose-300/40',
                displayMode === 'compact' ? 'p-3 sm:p-3' : 'p-4 sm:p-5',
                displayMode === 'wide' && 'sm:grid sm:grid-cols-[minmax(0,1fr)_9rem] sm:items-center sm:gap-x-5',
              )}
            >
              {entry.banner_url || entry.cover_url ? (
                <img
                  src={entry.banner_url || entry.cover_url || undefined}
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
                              'Watched'
                            ) : (
                              <>
                                <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 shrink-0">
                                  <path
                                    fill="currentColor"
                                    d="M10 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Zm-1.1 12.2-3-3 1.4-1.4 1.6 1.6 3.8-4 1.5 1.4z"
                                  />
                                </svg>
                                <span className="truncate">{"E. "+next}</span>
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
                                'flex items-center justify-center transition-colors disabled:opacity-50',
                                displayMode === 'wide'
                                  ? 'h-10 w-10 p-1'
                                  : 'aspect-square w-full p-1.5',
                                selected
                                  ? 'text-indigo-200 drop-shadow-[0_0_5px_rgba(129,140,248,0.8)]'
                                  : 'text-zinc-400 hover:text-zinc-100',
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
      <div ref={loadMoreRef} className="flex min-h-12 items-center justify-center py-4" aria-live="polite">
        {listQuery.isFetchingNextPage ? (
          <>
            <span
              aria-hidden="true"
              className="size-5 animate-spin rounded-full border-2 border-indigo-200/25 border-t-indigo-200"
            />
            <span className="sr-only">Loading more saved anime…</span>
          </>
        ) : listQuery.data && !listQuery.hasNextPage && listQuery.data.pages[0]?.items.length ? (
          <p className="text-sm text-zinc-500">No more results below.</p>
        ) : null}
      </div>
      {watchSelection ? (
        <WatchLinksDialog
          anilistId={watchSelection.anilistId}
          title={watchSelection.title}
          episode={watchSelection.episode}
          groupedSources
          onClose={() => setWatchSelection(null)}
        />
      ) : null}
    </section>
  )
}
