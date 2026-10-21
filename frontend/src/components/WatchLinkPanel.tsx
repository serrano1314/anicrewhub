import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { fetchWatchLinks } from '../api/anime'
import { ApiError } from '../api/client'
import type { WatchLinkSource } from '../types/anime'

const SOURCE_LABEL: Record<WatchLinkSource, string> = {
  saved: 'Your site',
  copied: 'Copied',
  official: 'Official',
  search: 'Search',
}

type WatchLinkPanelProps = {
  anilistId: number
  episode: number
  watched: boolean
  pending: boolean
  onClose: () => void
  onToggleWatched: () => void
}

export function WatchLinkPanel({
  anilistId,
  episode,
  watched,
  pending,
  onClose,
  onToggleWatched,
}: WatchLinkPanelProps) {
  const panelRef = useRef<HTMLElement>(null)
  const linksQuery = useQuery({
    queryKey: ['watch-links', anilistId, episode],
    queryFn: () => fetchWatchLinks(anilistId, episode),
  })

  useEffect(() => {
    panelRef.current?.scrollIntoView({ block: 'nearest' })
  }, [episode])

  const errorMessage =
    linksQuery.error instanceof ApiError ? linksQuery.error.message : 'Could not load watch links'

  return (
    <section
      ref={panelRef}
      aria-label={`Episode ${episode} watch links`}
      className="space-y-3 rounded-xl border border-zinc-700 bg-zinc-900 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold">Episode {episode}</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800"
        >
          Close
        </button>
      </div>
      {linksQuery.isPending ? <p className="text-sm text-zinc-400">Loading links…</p> : null}
      {linksQuery.isError ? <p className="text-sm text-red-400">{errorMessage}</p> : null}
      {linksQuery.data ? (
        <ol className="space-y-2">
          {linksQuery.data.map((link, index) => (
            <li key={`${link.source}-${link.url}-${index}`} className="flex items-center gap-3">
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate text-indigo-300 hover:underline"
              >
                {link.label}
              </a>
              <span className="shrink-0 text-xs uppercase tracking-wide text-zinc-500">
                {SOURCE_LABEL[link.source]}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
      <button
        type="button"
        disabled={pending}
        onClick={onToggleWatched}
        className="rounded-md bg-indigo-500 px-4 py-2 font-medium hover:bg-indigo-400 disabled:opacity-60"
      >
        {pending ? 'Saving…' : watched ? 'Unmark' : 'Mark as watched'}
      </button>
    </section>
  )
}
