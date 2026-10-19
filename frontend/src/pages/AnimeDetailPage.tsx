import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { BackLink } from '../components/BackLink'
import { fetchAnime } from '../api/anime'
import { ApiError } from '../api/client'
import {
  addToLibrary,
  fetchWatchedEpisodes,
  findLibraryEntry,
  markUpTo,
  removeFromLibrary,
  setEpisodeWatched,
  updateLibrary,
} from '../api/library'
import { AnimeSitesSection } from '../components/AnimeSitesSection'
import { ErrorPanel, LoadingIndicator } from '../components/PageStatus'
import { EpisodeGrid } from '../components/EpisodeGrid'
import { ProgressMeter } from '../components/ProgressMeter'
import { WatchLinkPanel } from '../components/WatchLinkPanel'
import { useDialog } from '../components/dialogContext'
import { airingLabel, displayTitle, formatLabel } from '../lib/display'
import { episodeCountLabel, knownTotal, parseEpisodeInput } from '../lib/episodes'
import { INPUT_PLACEHOLDERS } from '../lib/placeholders'
import { Select } from '../components/Select'
import { libraryStatusSelectOptions, scoreSelectOptions } from '../lib/selectOptions'
import { UI, cn } from '../lib/ui'
import type { BackTarget } from '../lib/navigation'

const DEFAULT_BACK: BackTarget = { label: 'Back to My List', to: '/' }
import type { LibraryStatus } from '../types/library'

function errorText(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}

