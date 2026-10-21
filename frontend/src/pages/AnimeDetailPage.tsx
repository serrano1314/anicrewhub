import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BackLink } from '../components/BackLink'
import { fetchAnime, fetchRelatedAnime } from '../api/anime'
import { ApiError } from '../api/client'
import {
  addToLibrary,
  fetchWatchedEpisodes,
  fetchLibraryEntry,
  markUpTo,
  removeFromLibrary,
  resetEpisodeProgress,
  setEpisodeWatched,
  updateLibrary,
} from '../api/library'
import { AnimeSitesSection } from '../components/AnimeSitesSection'
import { ErrorPanel, LoadingIndicator } from '../components/PageStatus'
import { EpisodeGrid } from '../components/EpisodeGrid'
import { ProgressMeter } from '../components/ProgressMeter'
import { StarRating } from '../components/StarRating'
import { WatchLinksDialog } from '../components/WatchLinksDialog'
import { useDialog } from '../components/dialogContext'
import { airingLabel, displayTitle, formatLabel } from '../lib/display'
import { renderAnimeDescription } from '../lib/animeDescription'
import { episodeCountLabel } from '../lib/episodes'
import { cn } from '../lib/ui'
import type { BackTarget } from '../lib/navigation'
import { LIBRARY_STATUSES, STATUS_LABELS } from '../types/library'

const DEFAULT_BACK: BackTarget = { label: ' My Collection', to: '/' }
import type { LibraryStatus } from '../types/library'

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

function errorText(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}

