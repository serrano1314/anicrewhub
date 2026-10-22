import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchWatchLinks } from '../api/anime'
import { ApiError } from '../api/client'
import type { WatchLinkSource } from '../types/anime'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import { getPreferredWatchLinkGroup } from '../lib/watchLinkPreferences'
import { UI, cn } from '../lib/ui'
import type { WatchLink } from '../types/anime'

const SOURCE_LABEL: Record<WatchLinkSource, string> = {
  saved: 'Your site',
  copied: 'Copied',
  official: 'Official',
  search: 'Search',
}

type WatchLinksDialogProps = {
  anilistId: number
  title: string
  episode: number
  onClose: () => void
  groupedSources?: boolean
  watched?: boolean
  pending?: boolean
  onToggleWatched?: () => void
}

export function WatchLinksDialog({
  anilistId,
  title,
  episode,
  onClose,
  groupedSources = false,
  watched,
  pending = false,
  onToggleWatched,
}: WatchLinksDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const copiedLinkRef = useRef<WatchLink | null>(null)
  const copiedSettledRef = useRef(false)
  const [copiedPrompt, setCopiedPrompt] = useState<WatchLink | null>(null)
  const [copiedSecondsLeft, setCopiedSecondsLeft] = useState(10)
  const [copiedBarShrinking, setCopiedBarShrinking] = useState(false)
  const preferredGroup = getPreferredWatchLinkGroup()
  useBodyScrollLock(true)
  const linksQuery = useQuery({
    queryKey: ['watch-links', anilistId, episode],
    queryFn: () => fetchWatchLinks(anilistId, episode),
  })

  function finishCopiedPrompt(openSite: boolean) {
    if (copiedSettledRef.current) {
      return
    }
    copiedSettledRef.current = true
    const link = copiedLinkRef.current
    copiedLinkRef.current = null
    setCopiedBarShrinking(false)
    setCopiedPrompt(null)
    if (openSite && link) {
      window.open(link.url, '_blank', 'noopener,noreferrer')
    }
  }

  function askBeforeCopiedSite(link: WatchLink) {
    copiedSettledRef.current = false
    copiedLinkRef.current = link
    setCopiedSecondsLeft(10)
    setCopiedBarShrinking(false)
    setCopiedPrompt(link)
  }

  useEffect(() => {
    closeButtonRef.current?.focus({ preventScroll: true })
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') {
        return
      }
      if (copiedLinkRef.current) {
        finishCopiedPrompt(false)
        return
      }
      onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    if (!copiedPrompt) {
      return
    }
    setCopiedSecondsLeft(10)
    const frame = window.requestAnimationFrame(() => setCopiedBarShrinking(true))
    const started = Date.now()
    const timer = window.setInterval(() => {
      const left = Math.max(0, 10 - Math.floor((Date.now() - started) / 1000))
      if (left === 0) {
        window.clearInterval(timer)
        finishCopiedPrompt(true)
        return
      }
      setCopiedSecondsLeft(left)
    }, 200)
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearInterval(timer)
    }
  }, [copiedPrompt])

  const errorMessage =
    linksQuery.error instanceof ApiError ? linksQuery.error.message : 'Could not load watch links'
  const savedLinks = linksQuery.data?.filter((link) => link.source === 'saved') ?? []
  const copiedLinks = linksQuery.data?.filter((link) => link.source === 'copied') ?? []
  const officialLinks = linksQuery.data?.filter((link) => link.source === 'official') ?? []
  const searchLinks = linksQuery.data?.filter((link) => link.source === 'search') ?? []

  function renderLinks(links: typeof linksQuery.data) {
    if (!links?.length) {
      return (
        <p className="py-3 text-sm text-zinc-400">
          No links found in this category for this episode.
        </p>
      )
    }
    return (
      <ul className="space-y-2">
        {links.map((link, index) => (
          <li key={`${link.source}-${link.url}-${index}`}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => {
                if (link.source !== 'copied') {
                  return
                }
                event.preventDefault()
                askBeforeCopiedSite(link)
              }}
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
    )
  }

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
          {groupedSources && linksQuery.data?.length ? (
            <div className="space-y-3">
              {savedLinks.length > 0 ? (
                <>
                  <details open={preferredGroup === 'saved'} className="group overflow-hidden rounded-xl border border-white/10 bg-zinc-950/25">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-zinc-100 marker:hidden">
                      <span>Your added sites</span>
                      <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4 shrink-0 text-zinc-400 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.7">
                        <path d="m4 7 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </summary>
                    <div className="border-t border-white/10 p-3">{renderLinks(savedLinks)}</div>
                  </details>
                  {copiedLinks.length > 0 ? (
                    <details open={preferredGroup === 'copied'} className="group overflow-hidden rounded-xl border border-white/10 bg-zinc-950/25">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-zinc-100 marker:hidden">
                        <span>Copied sites</span>
                        <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4 shrink-0 text-zinc-400 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.7">
                          <path d="m4 7 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </summary>
                      <div className="border-t border-white/10 p-3">{renderLinks(copiedLinks)}</div>
                    </details>
                  ) : null}
                  <details open={preferredGroup === 'official'} className="group overflow-hidden rounded-xl border border-white/10 bg-zinc-950/25">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-zinc-100 marker:hidden">
                      <span>Official links</span>
                      <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4 shrink-0 text-zinc-400 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.7">
                        <path d="m4 7 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </summary>
                    <div className="space-y-3 border-t border-white/10 p-3">
                      {officialLinks.length ? renderLinks(officialLinks) : (
                        <p className="py-2 text-sm text-zinc-400">No official streaming links available.</p>
                      )}
                      {searchLinks.length ? (
                        <div>
                          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">Search</p>
                          {renderLinks(searchLinks)}
                        </div>
                      ) : null}
                    </div>
                  </details>
                </>
              ) : (
                <>
                  {copiedLinks.length > 0 ? (
                    <details open={preferredGroup === 'copied'} className="group overflow-hidden rounded-xl border border-white/10 bg-zinc-950/25">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-zinc-100 marker:hidden">
                        <span>Copied sites</span>
                        <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4 shrink-0 text-zinc-400 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.7">
                          <path d="m4 7 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </summary>
                      <div className="border-t border-white/10 p-3">{renderLinks(copiedLinks)}</div>
                    </details>
                  ) : null}
                  <details open className="group overflow-hidden rounded-xl border border-white/10 bg-zinc-950/25">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-zinc-100 marker:hidden">
                      <span>Official links</span>
                      <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4 shrink-0 text-zinc-400 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.7">
                        <path d="m4 7 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </summary>
                    <div className="space-y-3 border-t border-white/10 p-3">
                      {officialLinks.length ? renderLinks(officialLinks) : (
                        <p className="py-2 text-sm text-zinc-400">No official streaming links available.</p>
                      )}
                      {searchLinks.length ? (
                        <div>
                          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">Search</p>
                          {renderLinks(searchLinks)}
                        </div>
                      ) : null}
                    </div>
                  </details>
                </>
              )}
            </div>
          ) : linksQuery.data && linksQuery.data.length > 0 ? (
            renderLinks(linksQuery.data)
          ) : null}
        </div>
        {copiedPrompt ? (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 px-4 backdrop-blur-[2px]">
            <section
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="copied-site-title"
              aria-describedby="copied-site-message"
              className="ui-modal-panel w-full max-w-md p-6"
            >
              <p className={UI.eyebrow}>Copied site</p>
              <h2 id="copied-site-title" className="mt-2 text-lg font-semibold text-zinc-50">
                {"You will redirect to "}
                {/* wrap text span */}
                <span className="break-all text-indigo-300">{copiedPrompt.url}</span>
                {/* {copiedPrompt.url} */}
              </h2>
              <p id="copied-site-message" className="mt-2 text-sm leading-relaxed text-zinc-300">
                This address was copied from another user. It can change, stop working, or be unsafe. It opens automatically in {copiedSecondsLeft} {copiedSecondsLeft === 1 ? 'second' : 'seconds'} if you do nothing.
              </p>
              <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                <div
                  className="h-full origin-left bg-amber-300"
                  style={{
                    transform: copiedBarShrinking ? 'scaleX(0)' : 'scaleX(1)',
                    transition: copiedBarShrinking ? 'transform 10s linear' : 'none',
                  }}
                />
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => finishCopiedPrompt(false)} className={cn(UI.btn, UI.btnSecondary)}>
                  Stay here
                </button>
                <button type="button" onClick={() => finishCopiedPrompt(true)} className={cn(UI.btn, UI.btnPrimary)}>
                  Open now
                </button>
              </div>
            </section>
          </div>
        ) : null}
        {onToggleWatched ? (
          <div className="mt-4 border-t border-white/10 pt-4">
            <button
              type="button"
              disabled={pending}
              onClick={onToggleWatched}
              className="w-full rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-60"
            >
              {pending ? 'Saving…' : watched ? 'Mark as unwatched' : 'Mark as watched'}
            </button>
          </div>
        ) : null}
      </section>
    </div>,
    document.body,
  )
}