export function AnimeDetailPage() {
  const params = useParams()
  const rawId = Number(params.anilistId)
  const anilistId = Number.isInteger(rawId) && rawId >= 1 ? rawId : null
  const queryClient = useQueryClient()
  const dialog = useDialog()
  const [addStatus, setAddStatus] = useState<LibraryStatus>('watching')
  const [markInput, setMarkInput] = useState('')
  const [jumpInput, setJumpInput] = useState('')
  const [focusEpisode, setFocusEpisode] = useState<number | null>(null)
  const [selectedEpisode, setSelectedEpisode] = useState<number | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const animeQuery = useQuery({
    queryKey: ['anime', anilistId],
    queryFn: () => fetchAnime(anilistId as number),
    enabled: anilistId != null,
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
    queryFn: () => findLibraryEntry(anilistId as number),
    enabled: anilistId != null && inLibrary,
    retry: false,
  })

  async function refreshProgress() {
    await queryClient.invalidateQueries({ queryKey: ['library'] })
    await queryClient.invalidateQueries({ queryKey: ['episodes', anilistId] })
    await queryClient.invalidateQueries({ queryKey: ['library-entry', anilistId] })
  }

  const addMutation = useMutation({
    mutationFn: () => addToLibrary(anilistId as number, addStatus),
    onSuccess: refreshProgress,
  })

  const updateMutation = useMutation({
    mutationFn: (body: { status?: LibraryStatus; score?: number | null; is_favorite?: boolean }) =>
      updateLibrary(anilistId as number, body),
    onSuccess: refreshProgress,
  })

  const removeMutation = useMutation({
    mutationFn: () => removeFromLibrary(anilistId as number),
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
      setFormError(null)
      await refreshProgress()
    },
  })

  const markMutation = useMutation({
    mutationFn: (episode: number) => markUpTo(anilistId as number, episode),
    onSuccess: async (_data, episode) => {
      setFocusEpisode(episode)
      setFormError(null)
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
  const maxEpisode = knownTotal(total) ?? 5000
  const actionError = episodeMutation.error ?? markMutation.error ?? addMutation.error ?? updateMutation.error

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

  function onMarkUpTo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const episode = parseEpisodeInput(markInput, total)
    if (episode == null) {
      setFormError(`Enter an episode from 1 to ${maxEpisode}.`)
      return
    }
    setFormError(null)
    markMutation.mutate(episode)
  }

  function onJump(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const episode = parseEpisodeInput(jumpInput, total)
    if (episode == null) {
      setFormError(`Jump to an episode from 1 to ${maxEpisode}.`)
      return
    }
    setFormError(null)
    setFocusEpisode(episode)
  }

  return (
    <article className="space-y-6">
      <BackLink fallback={DEFAULT_BACK} />
      <div className="flex flex-col gap-4 sm:flex-row">
        {anime.cover_url ? (
          <img
            src={anime.cover_url}
            alt=""
            className="h-56 w-40 rounded-2xl object-cover shadow-lg shadow-black/40 ring-1 ring-white/10"
          />
        ) : (
          <div className="h-56 w-40 rounded-lg bg-zinc-800" />
        )}
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
            {anime.title_english && anime.title_romaji !== title ? (
              <p className="text-sm text-zinc-400">{anime.title_romaji}</p>
            ) : null}
            <p className="mt-1 text-sm text-zinc-400">
              {[formatLabel(anime.format), anime.season_year, airingLabel(anime.airing_status)]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          {inLibrary ? (
            <ProgressMeter
              watchedCount={watchedCount}
              totalEpisodes={total}
              lastEpisodeWatched={lastEpisode}
            />
          ) : (
            <p className="text-sm text-zinc-400">{episodeCountLabel(total)}</p>
          )}
        </div>
      </div>

      {episodesQuery.isPending ? <LoadingIndicator label="Loading progress…" /> : null}
      {episodesQuery.isError ? (
        <ErrorPanel
          message={errorText(episodesQuery.error, 'Could not load progress')}
          onRetry={() => {
            void episodesQuery.refetch()
          }}
        />
      ) : null}

      {!inLibrary && !episodesQuery.isPending ? (
        <form
          className={cn(UI.card, 'flex flex-col gap-4 sm:flex-row sm:items-end')}
          onSubmit={(event) => {
            event.preventDefault()
            addMutation.mutate()
          }}
        >
          <label className="block flex-1 space-y-1.5">
            <span className={UI.fieldLabel}>Add to list</span>
            <Select
              value={addStatus}
              onChange={(value) => setAddStatus(value as LibraryStatus)}
              options={libraryStatusSelectOptions()}
            />
          </label>
          <button
            type="submit"
            disabled={addMutation.isPending}
            className={cn(UI.btn, UI.btnPrimary)}
          >
            {addMutation.isPending ? 'Adding…' : 'Add to list'}
          </button>
        </form>
      ) : null}

      {inLibrary ? (
        <div className={cn(UI.card, 'space-y-5')}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className={UI.fieldLabel}>Status</span>
              <Select
                value={entryQuery.data?.status ?? 'watching'}
                disabled={entryQuery.isPending || updateMutation.isPending}
                onChange={(value) => updateMutation.mutate({ status: value as LibraryStatus })}
                options={libraryStatusSelectOptions()}
              />
            </label>
            <label className="block space-y-1.5">
              <span className={UI.fieldLabel}>Score</span>
              <Select
                value={entryQuery.data?.score != null ? String(entryQuery.data.score) : ''}
                disabled={entryQuery.isPending || updateMutation.isPending}
                onChange={(value) =>
                  updateMutation.mutate({ score: value === '' ? null : Number(value) })
                }
                options={scoreSelectOptions()}
              />
            </label>
          </div>
          <button
            type="button"
            disabled={entryQuery.isPending || updateMutation.isPending}
            aria-pressed={entryQuery.data?.is_favorite ?? false}
            onClick={() =>
              updateMutation.mutate({ is_favorite: !(entryQuery.data?.is_favorite ?? false) })
            }
            className={cn(
              UI.btn,
              entryQuery.data?.is_favorite ? 'border border-rose-400/30 bg-rose-500/15 text-rose-100' : UI.btnSecondary,
            )}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="mr-2 h-4 w-4">
              <path
                d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"
                fill={entryQuery.data?.is_favorite ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {entryQuery.data?.is_favorite ? 'Favorite' : 'Add to favorites'}
          </button>
          <form onSubmit={onMarkUpTo} className="flex flex-col gap-2 sm:flex-row">
            <label className="block flex-1 space-y-1.5">
              <span className={UI.fieldLabel}>I watched up to episode</span>
              <input
                inputMode="numeric"
                value={markInput}
                onChange={(event) => setMarkInput(event.target.value)}
                placeholder={INPUT_PLACEHOLDERS.episodeNumber}
                className={UI.input}
              />
            </label>
            <button
              type="submit"
              disabled={markMutation.isPending}
              className={cn(UI.btn, UI.btnPrimary, 'sm:self-end')}
            >
              {markMutation.isPending ? 'Saving…' : 'Mark up to'}
            </button>
          </form>
          <form onSubmit={onJump} className="flex flex-col gap-2 sm:flex-row">
            <label className="block flex-1 space-y-1.5">
              <span className={UI.fieldLabel}>Jump to episode</span>
              <input
                inputMode="numeric"
                value={jumpInput}
                onChange={(event) => setJumpInput(event.target.value)}
                placeholder={INPUT_PLACEHOLDERS.episodeNumber}
                className={UI.input}
              />
            </label>
            <button type="submit" className={cn(UI.btn, UI.btnSecondary, 'sm:self-end')}>
              Jump
            </button>
          </form>
          <div className="border-t border-white/10 pt-5">
            <button
              type="button"
              disabled={removeMutation.isPending}
              onClick={() => {
                void onRemove()
              }}
              className={cn(UI.btn, UI.btnDangerSoft)}
            >
              <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 fill-current">
                <path d="M7.5 2.5h5l.5 1.5H16a1 1 0 1 1 0 2h-.6l-.7 10.1A2 2 0 0 1 12.7 18H7.3a2 2 0 0 1-2-1.9L4.6 6H4a1 1 0 1 1 0-2h3zm-1 3.5.6 9.5h6.8l.6-9.5zM8.5 8a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0V9a1 1 0 0 1 1-1zm3 0a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0V9a1 1 0 0 1 1-1z" />
              </svg>
              {removeMutation.isPending ? 'Removing…' : 'Remove from list'}
            </button>
          </div>
        </div>
      ) : null}

      {formError ? <p className="text-sm text-red-400">{formError}</p> : null}
      {actionError ? <p className="text-sm text-red-400">{errorText(actionError, 'Could not save')}</p> : null}

      {inLibrary ? <AnimeSitesSection anilistId={anilistId} /> : null}

      {inLibrary && selectedEpisode != null ? (
        <WatchLinkPanel
          anilistId={anilistId}
          episode={selectedEpisode}
          watched={episodes.includes(selectedEpisode)}
          pending={episodeMutation.isPending}
          onClose={() => setSelectedEpisode(null)}
          onToggleWatched={() =>
            episodeMutation.mutate({
              episode: selectedEpisode,
              watched: !episodes.includes(selectedEpisode),
            })
          }
        />
      ) : null}

      {inLibrary ? (
        <EpisodeGrid
          totalEpisodes={total}
          watchedEpisodes={episodes}
          focusEpisode={focusEpisode}
          onSelect={(episode) => {
            setSelectedEpisode(episode)
            setFocusEpisode(episode)
          }}
        />
      ) : null}
    </article>
  )
}
