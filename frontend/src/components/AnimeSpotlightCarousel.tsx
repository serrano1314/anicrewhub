import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { addToLibrary } from '../api/library'
import { discoverAnime } from '../api/anime'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import { displayTitle, metaLine } from '../lib/display'
import { renderAnimeDescription } from '../lib/animeDescription'
import { episodeCountLabel } from '../lib/episodes'
import { UI, cn } from '../lib/ui'
import type { LibraryStatus } from '../types/library'

const CATEGORIES = [
  { id: 'trending', label: 'Trending', description: 'Popular with anime fans right now' },
  { id: 'latest', label: 'Latest', description: 'Currently airing and newly released' },
] as const

type DiscoveryKind = (typeof CATEGORIES)[number]['id']

const SAVE_STATUSES: { id: LibraryStatus; label: string }[] = [
  { id: 'watching', label: 'Watching' },
  { id: 'completed', label: 'Completed' },
  { id: 'plan_to_watch', label: 'Plan to watch' },
  { id: 'on_hold', label: 'On hold' },
  { id: 'dropped', label: 'Dropped' },
]

function StatusIcon({ status }: { status: LibraryStatus }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4 shrink-0">
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

export function AnimeSpotlightCarousel({
  hideUnauthenticatedSave = false,
}: {
  hideUnauthenticatedSave?: boolean
}) {
  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const addButtonRef = useRef<HTMLButtonElement>(null)
  const statusMenuRef = useRef<HTMLDivElement>(null)
  const slideDragRef = useRef<{ pointerId: number; startX: number } | null>(null)
  const wasSlideDraggedRef = useRef(false)
  const titleViewportRef = useRef<HTMLDivElement>(null)
  const titleTextRef = useRef<HTMLHeadingElement>(null)
  const [category, setCategory] = useState<DiscoveryKind>('trending')
  const [activeIndex, setActiveIndex] = useState(0)
  const [showTopTen, setShowTopTen] = useState(false)
  const [isSpotlightHovered, setIsSpotlightHovered] = useState(false)
  const [hasSpotlightFocus, setHasSpotlightFocus] = useState(false)
  const [openStatusId, setOpenStatusId] = useState<number | null>(null)
  const [mountedStatusId, setMountedStatusId] = useState<number | null>(null)
  const [statusMenuPosition, setStatusMenuPosition] = useState<{ top: number; left: number } | null>(null)
  const [addedIds, setAddedIds] = useState<number[]>([])

  const activeCategory = CATEGORIES.find((item) => item.id === category) ?? CATEGORIES[0]
  const discoveryQuery = useQuery({
    queryKey: ['anime-discover', category],
    queryFn: () => discoverAnime(category),
    staleTime: 10 * 60 * 1000,
  })
  const addMutation = useMutation({
    mutationFn: (input: { anilistId: number; status: LibraryStatus }) =>
      addToLibrary(input.anilistId, input.status),
    onSuccess: async (entry) => {
      setAddedIds((current) => current.includes(entry.anilist_id) ? current : [...current, entry.anilist_id])
      setOpenStatusId(null)
      await queryClient.invalidateQueries({ queryKey: ['library'] })
      await queryClient.invalidateQueries({ queryKey: ['library-entry', entry.anilist_id] })
    },
  })

  useEffect(() => {
    if (openStatusId == null) {
      const timeout = window.setTimeout(() => setMountedStatusId(null), 160)
      return () => window.clearTimeout(timeout)
    }
    setMountedStatusId(openStatusId)
  }, [openStatusId])

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

  useEffect(() => {
    if (openStatusId == null) {
      setStatusMenuPosition(null)
      return
    }
    const button = addButtonRef.current
    if (!button) return
    const rect = button.getBoundingClientRect()
    const menuHeight = Math.min(5 * 36 + 4 * 4 + 12, window.innerHeight - 16)
    setStatusMenuPosition({
      top: Math.min(rect.bottom + 2, window.innerHeight - menuHeight - 8),
      left: Math.max(8, Math.min(rect.right - 44, window.innerWidth - 52)),
    })
  }, [openStatusId])

  const failedId =
    addMutation.isError && addMutation.variables != null
      ? addMutation.variables.anilistId
      : undefined
  const addError =
    addMutation.error instanceof ApiError && addMutation.error.status === 409
      ? 'Already in your collection'
      : 'Could not add this anime'
  const animeResults = discoveryQuery.data?.results ?? []
  const topTenResults = animeResults.slice(0, 10)
  const currentAnime = animeResults[activeIndex]
  const currentTitle = currentAnime ? displayTitle(currentAnime) : ''
  const [isTitleOverflowing, setIsTitleOverflowing] = useState(false)

  useEffect(() => {
    const viewport = titleViewportRef.current
    const text = titleTextRef.current
    if (!viewport || !text) return

    const measureTitleOverflow = () => {
      const overflow = Math.max(0, text.scrollWidth - viewport.clientWidth)
      text.style.setProperty('--spotlight-title-distance', `${overflow}px`)
      setIsTitleOverflowing(overflow > 2)
    }

    measureTitleOverflow()
    const observer = new ResizeObserver(measureTitleOverflow)
    observer.observe(viewport)
    observer.observe(text)
    return () => observer.disconnect()
  }, [currentTitle, currentAnime?.anilist_id])

  useEffect(() => {
    if (
      animeResults.length < 2 ||
      showTopTen ||
      openStatusId != null ||
      isSpotlightHovered ||
      hasSpotlightFocus
    ) {
      return
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (reducedMotion.matches) return

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        setActiveIndex((current) => (current + 1) % animeResults.length)
      }
    }, 6000)
    return () => window.clearInterval(interval)
  }, [
    animeResults.length,
    hasSpotlightFocus,
    isSpotlightHovered,
    openStatusId,
    showTopTen,
  ])

  function changeCategory(next: DiscoveryKind) {
    setCategory(next)
    setActiveIndex(0)
    setShowTopTen(false)
    setOpenStatusId(null)
  }

  function changeSlide(next: number) {
    if (animeResults.length === 0) return
    setActiveIndex((next + animeResults.length) % animeResults.length)
    setShowTopTen(false)
    setOpenStatusId(null)
  }

  return (
    <section className="mx-auto w-full max-w-5xl flex-none self-stretch space-y-4" aria-labelledby="anime-spotlight-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={UI.eyebrow}>Discover</p>
          <h2 id="anime-spotlight-title" className={`${UI.pageTitle} mt-1`}>
            Find your next favorite
          </h2>
          <p className={UI.pageLead}>
            {showTopTen
              ? `All ${topTenResults.length} ${category === 'trending' ? 'trending' : 'latest'} picks`
              : activeCategory.description}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-expanded={showTopTen}
            onClick={() => {
              setShowTopTen((open) => !open)
              setOpenStatusId(null)
            }}
            className={cn(
              UI.btn,
              UI.btnSecondary,
              'h-9 gap-2 rounded-full px-3 text-xs',
              showTopTen && 'border-indigo-300/30 bg-indigo-400/10 text-indigo-100',
            )}
          >
            {showTopTen ? (
              <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4">
                <rect
                  x="4"
                  y="2.5"
                  width="12"
                  height="15"
                  rx="2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path d="M7 7h6M7 10h6M7 13h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4">
                <rect x="2.5" y="3" width="4" height="14" rx="1" fill="currentColor" />
                <rect x="8" y="3" width="4" height="14" rx="1" fill="currentColor" opacity=".65" />
                <rect x="13.5" y="3" width="4" height="14" rx="1" fill="currentColor" opacity=".4" />
              </svg>
            )}
            {showTopTen ? 'Featured view' : 'Top 10'}
          </button>
        </div>
      </div>

      <div className="flex gap-2" role="tablist" aria-label="Anime discovery category">
        {CATEGORIES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={category === item.id}
            onClick={() => changeCategory(item.id)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs transition-colors',
              category === item.id
                ? 'border-indigo-400/30 bg-indigo-500/15 text-indigo-100'
                : 'border-white/10 text-zinc-400 hover:bg-white/5 hover:text-zinc-200',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {discoveryQuery.isError ? (
        <div className="rounded-2xl border border-white/10 bg-zinc-900/40 px-4 py-6 text-center">
          <p className="text-sm text-zinc-400">Anime picks are temporarily unavailable.</p>
          <button
            type="button"
            onClick={() => void discoveryQuery.refetch()}
            className="mt-2 text-sm font-medium text-indigo-300 hover:text-indigo-200"
          >
            Try again
          </button>
        </div>
      ) : discoveryQuery.isPending ? (
        <div
          aria-hidden="true"
          className="h-72 animate-pulse rounded-3xl border border-white/10 bg-gradient-to-r from-zinc-900 via-white/[0.06] to-zinc-900 sm:h-80"
        />
      ) : showTopTen ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {topTenResults.map((anime, index) => {
            const title = displayTitle(anime)
            const isAdded = addedIds.includes(anime.anilist_id)
            const isPending =
              addMutation.isPending && addMutation.variables?.anilistId === anime.anilist_id
            const statusMenuOpen = openStatusId === anime.anilist_id
            const statusMenuMounted = mountedStatusId === anime.anilist_id
            return (
              <article
                key={anime.anilist_id}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/70 shadow-lg shadow-black/20"
              >
                {isAuthenticated ? (
                  <Link to={`/anime/${anime.anilist_id}`} className="block">
                    {anime.cover_url ? (
                      <img src={anime.cover_url} alt={`${title} cover art`} className="aspect-[3/4] w-full object-cover" />
                    ) : (
                      <div className="aspect-[3/4] w-full bg-zinc-800" />
                    )}
                    <span className="absolute left-2 top-2 rounded-full border border-white/15 bg-zinc-950/70 px-2 py-1 text-xs font-semibold text-white backdrop-blur">
                      #{index + 1}
                    </span>
                    <div className="absolute inset-x-0 bottom-0 flex h-1/3 flex-col justify-end gap-1 bg-zinc-950/25 p-3 backdrop-blur-[2px]">
                      <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-50">{title}</h3>
                      {anime.average_score != null ? (
                        <p className="text-xs font-medium text-amber-200">★ {anime.average_score}%</p>
                      ) : null}
                    </div>
                  </Link>
                ) : (
                  <a href={`https://anilist.co/anime/${anime.anilist_id}`} target="_blank" rel="noopener noreferrer" className="block">
                    {anime.cover_url ? (
                      <img src={anime.cover_url} alt={`${title} cover art`} className="aspect-[3/4] w-full object-cover" />
                    ) : (
                      <div className="aspect-[3/4] w-full bg-zinc-800" />
                    )}
                    <span className="absolute left-2 top-2 rounded-full border border-white/15 bg-zinc-950/70 px-2 py-1 text-xs font-semibold text-white backdrop-blur">
                      #{index + 1}
                    </span>
                    <div className="absolute inset-x-0 bottom-0 flex h-1/3 flex-col justify-end gap-1 bg-zinc-950/25 p-3 backdrop-blur-[2px]">
                      <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-50">{title}</h3>
                      {anime.average_score != null ? (
                        <p className="text-xs font-medium text-amber-200">★ {anime.average_score}%</p>
                      ) : null}
                    </div>
                  </a>
                )}
                {isAuthenticated ? (
                  <button
                    ref={statusMenuOpen ? addButtonRef : undefined}
                    type="button"
                    disabled={isAdded || isPending}
                    aria-label={isAdded ? `${title} added to collection` : `Add ${title} to collection`}
                    aria-expanded={statusMenuOpen}
                    aria-controls={`spotlight-status-${anime.anilist_id}`}
                    title={isAdded ? 'Added to collection' : 'Add to collection'}
                    onClick={() => setOpenStatusId(statusMenuOpen ? null : anime.anilist_id)}
                    className="absolute right-2 top-2 z-20 inline-flex size-10 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white shadow-lg shadow-black/30 backdrop-blur-xl transition hover:bg-white/25 disabled:opacity-60"
                  >
                    {isPending ? (
                      <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    ) : isAdded ? (
                      <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5">
                        <path d="m4 10 4 4 8-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5">
                        <path d="M10 4v12M4 10h12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    )}
                  </button>
                ) : hideUnauthenticatedSave ? null : (
                  <Link
                    to="/"
                    aria-label={`Create an account to save ${title}`}
                    className="absolute right-2 top-2 z-20 inline-flex size-10 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white shadow-lg shadow-black/30 backdrop-blur-xl transition hover:bg-white/25"
                  >
                    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5">
                      <path d="M10 4v12M4 10h12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </Link>
                )}
                {failedId === anime.anilist_id ? (
                  <p className="px-3 pb-2 text-xs text-rose-300" role="status">{addError}</p>
                ) : null}
                {statusMenuMounted && statusMenuPosition
                  ? createPortal(
                      <div
                        ref={statusMenuRef}
                        id={`spotlight-status-${anime.anilist_id}`}
                        aria-hidden={!statusMenuOpen}
                        inert={!statusMenuOpen}
                        data-open={statusMenuOpen}
                        className="spotlight-status-menu fixed z-[90] flex max-h-[calc(100dvh-1rem)] flex-col gap-1 overflow-y-auto rounded-full border border-white/20 bg-white/15 p-1.5 shadow-xl shadow-black/40 ring-1 ring-white/15 backdrop-blur-2xl backdrop-saturate-150"
                        style={statusMenuPosition}
                        role="group"
                        aria-label={`Choose status for ${title}`}
                      >
                        {SAVE_STATUSES.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            disabled={isPending}
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
              </article>
            )
          })}
        </div>
      ) : currentAnime ? (
        (() => {
          const anime = currentAnime
          const title = displayTitle(anime)
          const isAdded = addedIds.includes(anime.anilist_id)
          const isPending =
            addMutation.isPending && addMutation.variables?.anilistId === anime.anilist_id
          const statusMenuOpen = openStatusId === anime.anilist_id
          const statusMenuMounted = mountedStatusId === anime.anilist_id
          const saveControl = isAuthenticated ? (
            <button
              ref={statusMenuOpen ? addButtonRef : undefined}
              type="button"
              disabled={isAdded || isPending}
              aria-label={
                isAdded
                  ? `${title} added to collection`
                  : statusMenuOpen
                    ? `Close save options for ${title}`
                    : `Add ${title} to collection`
              }
              aria-expanded={statusMenuOpen}
              aria-controls={`spotlight-status-${anime.anilist_id}`}
              title={isAdded ? 'Added to collection' : 'Add to collection'}
              onClick={() => setOpenStatusId(statusMenuOpen ? null : anime.anilist_id)}
              className="inline-flex size-11 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white shadow-lg shadow-black/20 backdrop-blur-xl backdrop-saturate-150 transition hover:border-white/40 hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/70 disabled:opacity-60"
            >
              {isPending ? (
                <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : isAdded ? (
                <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5">
                  <path d="m4 10 4 4 8-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5">
                  <path d="M10 4v12M4 10h12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
            </button>
          ) : hideUnauthenticatedSave ? null : (
            <Link
              to="/"
              aria-label={`Create an account to save ${title}`}
              title="Create an account to save"
              className="inline-flex size-11 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white shadow-lg shadow-black/20 backdrop-blur-xl backdrop-saturate-150 transition hover:border-white/40 hover:bg-white/25"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5">
                <path d="M10 4v12M4 10h12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </Link>
          )
          return (
            <div
              key={`${category}-${anime.anilist_id}`}
              className="anime-spotlight-slide group relative w-full min-w-0 flex-none self-stretch touch-pan-y min-h-[30rem] overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/60 shadow-2xl shadow-black/30 sm:min-h-80"
              onMouseEnter={() => setIsSpotlightHovered(true)}
              onMouseLeave={() => setIsSpotlightHovered(false)}
              onFocusCapture={() => setHasSpotlightFocus(true)}
              onBlurCapture={(event) => {
                if (
                  !(event.relatedTarget instanceof Node) ||
                  !event.currentTarget.contains(event.relatedTarget)
                ) {
                  setHasSpotlightFocus(false)
                }
              }}
              onPointerDown={(event) => {
                if (event.button !== 0) return
                if (
                  event.target instanceof Element &&
                  event.target.closest('a, button, input, select, textarea')
                ) {
                  return
                }
                slideDragRef.current = { pointerId: event.pointerId, startX: event.clientX }
                wasSlideDraggedRef.current = false
                if (event.pointerType === 'touch') setIsSpotlightHovered(true)
                event.currentTarget.setPointerCapture(event.pointerId)
              }}
              onPointerMove={(event) => {
                const drag = slideDragRef.current
                if (!drag || drag.pointerId !== event.pointerId) return
                if (Math.abs(event.clientX - drag.startX) > 8) {
                  wasSlideDraggedRef.current = true
                  event.preventDefault()
                }
              }}
              onPointerUp={(event) => {
                const drag = slideDragRef.current
                if (!drag || drag.pointerId !== event.pointerId) return
                const delta = event.clientX - drag.startX
                slideDragRef.current = null
                if (event.pointerType === 'touch') setIsSpotlightHovered(false)
                if (Math.abs(delta) > 48) {
                  changeSlide(activeIndex + (delta < 0 ? 1 : -1))
                }
              }}
              onPointerCancel={(event) => {
                slideDragRef.current = null
                if (event.pointerType === 'touch') setIsSpotlightHovered(false)
              }}
              onClickCapture={(event) => {
                if (!wasSlideDraggedRef.current) return
                event.preventDefault()
                event.stopPropagation()
                wasSlideDraggedRef.current = false
              }}
            >
              {anime.cover_url ? (
                <img
                  src={anime.cover_url}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full object-cover opacity-35 transition-transform duration-700 group-hover:scale-[1.03]"
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/75 to-zinc-950/15" />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-zinc-950/15" />
              {anime.cover_url ? (
                <div className="absolute left-5 top-5 z-30 h-44 w-[7.33rem] sm:left-auto sm:right-6 sm:top-[9%] sm:h-[82%] sm:w-auto sm:aspect-[2/3]">
                  {isAuthenticated ? (
                    <Link
                      to={`/anime/${anime.anilist_id}`}
                      aria-label={`View ${title}`}
                      title={`View ${title}`}
                      className="block h-full w-full"
                    >
                      <img
                        src={anime.cover_url}
                        alt={`${title} cover art`}
                        className="h-full w-full rounded-xl border border-white/15 object-cover shadow-2xl shadow-black/50 sm:rounded-2xl"
                      />
                    </Link>
                  ) : (
                    <a
                      href={`https://anilist.co/anime/${anime.anilist_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`View ${title} on AniList`}
                      title={`View ${title} on AniList`}
                      className="block h-full w-full"
                    >
                      <img
                        src={anime.cover_url}
                        alt={`${title} cover art`}
                        className="h-full w-full rounded-xl border border-white/15 object-cover shadow-2xl shadow-black/50 sm:rounded-2xl"
                      />
                    </a>
                  )}
                  <div className="absolute bottom-3 right-3 z-10">
                    {saveControl}
                  </div>
                </div>
              ) : null}
              <div className="relative z-20 flex min-h-[30rem] items-end p-5 pt-56 sm:min-h-80 sm:p-8">
                <div className="max-w-full pb-2 sm:max-w-[58%] sm:pb-4">
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-indigo-200/20 bg-indigo-400/10 px-3 py-1 text-xs font-medium text-indigo-100 backdrop-blur">
                      {category === 'trending' ? `#${activeIndex + 1} trending` : 'Airing now'}
                    </span>
                    {anime.average_score != null ? (
                      <span className="rounded-full border border-amber-200/20 bg-zinc-950/40 px-3 py-1 text-xs font-semibold text-amber-100 backdrop-blur">
                        ★ {anime.average_score}%
                      </span>
                    ) : null}
                  </div>
                  <div
                    ref={titleViewportRef}
                    className={cn('max-w-full overflow-hidden', isTitleOverflowing && 'spotlight-title-viewport')}
                  >
                    {isAuthenticated ? (
                      <Link to={`/anime/${anime.anilist_id}`} className="block w-fit max-w-full">
                        <h3
                          ref={titleTextRef}
                          className={cn(
                            'w-max whitespace-nowrap text-2xl font-bold tracking-tight text-white sm:text-4xl',
                            isTitleOverflowing && 'spotlight-title-scroll',
                          )}
                        >
                          {title}
                        </h3>
                      </Link>
                    ) : (
                      <a
                        href={`https://anilist.co/anime/${anime.anilist_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-fit max-w-full"
                      >
                        <h3
                          ref={titleTextRef}
                          className={cn(
                            'w-max whitespace-nowrap text-2xl font-bold tracking-tight text-white sm:text-4xl',
                            isTitleOverflowing && 'spotlight-title-scroll',
                          )}
                        >
                          {title}
                        </h3>
                      </a>
                    )}
                  </div>
                  <p className="mt-3 text-sm text-zinc-300">
                    {[metaLine(anime.format, anime.season_year, anime.airing_status), episodeCountLabel(anime.total_episodes)]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {anime.description ? (
                    <div className="spotlight-description-scroll mt-3 text-sm leading-relaxed text-zinc-300/90">
                      {renderAnimeDescription(anime.description)}
                    </div>
                  ) : null}
                </div>
              </div>
              {!anime.cover_url ? (
                <div className="absolute bottom-5 right-5 z-20 sm:bottom-7 sm:right-7">
                  {saveControl}
                </div>
              ) : null}
              {failedId === anime.anilist_id ? (
                <p className="absolute bottom-2 right-20 text-xs text-rose-300" role="status">{addError}</p>
              ) : null}
              {statusMenuMounted && statusMenuPosition
                ? createPortal(
                    <div
                      ref={statusMenuRef}
                      id={`spotlight-status-${anime.anilist_id}`}
                      aria-hidden={!statusMenuOpen}
                      inert={!statusMenuOpen}
                      data-open={statusMenuOpen}
                      className="spotlight-status-menu fixed z-[90] flex max-h-[calc(100dvh-1rem)] flex-col gap-1 overflow-y-auto rounded-full border border-white/20 bg-white/15 p-1.5 shadow-xl shadow-black/40 ring-1 ring-white/15 backdrop-blur-2xl backdrop-saturate-150"
                        style={statusMenuPosition}
                      role="group"
                      aria-label={`Choose status for ${title}`}
                    >
                      {SAVE_STATUSES.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          disabled={isPending}
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
            </div>
          )
        })()
      ) : (
        <div className="rounded-2xl border border-white/10 bg-zinc-900/40 px-4 py-6 text-center text-sm text-zinc-400">
          No anime found in this category.
        </div>
      )}
      {!showTopTen && animeResults.length > 1 ? (
        <nav
          className="mx-auto flex h-1 w-full max-w-48 overflow-hidden rounded-full bg-white/15"
          aria-label="Anime carousel pagination"
        >
          {animeResults.map((anime, index) => (
            <button
              key={anime.anilist_id}
              type="button"
              aria-label={`Show anime ${index + 1}: ${displayTitle(anime)}`}
              aria-current={activeIndex === index ? 'true' : undefined}
              onClick={() => changeSlide(index)}
              className={cn(
                'h-full min-w-0 flex-1 border-r border-zinc-950/70 last:border-r-0 transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/70',
                activeIndex === index
                  ? 'bg-indigo-300'
                  : 'bg-transparent hover:bg-white/35',
              )}
            />
          ))}
        </nav>
      ) : null}
      <p className="text-right text-[10px] text-zinc-500">
        Anime data provided by AniList
      </p>
    </section>
  )
}