export function AnimeDetailPage() {
  const params = useParams()
  const rawId = Number(params.anilistId)
  const anilistId = Number.isInteger(rawId) && rawId >= 1 ? rawId : null
  const queryClient = useQueryClient()
  const dialog = useDialog()
  const episodeSectionRef = useRef<HTMLDivElement>(null)
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false)
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false)
  const [focusEpisode, setFocusEpisode] = useState<number | null>(null)
  const [selectedEpisode, setSelectedEpisode] = useState<number | null>(null)
  const [expandedRelatedAnimeId, setExpandedRelatedAnimeId] = useState<number | null>(null)
  const [isCollectionControlsOpen, setIsCollectionControlsOpen] = useState(false)
  const [isAnimeInfoOpen, setIsAnimeInfoOpen] = useState(true)

  const animeQuery = useQuery({
    queryKey: ['anime', anilistId],
    queryFn: () => fetchAnime(anilistId as number),
    enabled: anilistId != null,
    retry: false,
  })

  const relatedAnimeOpen = expandedRelatedAnimeId === anilistId
  const relatedAnimeQuery = useQuery({
    queryKey: ['anime', anilistId, 'related'],
    queryFn: () => fetchRelatedAnime(anilistId as number),
    enabled: relatedAnimeOpen,
    retry: false,
  })

  const episodesQuery = useQuery({
    queryKey: ['episodes', anilistId],
    queryFn: async () => {
      try {
        return await fetchWatchedEpisodes(anilistId as number)
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return null
        }
        throw error
      }
    },
    enabled: anilistId != null,
    retry: false,
  })

  const inLibrary = episodesQuery.data != null
  const entryQuery = useQuery({
    queryKey: ['library-entry', anilistId],
    queryFn: () => fetchLibraryEntry(anilistId as number),
    enabled: anilistId != null,
    retry: false,
  })
  const savedEntry = entryQuery.data

  async function refreshProgress() {
    await queryClient.invalidateQueries({ queryKey: ['library'] })
    await queryClient.invalidateQueries({ queryKey: ['episodes', anilistId] })
    await queryClient.invalidateQueries({ queryKey: ['library-entry', anilistId] })
  }

  const addMutation = useMutation({
    mutationFn: (status: LibraryStatus) => addToLibrary(anilistId as number, status),
    onSuccess: async () => {
      setIsAddMenuOpen(false)
      await refreshProgress()
    },
  })

  const updateMutation = useMutation({
    mutationFn: (body: { status?: LibraryStatus; score?: number | null; is_favorite?: boolean }) =>
      updateLibrary(anilistId as number, body),
    onSuccess: async () => {
      setIsStatusMenuOpen(false)
      await refreshProgress()
    },
  })

  const removeMutation = useMutation({
    mutationFn: () => removeFromLibrary(anilistId as number),
    onSuccess: async () => {
      setFocusEpisode(null)
      setSelectedEpisode(null)
      await refreshProgress()
    },
  })

  const resetProgressMutation = useMutation({
    mutationFn: () => resetEpisodeProgress(anilistId as number),
    onSuccess: async () => {
      setFocusEpisode(null)
      setSelectedEpisode(null)
      await refreshProgress()
    },
  })

  const episodeMutation = useMutation({
    mutationFn: (input: { episode: number; watched: boolean }) =>
      setEpisodeWatched(anilistId as number, input.episode, input.watched),
    onSuccess: async (_data, input) => {
      setFocusEpisode(input.episode)
      await refreshProgress()
    },
  })

  const markMutation = useMutation({
    mutationFn: (episode: number) => markUpTo(anilistId as number, episode),
    onSuccess: async (_data, episode) => {
      setFocusEpisode(episode)
      await refreshProgress()
    },
  })

  if (anilistId == null) {
    return (
      <div className="space-y-3">
        <BackLink fallback={DEFAULT_BACK} />
        <p className="text-zinc-300">That anime id is not valid.</p>
      </div>
    )
  }

  if (animeQuery.isPending) {
    return (
      <div className="space-y-4">
        <BackLink fallback={DEFAULT_BACK} />
        <LoadingIndicator label="Loading anime…" />
      </div>
    )
  }

  if (animeQuery.isError || !animeQuery.data) {
    return (
      <div className="space-y-3">
        <BackLink fallback={DEFAULT_BACK} />
        <ErrorPanel
          message={errorText(animeQuery.error, 'Could not load this anime')}
          onRetry={() => {
            void animeQuery.refetch()
          }}
        />
      </div>
    )
  }

  const anime = animeQuery.data
  const title = displayTitle(anime)
  const episodes = episodesQuery.data?.episodes ?? []
  const watchedCount = episodes.length
  const lastEpisode = episodes.reduce((max, episode) => Math.max(max, episode), 0)
  const total = anime.total_episodes
  const actionError =
    episodeMutation.error ??
    markMutation.error ??
    resetProgressMutation.error ??
    addMutation.error ??
    updateMutation.error

  async function onRemove() {
    const confirmed = await dialog.confirm({
      title: 'Remove from list',
      message: `Remove ${title} from your list? Episode progress will be deleted.`,
      confirmLabel: 'Remove',
      tone: 'danger',
    })
    if (!confirmed) {
      return
    }
    try {
      await removeMutation.mutateAsync()
      await dialog.success({
        title: 'Removed',
        message: `${title} was removed from your list.`,
      })
    } catch (error) {
      await dialog.error({
        title: 'Could not remove',
        message: errorText(error, 'Could not remove this anime.'),
      })
    }
  }

  async function onResetProgress() {
    if (watchedCount === 0) {
      return
    }
    const confirmed = await dialog.confirm({
      title: 'Reset episode progress',
      message: `Clear all ${watchedCount} watched episodes for ${title}? This cannot be undone.`,
      confirmLabel: 'Reset episodes',
      tone: 'danger',
    })
    if (!confirmed) {
      return
    }
    try {
      await resetProgressMutation.mutateAsync()
      await dialog.success({
        title: 'Progress reset',
        message: `Watched episodes for ${title} were cleared.`,
      })
    } catch (error) {
      await dialog.error({
        title: 'Could not reset progress',
        message: errorText(error, 'Could not reset episode progress.'),
      })
    }
  }

  return (
    <article className="min-w-0 max-w-full space-y-6">
      <BackLink fallback={DEFAULT_BACK} />
      <header className="group relative isolate overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/60 shadow-2xl shadow-black/30">
        {anime.details.banner_url || anime.cover_url ? (
          <img
            src={anime.details.banner_url || anime.cover_url || undefined}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 h-full w-full scale-105 object-cover opacity-35 blur-2xl transition-opacity duration-300 group-hover:opacity-45"
          />
        ) : null}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-zinc-950/85 via-zinc-950/65 to-indigo-950/40" />
        <div className="relative flex min-w-0 flex-col gap-5 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
          {entryQuery.isSuccess && savedEntry == null ? (
            <>
              <button
                type="button"
                disabled={addMutation.isPending}
                aria-label={isAddMenuOpen ? 'Close add options' : 'Add to collection'}
                aria-expanded={isAddMenuOpen}
                aria-controls="anime-add-status-menu"
                title={addMutation.isPending ? 'Adding to collection' : 'Add to collection'}
                onClick={() => setIsAddMenuOpen((open) => !open)}
                className="absolute right-4 top-4 z-30 inline-flex size-10 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white shadow-lg shadow-black/30 backdrop-blur-xl transition hover:border-white/40 hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/70 disabled:opacity-60 sm:right-6 sm:top-6"
              >
                {addMutation.isPending ? (
                  <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                ) : (
                  <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M10 4v12M4 10h12" />
                  </svg>
                )}
              </button>
              {isAddMenuOpen ? (
                <div
                  id="anime-add-status-menu"
                  role="group"
                  aria-label="Choose collection status"
                  className="absolute right-4 top-16 z-30 flex max-h-[calc(100%-5rem)] min-w-40 flex-col gap-1 overflow-y-auto rounded-2xl border border-white/20 bg-zinc-900/90 p-1.5 shadow-xl shadow-black/40 ring-1 ring-white/15 backdrop-blur-2xl sm:right-6 sm:top-[4.5rem]"
                >
                  {LIBRARY_STATUSES.map((status) => (
                    <button
                      key={status}
                      type="button"
                      disabled={addMutation.isPending}
                      aria-label={`Add ${title} as ${STATUS_LABELS[status]}`}
                      title={STATUS_LABELS[status]}
                      onClick={() => addMutation.mutate(status)}
                      className="inline-flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 text-left text-sm text-zinc-100 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/70 disabled:opacity-50"
                    >
                      <StatusIcon status={status} />
                      <span>{STATUS_LABELS[status]}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
          {savedEntry ? (
            <>
              <div className="absolute right-4 top-4 z-30 flex items-center gap-2 sm:right-6 sm:top-6">
                <button
                  type="button"
                  disabled={updateMutation.isPending}
                  aria-label={savedEntry.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                  aria-pressed={savedEntry.is_favorite}
                  title={savedEntry.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                  onClick={() =>
                    updateMutation.mutate({ is_favorite: !savedEntry.is_favorite })
                  }
                  className={cn(
                    'inline-flex size-10 items-center justify-center rounded-full border bg-zinc-950/50 shadow-lg shadow-black/30 backdrop-blur-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200/70 disabled:opacity-60',
                    savedEntry.is_favorite
                      ? 'border-rose-300/40 text-rose-200 hover:bg-rose-500/20'
                      : 'border-white/15 text-zinc-300 hover:border-rose-300/35 hover:bg-rose-500/10 hover:text-rose-200',
                  )}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
                    <path
                      d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"
                      fill={savedEntry.is_favorite ? 'currentColor' : 'none'}
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  disabled={updateMutation.isPending}
                  aria-label={`Collection status: ${STATUS_LABELS[savedEntry.status]}. Change status`}
                  aria-expanded={isStatusMenuOpen}
                  aria-controls="anime-current-status-menu"
                  title={STATUS_LABELS[savedEntry.status]}
                  onClick={() => setIsStatusMenuOpen((open) => !open)}
                  className="inline-flex size-10 items-center justify-center rounded-full border border-indigo-200/25 bg-zinc-950/50 text-indigo-100 shadow-lg shadow-black/30 backdrop-blur-xl transition hover:border-indigo-200/45 hover:bg-indigo-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/70 disabled:opacity-60"
                >
                  <StatusIcon status={savedEntry.status} />
                </button>
              </div>
              {isStatusMenuOpen ? (
                <div
                  id="anime-current-status-menu"
                  role="group"
                  aria-label="Change collection status"
                  className="absolute right-4 top-16 z-30 flex max-h-[calc(100%-5rem)] min-w-40 flex-col gap-1 overflow-y-auto rounded-2xl border border-white/20 bg-zinc-900/90 p-1.5 shadow-xl shadow-black/40 ring-1 ring-white/15 backdrop-blur-2xl sm:right-6 sm:top-[4.5rem]"
                >
                  {LIBRARY_STATUSES.map((status) => (
                    <button
                      key={status}
                      type="button"
                      disabled={updateMutation.isPending}
                      aria-label={`Set status to ${STATUS_LABELS[status]}`}
                      aria-pressed={savedEntry.status === status}
                      onClick={() => updateMutation.mutate({ status })}
                      className={cn(
                        'inline-flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/70 disabled:opacity-50',
                        savedEntry.status === status
                          ? 'bg-indigo-500/20 text-indigo-100'
                          : 'text-zinc-100 hover:bg-white/10 hover:text-white',
                      )}
                    >
                      <StatusIcon status={status} />
                      <span>{STATUS_LABELS[status]}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
          <div className="flex shrink-0 flex-col items-center gap-3 self-center sm:self-start">
            {anime.cover_url ? (
              <img
                src={anime.cover_url}
                alt={`${title} cover art`}
                className="h-64 w-44 rounded-2xl border border-white/15 object-cover shadow-2xl shadow-black/50 sm:h-80 sm:w-56"
              />
            ) : (
              <div className="flex h-64 w-44 items-center justify-center rounded-2xl border border-white/10 bg-zinc-800/80 text-zinc-500 sm:h-80 sm:w-56">
                <svg viewBox="0 0 24 24" aria-hidden="true" className="size-10" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5zM4 5.5v16M8 7h8M8 10h6" />
                </svg>
              </div>
            )}
            {inLibrary ? (
              <button
                type="button"
                onClick={() => episodeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-indigo-200/20 bg-indigo-400/10 px-4 text-xs font-medium text-indigo-100 transition hover:border-indigo-200/35 hover:bg-indigo-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/70"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="14" height="14" rx="3" />
                  <path d="M7 3v14m6-14v14" />
                </svg>
                Browse episodes
              </button>
            ) : null}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {formatLabel(anime.format) ? (
                  <span className="rounded-full border border-indigo-200/20 bg-indigo-400/10 px-3 py-1 text-xs font-medium text-indigo-100">
                    {formatLabel(anime.format)}
                  </span>
                ) : null}
                {anime.season_year ? (
                  <span className="rounded-full border border-white/10 bg-zinc-950/40 px-3 py-1 text-xs text-zinc-300">
                    {anime.season_year}
                  </span>
                ) : null}
                {airingLabel(anime.airing_status) ? (
                  <span className="rounded-full border border-white/10 bg-zinc-950/40 px-3 py-1 text-xs text-zinc-300">
                    {airingLabel(anime.airing_status)}
                  </span>
                ) : null}
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">{title}</h1>
              {anime.title_english && anime.title_romaji !== title ? (
                <p className="mt-1 truncate text-sm text-zinc-400">{anime.title_romaji}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-zinc-300">
                {total != null ? (
                  <span className="inline-flex items-center gap-1.5">
                    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4 text-indigo-200" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="14" height="14" rx="3" />
                      <path d="M7 3v14m6-14v14" />
                    </svg>
                    {episodeCountLabel(total)}
                  </span>
                ) : null}
                {anime.average_score != null ? (
                  <span className="inline-flex items-center gap-1.5 text-amber-200">
                    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4 fill-current">
                      <path d="m10 1.5 2.6 5.3 5.9.9-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.9z" />
                    </svg>
                    {anime.average_score}%
                  </span>
                ) : null}
              </div>
            </div>
            {inLibrary ? (
              <div className="rounded-2xl border border-white/10 bg-zinc-950/35 p-3 sm:p-4">
                <ProgressMeter
                  watchedCount={watchedCount}
                  totalEpisodes={total}
                  lastEpisodeWatched={lastEpisode}
                />
              </div>
            ) : null}
            {anime.description ? (
              <section
                className="min-w-0 rounded-2xl border border-white/10 bg-zinc-950/35 p-3 sm:p-4"
                aria-labelledby="anime-synopsis-title"
              >
                <h2 id="anime-synopsis-title" className="mb-2 text-xs font-semibold text-zinc-100">Synopsis</h2>
                <div className="spotlight-description-scroll text-sm leading-relaxed text-zinc-300/90">
                  {renderAnimeDescription(anime.description)}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </header>

      <section className="w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/55 shadow-lg shadow-black/20 backdrop-blur-sm" aria-labelledby="anime-info-title">
        <h2 id="anime-info-title">
          <button
            type="button"
            aria-expanded={isAnimeInfoOpen}
            aria-controls="anime-info-content"
            onClick={() => setIsAnimeInfoOpen((open) => !open)}
            className="flex w-full min-w-0 items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-zinc-100 transition hover:bg-white/[0.03] sm:px-5"
          >
            <span>Anime info</span>
            <svg
              viewBox="0 0 20 20"
              aria-hidden="true"
              className={`size-4 shrink-0 text-zinc-400 transition-transform ${isAnimeInfoOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
            >
              <path d="m4 7 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </h2>
        <div
          id="anime-info-content"
          hidden={!isAnimeInfoOpen}
          className="space-y-4 border-t border-white/[0.08] p-4 sm:p-5"
        >
          {anime.details.trailer_url ? (
            <div className="flex justify-end">
              <a
                href={anime.details.trailer_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-200 transition hover:border-indigo-300/25 hover:text-indigo-100"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4 text-indigo-200" fill="currentColor">
                  <path d="M10 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17ZM8 6l6 4-6 4z" />
                </svg>
                Watch trailer
              </a>
            </div>
          ) : null}
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            ['Source', anime.details.source?.replaceAll('_', ' ')],
            ['Duration', anime.details.duration_minutes ? `${anime.details.duration_minutes} min / ep` : null],
            ['Country', anime.details.country_of_origin],
            ['Season', anime.details.season && anime.season_year ? `${anime.details.season} ${anime.season_year}` : null],
            ['Aired', anime.details.start_date
              ? anime.details.end_date
                ? `${anime.details.start_date} – ${anime.details.end_date}`
                : anime.details.start_date
              : null],
            ['Popularity', anime.details.popularity?.toLocaleString()],
            ['Favorites', anime.details.favorites?.toLocaleString()],
          ]
            .filter((item): item is [string, string] => Boolean(item[1]))
            .map(([label, value]) => (
              <div key={label} className="min-w-0 rounded-xl border border-white/[0.06] bg-zinc-950/30 px-3 py-2.5">
                <dt className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">{label}</dt>
                <dd className="mt-1 truncate text-xs font-medium text-zinc-200" title={value}>{value}</dd>
              </div>
            ))}
          {anime.details.next_episode != null ? (
            <div className="min-w-0 rounded-xl border border-indigo-300/15 bg-indigo-400/[0.06] px-3 py-2.5">
              <dt className="text-[10px] font-medium uppercase tracking-[0.14em] text-indigo-200/70">Next episode</dt>
              <dd className="mt-1 text-xs font-medium text-indigo-100">
                Episode {anime.details.next_episode}
                {anime.details.next_airing_at != null
                  ? ` · ${new Date(anime.details.next_airing_at * 1000).toLocaleString()}`
                  : ''}
              </dd>
            </div>
          ) : null}
        </dl>
        {anime.details.genres.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">Genres</h3>
            <div className="flex flex-wrap gap-2">
              {anime.details.genres.map((genre) => (
                <span key={genre} className="rounded-full border border-indigo-200/15 bg-indigo-400/[0.06] px-3 py-1 text-xs text-indigo-100/90">
                  {genre}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {anime.details.studios.length > 0 ? (
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs">
            <span className="font-medium uppercase tracking-[0.12em] text-zinc-500">Studio</span>
            <span className="text-zinc-200">{anime.details.studios.join(' · ')}</span>
          </div>
        ) : null}
        {anime.external_links.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">Stream</h3>
            <div className="flex flex-wrap gap-2">
              {anime.external_links.map((link) => (
                <a
                  key={`${link.site}-${link.url}`}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-white/10 bg-zinc-950/40 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-indigo-300/25 hover:text-indigo-100"
                >
                  {link.site}
                </a>
              ))}
            </div>
          </div>
        ) : null}
        {anime.details.tags.some((tag) => !tag.is_spoiler) ? (
          <div className="space-y-2">
            <h3 className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">Themes</h3>
            <div className="flex flex-wrap gap-2">
              {anime.details.tags
                .filter((tag) => !tag.is_spoiler)
                .slice(0, 12)
                .map((tag) => (
                  <span key={tag.name} className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] text-zinc-400">
                    {tag.name}
                  </span>
                ))}
            </div>
          </div>
        ) : null}
        </div>
      </section>

      <section className="w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/40" aria-labelledby="related-anime-title">
        <h2 id="related-anime-title">
          <button
            type="button"
            aria-expanded={relatedAnimeOpen}
            aria-controls="related-anime-content"
            onClick={() => setExpandedRelatedAnimeId(relatedAnimeOpen ? null : anilistId)}
            className="flex w-full min-w-0 items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-zinc-100 transition hover:bg-white/[0.03]"
          >
            <span>Related anime</span>
            <svg
              viewBox="0 0 20 20"
              aria-hidden="true"
              className={`size-4 shrink-0 text-zinc-400 transition-transform ${relatedAnimeOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
            >
              <path d="m4 7 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </h2>
        <div
          id="related-anime-content"
          hidden={!relatedAnimeOpen}
          className="w-full min-w-0 max-w-full border-t border-white/[0.08] p-3 sm:p-4"
        >
          {relatedAnimeQuery.isPending ? <LoadingIndicator label="Loading related anime…" /> : null}
          {relatedAnimeQuery.isError ? (
            <ErrorPanel
              message={errorText(relatedAnimeQuery.error, 'Could not load related anime')}
              onRetry={() => {
                void relatedAnimeQuery.refetch()
              }}
            />
          ) : null}
          {relatedAnimeQuery.isSuccess && relatedAnimeQuery.data.length === 0 ? (
            <p className="text-sm text-zinc-400">No related anime found.</p>
          ) : null}
          {relatedAnimeQuery.data && relatedAnimeQuery.data.length > 0 ? (
            <ul className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {relatedAnimeQuery.data.map((related) => (
                <li key={`${related.anilist_id}-${related.relation}`} className="min-w-0">
                  <Link
                    to={`/anime/${related.anilist_id}`}
                    className="group flex w-full min-w-0 items-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/55 p-3 transition hover:border-indigo-300/25 hover:bg-zinc-900/75"
                  >
                    {related.cover_url ? (
                      <img src={related.cover_url} alt="" loading="lazy" className="size-12 shrink-0 rounded-lg object-cover ring-1 ring-white/10" />
                    ) : (
                      <span aria-hidden="true" className="size-12 shrink-0 rounded-lg bg-zinc-800" />
                    )}
                    <span className="min-w-0 flex-1 overflow-hidden">
                      <span className="block truncate text-sm font-medium text-zinc-200 group-hover:text-white">{related.title}</span>
                      <span className="mt-1 block truncate text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                        {related.relation.replaceAll('_', ' ')}{related.format ? ` · ${related.format}` : ''}
                      </span>
                    </span>
                    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4 shrink-0 text-zinc-500 group-hover:text-indigo-200" fill="none" stroke="currentColor" strokeWidth="1.7">
                      <path d="m7 4 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      {episodesQuery.isPending ? <LoadingIndicator label="Loading progress…" /> : null}
      {episodesQuery.isError ? (
        <ErrorPanel
          message={errorText(episodesQuery.error, 'Could not load progress')}
          onRetry={() => {
            void episodesQuery.refetch()
          }}
        />
      ) : null}

      {inLibrary ? (
        <section className="w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/55 shadow-lg shadow-black/20 backdrop-blur-sm" aria-labelledby="collection-controls-title">
          <h2 id="collection-controls-title">
            <button
              type="button"
              aria-expanded={isCollectionControlsOpen}
              aria-controls="collection-controls-content"
              onClick={() => setIsCollectionControlsOpen((open) => !open)}
              className="flex w-full min-w-0 items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-zinc-100 transition hover:bg-white/[0.03] sm:px-5"
            >
              <span>Collection controls</span>
              <svg
                viewBox="0 0 20 20"
                aria-hidden="true"
                className={`size-4 shrink-0 text-zinc-400 transition-transform ${isCollectionControlsOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
              >
                <path d="m4 7 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </h2>
          <div
            id="collection-controls-content"
            hidden={!isCollectionControlsOpen}
            className="space-y-4 border-t border-white/[0.08] p-4 sm:p-5"
          >
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">Status</span>
                <span className="text-xs text-zinc-300">
                  {STATUS_LABELS[entryQuery.data?.status ?? 'watching']}
                </span>
              </div>
              <div
                className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"
                role="group"
                aria-label="Change anime status"
              >
                {LIBRARY_STATUSES.map((status) => {
                  const selected = entryQuery.data?.status === status
                  return (
                    <button
                      key={status}
                      type="button"
                      disabled={entryQuery.isPending || updateMutation.isPending}
                      aria-label={`Set status to ${STATUS_LABELS[status]}`}
                      aria-pressed={selected}
                      onClick={() => updateMutation.mutate({ status })}
                      className={cn(
                        'flex h-10 min-w-0 items-center gap-2 rounded-xl border px-3 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/70 disabled:opacity-50',
                        selected
                          ? 'border-indigo-400/40 bg-indigo-500/15 text-indigo-100'
                          : 'border-white/[0.08] bg-zinc-950/30 text-zinc-400 hover:border-white/20 hover:bg-white/[0.04] hover:text-zinc-100',
                      )}
                    >
                      <StatusIcon status={status} />
                      <span className="truncate">{STATUS_LABELS[status]}</span>
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
              <div className="space-y-1.5">
                <span className="block text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">Rating</span>
                <StarRating
                  value={entryQuery.data?.score ?? null}
                  disabled={entryQuery.isPending || updateMutation.isPending}
                  onChange={(score) => updateMutation.mutate({ score })}
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={entryQuery.isPending || updateMutation.isPending || resetProgressMutation.isPending}
                  aria-label={entryQuery.data?.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                  aria-pressed={entryQuery.data?.is_favorite ?? false}
                  title={entryQuery.data?.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                  onClick={() =>
                    updateMutation.mutate({ is_favorite: !(entryQuery.data?.is_favorite ?? false) })
                  }
                  className={cn(
                    'inline-flex h-10 items-center gap-2 rounded-full border px-3 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200/60 disabled:opacity-50',
                    entryQuery.data?.is_favorite
                      ? 'border-rose-300/30 bg-rose-400/15 text-rose-200'
                      : 'border-white/10 bg-zinc-950/40 text-zinc-400 hover:border-rose-300/25 hover:text-rose-200',
                  )}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
                    <path
                      d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"
                      fill={entryQuery.data?.is_favorite ? 'currentColor' : 'none'}
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>{entryQuery.data?.is_favorite ? 'Favorited' : 'Favorite'}</span>
                </button>
                <button
                  type="button"
                  disabled={watchedCount === 0 || resetProgressMutation.isPending || updateMutation.isPending}
                  aria-label="Reset episode progress"
                  title="Reset episode progress"
                  onClick={() => {
                    void onResetProgress()
                  }}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-amber-300/15 bg-amber-400/[0.04] px-3 text-xs font-medium text-amber-100/80 transition hover:border-amber-300/30 hover:bg-amber-400/[0.1] hover:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60 disabled:opacity-40"
                >
                  {resetProgressMutation.isPending ? (
                    <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-amber-100/30 border-t-amber-100" />
                  ) : (
                    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4.2 8A6.3 6.3 0 1 1 4 12" />
                      <path d="M4.2 3.8V8h4.2" />
                    </svg>
                  )}
                  <span>Reset episodes</span>
                </button>
                <button
                  type="button"
                  disabled={removeMutation.isPending || resetProgressMutation.isPending}
                  aria-label="Remove from collection"
                  title="Remove from collection"
                  onClick={() => {
                    void onRemove()
                  }}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-zinc-950/40 px-3 text-xs font-medium text-zinc-400 transition hover:border-rose-300/30 hover:bg-rose-400/[0.06] hover:text-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200/60 disabled:opacity-50"
                >
                  <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4 fill-current">
                    <path d="M7.5 2.5h5l.5 1.5H16a1 1 0 1 1 0 2h-.6l-.7 10.1A2 2 0 0 1 12.7 18H7.3a2 2 0 0 1-2-1.9L4.6 6H4a1 1 0 1 1 0-2h3zm-1 3.5.6 9.5h6.8l.6-9.5zM8.5 8a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0V9a1 1 0 0 1 1-1zm3 0a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0V9a1 1 0 0 1 1-1z" />
                  </svg>
                  <span>Remove</span>
                </button>
              </div>
            </div>
          </div>
          </div>
        </section>
      ) : null}

      {actionError ? <p className="text-sm text-red-400">{errorText(actionError, 'Could not save')}</p> : null}

      {inLibrary ? <AnimeSitesSection anilistId={anilistId} /> : null}

      {inLibrary && selectedEpisode != null ? (
        <WatchLinksDialog
          anilistId={anilistId}
          title={title}
          episode={selectedEpisode}
          groupedSources
          watched={episodes.includes(selectedEpisode)}
          pending={episodeMutation.isPending}
          onClose={() => setSelectedEpisode(null)}
          onToggleWatched={() => {
            const episode = selectedEpisode
            episodeMutation.mutate({
              episode,
              watched: !episodes.includes(episode),
            })
          }}
        />
      ) : null}

      {inLibrary ? (
        <div ref={episodeSectionRef} className="scroll-mt-24">
          <EpisodeGrid
            totalEpisodes={total}
            watchedEpisodes={episodes}
            focusEpisode={focusEpisode}
            onJumpToEpisode={setFocusEpisode}
            onMarkUpToEpisode={(episode) => markMutation.mutate(episode)}
            markingPending={markMutation.isPending}
            onSelect={(episode) => {
              setSelectedEpisode(episode)
              setFocusEpisode(episode)
            }}
          />
        </div>
      ) : null}
    </article>
  )
}
