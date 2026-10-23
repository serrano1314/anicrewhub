import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { discoverAnime, searchAnime } from '../api/anime'
import { ApiError } from '../api/client'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, ErrorPanel, LoadingIndicator } from '../components/PageStatus'
import { ScrollingTitle } from '../components/ScrollingTitle'
import { displayTitle, metaLine } from '../lib/display'
import { episodeCountLabel } from '../lib/episodes'
import { backFromSearch } from '../lib/navigation'
import { UI, cn } from '../lib/ui'
import type { Anime } from '../types/anime'

const SEARCH_INPUT_STORAGE_KEY = 'anime-finder-search-input'

function getSavedSearchInput(): string {
  try {
    return window.sessionStorage.getItem(SEARCH_INPUT_STORAGE_KEY) ?? ''
  } catch (error) {
    console.warn('Unable to load the saved anime search.', error)
    return ''
  }
}

export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const query = params.get('q')?.trim() ?? ''
  const [input, setInput] = useState(() => query || getSavedSearchInput())
  const previousQueryRef = useRef(query)
  const [recommendationKind, setRecommendationKind] = useState<'trending' | 'latest'>('trending')
  const loadMoreRef = useRef<HTMLDivElement>(null)

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
    }, 1000)
    return () => clearTimeout(timer)
  }, [input, setParams])

  const searchQuery = useInfiniteQuery({
    queryKey: ['search', query],
    queryFn: ({ pageParam }) => searchAnime(query, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.has_next_page ? lastPage.page + 1 : undefined),
    enabled: query.length > 0,
  })
  const recommendationsQuery = useQuery({
    queryKey: ['anime-discover', recommendationKind],
    queryFn: () => discoverAnime(recommendationKind),
    staleTime: 10 * 60 * 1000,
  })
  useEffect(() => {
    const sentinel = loadMoreRef.current
    if (!sentinel || !searchQuery.hasNextPage || searchQuery.isFetchingNextPage) {
      return
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        void searchQuery.fetchNextPage()
      }
    }, { rootMargin: '480px 0px' })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [searchQuery.fetchNextPage, searchQuery.hasNextPage, searchQuery.isFetchingNextPage])

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = input.trim()
    const updated = new URLSearchParams()
    if (next) {
      updated.set('q', next)
    }
    setParams(updated)
  }

  function renderAnimeCard(anime: Anime, rank?: number) {
    const title = displayTitle(anime)
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
          </div>
        </div>
      </li>
    )
  }

  return (
    <section className={UI.page}>
      <PageHeader eyebrow="Search" title="Anime Finder" description="Find anime for your collection." />
      <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
        <label className="relative flex min-w-0 flex-1 items-center">
          <span className="sr-only">Search anime</span>
          <svg
            viewBox="0 0 20 20"
            aria-hidden="true"
            className="pointer-events-none absolute left-4 z-10 size-5 text-zinc-400"
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
            className={cn(UI.input, 'relative z-0 h-12 rounded-full pl-12 pr-12')}
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
              className="absolute right-2 z-10 inline-flex size-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100"
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
          {(searchQuery.data?.pages[0]?.results.length ?? 0) === 0 ? (
            <EmptyState>No matches for “{query}”. Try another title or spelling.</EmptyState>
          ) : null}
          <ul className="search-results grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {searchQuery.data?.pages.flatMap((page) => page.results).map((anime) => renderAnimeCard(anime))}
          </ul>
          {searchQuery.hasNextPage ? (
            <div ref={loadMoreRef} className="flex justify-center py-4" aria-live="polite">
              {searchQuery.isFetchingNextPage ? <LoadingIndicator label="Loading more anime…" /> : null}
            </div>
          ) : searchQuery.data && searchQuery.data.pages.some((page) => page.results.length > 0) ? (
            <p className="py-4 text-center text-sm text-zinc-500" role="status">No more anime.</p>
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
