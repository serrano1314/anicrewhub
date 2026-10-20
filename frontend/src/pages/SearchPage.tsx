import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'
import { discoverAnime, searchAnime } from '../api/anime'
import { ApiError } from '../api/client'
import { addToLibrary } from '../api/library'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, ErrorPanel, LoadingIndicator } from '../components/PageStatus'
import { Pager } from '../components/Pager'
import { ScrollingTitle } from '../components/ScrollingTitle'
import { displayTitle, metaLine } from '../lib/display'
import { episodeCountLabel } from '../lib/episodes'
import { backFromSearch } from '../lib/navigation'
import { UI, cn } from '../lib/ui'
import type { Anime } from '../types/anime'
import type { LibraryStatus } from '../types/library'

const SAVE_STATUSES: { id: LibraryStatus; label: string }[] = [
  { id: 'watching', label: 'Watching' },
  { id: 'completed', label: 'Completed' },
  { id: 'plan_to_watch', label: 'Plan to watch' },
  { id: 'on_hold', label: 'On hold' },
  { id: 'dropped', label: 'Dropped' },
]

const SEARCH_INPUT_STORAGE_KEY = 'anime-finder-search-input'

function StatusIcon({ status }: { status: LibraryStatus }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4">
      {status === 'watching' ? (
        <path fill="currentColor" d="M10 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17ZM8 6l6 4-6 4z" />
      ) : status === 'completed' ? (
        <path fill="currentColor" d="M10 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Zm-1.1 12.2-3-3 1.4-1.4 1.6 1.6 3.8-4 1.5 1.4z" />
      ) : status === 'plan_to_watch' ? (
        <path fill="currentColor" d="M4 2.5h12a1 1 0 0 1 1 1v14l-7-3.7-7 3.7v-14a1 1 0 0 1 1-1Zm1 2v9.7l5-2.6 5 2.6V4.5z" />
      ) : status === 'on_hold' ? (
        <path fill="currentColor" d="M10 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17ZM7 6h2.5v8H7zm4.5 0H14v8h-2.5z" />
      ) : (
        <path fill="currentColor" d="M10 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Zm3.4 10.5-1.4 1.4-2-2-2 2-1.4-1.4 2-2-2-2 1.4-1.4 2 2 2-2 1.4 1.4-2 2z" />
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

function getSavedSearchInput(): string {
  try {
    return window.sessionStorage.getItem(SEARCH_INPUT_STORAGE_KEY) ?? ''
  } catch (error) {
    console.warn('Unable to load the saved anime search.', error)
    return ''
  }
}

export function SearchPage() {
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const query = params.get('q')?.trim() ?? ''
  const page = parsePage(params.get('page'))
  const [input, setInput] = useState(() => query || getSavedSearchInput())
  const previousQueryRef = useRef(query)
  const [recommendationKind, setRecommendationKind] = useState<'trending' | 'latest'>('trending')
  const addButtonRef = useRef<HTMLButtonElement>(null)
  const statusMenuRef = useRef<HTMLDivElement>(null)
  const [statusMenuPosition, setStatusMenuPosition] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    try {
      if (input) {
        window.sessionStorage.setItem(SEARCH_INPUT_STORAGE_KEY, input)
      } else {
        window.sessionStorage.removeItem(SEARCH_INPUT_STORAGE_KEY)
      }
    } catch (error) {
      console.warn('Unable to save the anime search.', error)
    }
  }, [input])

  useEffect(() => {
    if (previousQueryRef.current !== query) {
      previousQueryRef.current = query
      setInput(query)
    }
  }, [query])

  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = input.trim()
      setParams((current) => {
        if ((current.get('q')?.trim() ?? '') === trimmed) {
          return current
        }
        const updated = new URLSearchParams()
        if (trimmed) updated.set('q', trimmed)
        return updated
      })
    }, 300)
    return () => clearTimeout(timer)
  }, [input, setParams])

  const [openStatusId, setOpenStatusId] = useState<number | null>(null)
  const [addedIds, setAddedIds] = useState<number[]>([])

  useEffect(() => {
    if (openStatusId == null) {
      return
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (addButtonRef.current?.contains(target) || statusMenuRef.current?.contains(target)) return
      setOpenStatusId(null)
    }
    const closeMenuOnScroll = () => setOpenStatusId(null)
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('scroll', closeMenuOnScroll, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('scroll', closeMenuOnScroll, true)
    }
  }, [openStatusId])

  const searchQuery = useQuery({
    queryKey: ['search', query, page],
    queryFn: () => searchAnime(query, page),
    enabled: query.length > 0,
  })
  const recommendationsQuery = useQuery({
    queryKey: ['anime-discover', recommendationKind],
    queryFn: () => discoverAnime(recommendationKind),
    staleTime: 10 * 60 * 1000,
  })

  const addMutation = useMutation({
    mutationFn: (input: { anilistId: number; status: LibraryStatus }) =>
      addToLibrary(input.anilistId, input.status),
    onSuccess: async (entry) => {
      setOpenStatusId(null)
      setAddedIds((current) =>
        current.includes(entry.anilist_id) ? current : [...current, entry.anilist_id],
      )
      await queryClient.invalidateQueries({ queryKey: ['library'] })
      await queryClient.invalidateQueries({ queryKey: ['library-entry', entry.anilist_id] })
      await queryClient.invalidateQueries({ queryKey: ['episodes', entry.anilist_id] })
    },
  })

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = input.trim()
    const updated = new URLSearchParams()
    if (next) {
      updated.set('q', next)
    }
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

  function toggleStatusMenu(anilistId: number, button: HTMLButtonElement) {
    if (openStatusId === anilistId) {
      setOpenStatusId(null)
      setStatusMenuPosition(null)
      return
    }
    const rect = button.getBoundingClientRect()
    const menuHeight = Math.min(5 * 36 + 4 * 4 + 12, window.innerHeight - 16)
    setStatusMenuPosition({
      top: Math.min(rect.bottom + 2, window.innerHeight - menuHeight - 8),
      left: Math.max(8, Math.min(rect.right - 44, window.innerWidth - 52)),
    })
    setOpenStatusId(anilistId)
  }

  const addingId = addMutation.isPending ? addMutation.variables?.anilistId : undefined
  const failedId =
    addMutation.isError && addMutation.variables != null
      ? addMutation.variables.anilistId
      : undefined
  const addError =
    addMutation.error instanceof ApiError
      ? addMutation.error.message
      : addMutation.error
        ? 'Could not add that anime'
        : null

  function renderAnimeCard(anime: Anime, rank?: number) {
    const title = displayTitle(anime)
    const added = addedIds.includes(anime.anilist_id)
    const pending = addingId === anime.anilist_id
    const statusMenuOpen = openStatusId === anime.anilist_id
    const animeHref = `/anime/${anime.anilist_id}`
    const animeState = { back: backFromSearch(params) }

    return (
      <li
        key={anime.anilist_id}
        className="search-results-card group relative flex min-h-44 flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/60 p-3 pb-2 shadow-lg shadow-black/25 transition duration-200 hover:-translate-y-0.5 hover:border-indigo-300/25 hover:bg-zinc-900/80 sm:p-4 sm:pb-2.5"
      >
        {anime.cover_url ? (
          <img
            src={anime.cover_url}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 h-full w-full scale-105 object-cover opacity-45 saturate-150 blur-[2px] transition-opacity duration-300 group-hover:opacity-60"
          />
        ) : null}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-br from-zinc-950/80 via-zinc-950/55 to-zinc-950/80" />
        <div className="relative z-10 flex min-w-0 flex-1 gap-3">
          <Link
            to={animeHref}
            state={animeState}
            aria-label={`View ${title}`}
            className="relative h-28 w-[4.65rem] shrink-0 overflow-hidden rounded-lg ring-1 ring-white/10 sm:h-32 sm:w-[5.33rem]"
          >
            {anime.cover_url ? (
              <img src={anime.cover_url} alt="" loading="lazy" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full items-center justify-center bg-zinc-800 text-zinc-500" aria-hidden="true">
                <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5zM4 5.5v16M8 7h8M8 10h6" />
                </svg>
              </span>
            )}
            {rank !== undefined ? (
              <span className="absolute left-1 top-1 rounded-full border border-white/20 bg-zinc-950/75 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                #{rank}
              </span>
            ) : null}
          </Link>
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
            <Link to={animeHref} state={animeState} className="min-w-0">
              <ScrollingTitle
                title={title}
                className="text-sm leading-snug text-zinc-100 transition-colors group-hover:text-white"
              />
              {anime.title_english && anime.title_romaji !== title ? (
                <p className="truncate text-xs text-zinc-500">{anime.title_romaji}</p>
              ) : null}
              <p className="truncate text-xs text-zinc-500">
                {[metaLine(anime.format, anime.season_year, anime.airing_status), anime.total_episodes == null ? null : episodeCountLabel(anime.total_episodes)]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </Link>
            <div className="flex items-center gap-1 text-xs text-amber-300">
              {anime.average_score != null ? (
                <>
                  <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4 fill-current">
                    <path d="m10 1.5 2.6 5.3 5.9.9-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.9z" />
                  </svg>
                  <span>{anime.average_score}%</span>
                </>
              ) : null}
            </div>
            <div className="flex items-center justify-end">
              {added ? (
                <Link
                  to={animeHref}
                  state={animeState}
                  aria-label={`${title} is in your collection`}
                  title="In your collection"
                  className="inline-flex size-9 items-center justify-center rounded-full border border-emerald-300/25 bg-emerald-400/10 text-emerald-200 transition hover:bg-emerald-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200/60"
                >
                  <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m4 10 4 4 8-8" />
                  </svg>
                </Link>
              ) : (
                <button
                  ref={statusMenuOpen ? addButtonRef : undefined}
                  type="button"
                  disabled={pending}
                  aria-label={statusMenuOpen ? `Close add options for ${title}` : `Add ${title} to collection`}
                  aria-expanded={statusMenuOpen}
                  aria-controls={`search-status-${anime.anilist_id}`}
                  onClick={(event) => toggleStatusMenu(anime.anilist_id, event.currentTarget)}
                  title={pending ? 'Adding to collection' : 'Add to collection'}
                  className="inline-flex size-9 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white shadow-lg shadow-black/20 backdrop-blur-xl backdrop-saturate-150 transition hover:border-white/40 hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/70 disabled:opacity-60"
                >
                  {pending ? (
                    <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-indigo-100/30 border-t-indigo-100" />
                  ) : (
                    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M10 4v12M4 10h12" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
        {statusMenuOpen && statusMenuPosition
          ? createPortal(
              <div
                ref={statusMenuRef}
                id={`search-status-${anime.anilist_id}`}
                className="spotlight-status-menu fixed z-[90] flex max-h-[calc(100dvh-1rem)] flex-col gap-1 overflow-y-auto rounded-full border border-white/20 bg-white/15 p-1.5 shadow-xl shadow-black/40 ring-1 ring-white/15 backdrop-blur-2xl backdrop-saturate-150"
                style={statusMenuPosition}
                role="group"
                aria-label={`Choose status for ${title}`}
              >
                {SAVE_STATUSES.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    disabled={pending}
                    aria-label={`Add ${title} as ${option.label}`}
                    title={option.label}
                    onClick={() => addMutation.mutate({ anilistId: anime.anilist_id, status: option.id })}
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-zinc-100 transition-all hover:border-white/25 hover:bg-white/20 hover:text-white disabled:opacity-50"
                  >
                    <StatusIcon status={option.id} />
                  </button>
                ))}
              </div>,
              document.body,
            )
          : null}
        {failedId === anime.anilist_id && addError ? (
          <p className="mt-2 text-xs text-rose-300" role="status">{addError}</p>
        ) : null}
      </li>
    )
  }

  return (
    <section className={UI.page}>
      <PageHeader title="Anime Finder" description="Find anime for your collection." />
      <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
        <label className="relative flex min-w-0 flex-1 items-center">
          <span className="sr-only">Search anime</span>
          <svg
            viewBox="0 0 20 20"
            aria-hidden="true"
            className="pointer-events-none absolute left-4 size-5 text-zinc-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          >
            <circle cx="8.5" cy="8.5" r="5.5" />
            <path d="m12.5 12.5 4 4" strokeLinecap="round" />
          </svg>
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Search anime titles…"
            aria-label="Search anime titles"
            className={cn(UI.input, 'h-12 rounded-full pl-12 pr-12')}
          />
          {input ? (
            <button
              type="button"
              aria-label="Clear search"
              title="Clear search"
              onClick={() => {
                setInput('')
                setParams(new URLSearchParams())
              }}
              className="absolute right-2 inline-flex size-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="m5 5 10 10M15 5 5 15" />
              </svg>
            </button>
          ) : null}
        </label>
        {/* <button
            type="submit"
            aria-label="Search anime"
            title="Search"
            className="inline-flex size-12 shrink-0 items-center justify-center self-end rounded-full border border-indigo-300/30 bg-indigo-500/20 text-indigo-100 shadow-lg shadow-indigo-950/30 transition hover:border-indigo-200/50 hover:bg-indigo-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200/60 sm:self-auto"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7">
              <circle cx="8.5" cy="8.5" r="5.5" />
              <path d="m12.5 12.5 4 4" strokeLinecap="round" />
            </svg>
          </button> */}
      </form>
      {query ? (
        <>
          {searchQuery.isPending ? <LoadingIndicator label="Searching…" /> : null}
          {searchQuery.isError ? (
            <ErrorPanel
              message={
                searchQuery.error instanceof ApiError ? searchQuery.error.message : 'Search failed'
              }
              onRetry={() => {
                void searchQuery.refetch()
              }}
            />
          ) : null}
          {searchQuery.data && searchQuery.data.results.length === 0 ? (
            <EmptyState>No matches for “{query}”. Try another title or spelling.</EmptyState>
          ) : null}
          <ul className="search-results grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {searchQuery.data?.results.map((anime) => renderAnimeCard(anime))}
          </ul>
          {searchQuery.data ? (
            <Pager
              page={searchQuery.data.page}
              hasNext={searchQuery.data.has_next_page}
              onPage={setPage}
            />
          ) : null}
        </>
      ) : (
        <section className="space-y-4" aria-labelledby="recommendations-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="recommendations-title" className="text-lg font-semibold tracking-tight text-zinc-100">
                {recommendationKind === 'trending' ? 'Trending picks' : 'New this season'}
              </h2>
              <p className="mt-0.5 text-xs text-zinc-500">Recommendations to get you started</p>
            </div>
            <div className="flex rounded-full border border-white/10 bg-zinc-950/40 p-1" role="group" aria-label="Recommendation category">
              {(['trending', 'latest'] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  aria-pressed={recommendationKind === kind}
                  onClick={() => setRecommendationKind(kind)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs transition-colors',
                    recommendationKind === kind ? 'bg-indigo-500/20 text-indigo-100' : 'text-zinc-400 hover:text-zinc-100',
                  )}
                >
                  {kind === 'trending' ? 'Trending' : 'Latest'}
                </button>
              ))}
            </div>
          </div>
          {recommendationsQuery.isPending ? (
            <ul aria-hidden="true" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {Array.from({ length: 6 }, (_, index) => (
                <li key={index} className="flex h-40 animate-pulse gap-3 rounded-2xl border border-white/10 bg-zinc-900/50 p-3">
                  <span className="h-full w-[5.5rem] shrink-0 rounded-xl bg-white/[0.06]" />
                  <span className="flex-1 space-y-3 py-2">
                    <span className="block h-4 w-4/5 rounded bg-white/[0.08]" />
                    <span className="block h-3 w-3/5 rounded bg-white/[0.05]" />
                    <span className="block h-8 w-8 rounded-full bg-white/[0.06]" />
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {recommendationsQuery.isError ? (
            <ErrorPanel
              message="Recommendations are temporarily unavailable."
              onRetry={() => void recommendationsQuery.refetch()}
            />
          ) : null}
          {recommendationsQuery.data ? (
            <ul className="search-results grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {recommendationsQuery.data.results.slice(0, 12).map((anime, index) =>
                renderAnimeCard(anime, index + 1),
              )}
            </ul>
          ) : null}
          {recommendationsQuery.data?.results.length === 0 ? (
            <EmptyState>No recommendations are available right now.</EmptyState>
          ) : null}
        </section>
      )}
    </section>
  )
}
