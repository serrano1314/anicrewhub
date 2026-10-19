import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchWatchLinks } from '../api/anime'
import { ApiError } from '../api/client'
import type { WatchLinkSource } from '../types/anime'

const SOURCE_LABEL: Record<WatchLinkSource, string> = {
  saved: 'Your site',
  official: 'Official',
  search: 'Search',
}

type WatchLinksDialogProps = {
  anilistId: number
  title: string
  episode: number
  onClose: () => void
}

export function WatchLinksDialog({ anilistId, title, episode, onClose }: WatchLinksDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const linksQuery = useQuery({
    queryKey: ['watch-links', anilistId, episode],
    queryFn: () => fetchWatchLinks(anilistId, episode),
  })

  useEffect(() => {
    closeButtonRef.current?.focus({ preventScroll: true })
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const errorMessage =
    linksQuery.error instanceof ApiError ? linksQuery.error.message : 'Could not load watch links'

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="watch-links-title"
        className="ui-modal-panel max-h-full w-full max-w-lg overflow-y-auto p-5 sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-indigo-300">
              Episode {episode}
            </p>
            <h2 id="watch-links-title" className="mt-1 truncate text-lg font-semibold text-zinc-50">
              {title}
            </h2>
            <p className="mt-1 text-sm text-zinc-400">Choose a link to watch this episode.</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close watch links"
            className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100 focus-visible:outline-2 focus-visible:outline-indigo-300"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5">
              <path
                d="m5 5 10 10M15 5 5 15"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="mt-5 border-t border-white/10 pt-4">
          {linksQuery.isPending ? (
            <p className="py-4 text-center text-sm text-zinc-400">Finding watch links…</p>
          ) : null}
          {linksQuery.isError ? (
            <div className="space-y-3 py-3">
              <p className="text-sm text-red-300" role="alert">{errorMessage}</p>
              <button
                type="button"
                onClick={() => void linksQuery.refetch()}
                className="text-sm font-medium text-indigo-300 hover:text-indigo-200"
              >
                Try again
              </button>
            </div>
          ) : null}
          {linksQuery.data && linksQuery.data.length === 0 ? (
            <p className="py-4 text-center text-sm text-zinc-400">
              No watch links found for this episode yet.
            </p>
          ) : null}
          {linksQuery.data && linksQuery.data.length > 0 ? (
            <ul className="space-y-2">
              {linksQuery.data.map((link, index) => (
                <li key={`${link.source}-${link.url}-${index}`}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-zinc-950/40 px-4 py-3 transition hover:border-indigo-400/30 hover:bg-indigo-500/10"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-indigo-200">
                      {link.label}
                    </span>
                    <span className="shrink-0 text-[10px] uppercase tracking-wider text-zinc-500">
                      {SOURCE_LABEL[link.source]}
                    </span>
                    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 shrink-0 text-zinc-500">
                      <path
                        d="M11 3h6v6m-1-5-8 8M15 11v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>
    </div>,
    document.body,
  )
}
