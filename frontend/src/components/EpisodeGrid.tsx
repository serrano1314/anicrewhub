import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  EPISODE_GRID_GAP,
  EPISODE_GRID_PADDING,
  EPISODE_ROW_HEIGHT,
  RANGE_SIZE,
  activeRangeForEpisode,
  columnCount,
  episodeAnchor,
  episodeRanges,
  rangeStartFor,
  rowCount,
  scrollOffsetFor,
  visibleRowRange,
  parseEpisodeInput,
} from '../lib/episodes'
import { UI, cn } from '../lib/ui'

type EpisodeGridProps = {
  totalEpisodes: number | null
  watchedEpisodes: number[]
  focusEpisode: number | null
  onJumpToEpisode: (episode: number) => void
  onMarkUpToEpisode: (episode: number) => void
  markingPending: boolean
  onSelect: (episode: number) => void
}

export function EpisodeGrid({
  totalEpisodes,
  watchedEpisodes,
  focusEpisode,
  onJumpToEpisode,
  onMarkUpToEpisode,
  markingPending,
  onSelect,
}: EpisodeGridProps) {
  const highestWatched = watchedEpisodes.reduce((max, episode) => Math.max(max, episode), 0)
  const [jumpInput, setJumpInput] = useState('')
  const [markInput, setMarkInput] = useState('')
  const [episodeInputError, setEpisodeInputError] = useState<string | null>(null)
  const [openedThrough, setOpenedThrough] = useState(RANGE_SIZE)
  const [selectedStart, setSelectedStart] = useState<number | null>(null)
  const [seenFocus, setSeenFocus] = useState(focusEpisode)
  if (focusEpisode !== seenFocus) {
    setSeenFocus(focusEpisode)
    setSelectedStart(focusEpisode == null ? null : rangeStartFor(focusEpisode))
  }
  const anchorEpisode = episodeAnchor(focusEpisode, watchedEpisodes)
  const highestRelevant = Math.max(highestWatched, anchorEpisode ?? 0, openedThrough)
  const ranges = useMemo(
    () => episodeRanges(totalEpisodes, highestRelevant),
    [highestRelevant, totalEpisodes],
  )
  const totalKnown = totalEpisodes != null && totalEpisodes > 0

  const active = useMemo(
    () => activeRangeForEpisode(ranges, selectedStart, anchorEpisode),
    [anchorEpisode, ranges, selectedStart],
  )

  const watched = useMemo(() => new Set(watchedEpisodes), [watchedEpisodes])
  const scrollRef = useRef<HTMLDivElement>(null)
  const [columns, setColumns] = useState(6)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(320)
  const desiredScroll = active
    ? scrollOffsetFor(anchorEpisode, active.start, active.end, columns)
    : 0
  const scrollKey = `${active?.start ?? 0}:${anchorEpisode ?? ''}:${columns}`
  const [appliedScrollKey, setAppliedScrollKey] = useState(scrollKey)
  if (scrollKey !== appliedScrollKey) {
    setAppliedScrollKey(scrollKey)
    setScrollTop(desiredScroll)
  }

  useEffect(() => {
    const node = scrollRef.current
    if (!node) {
      return
    }
    const update = () => {
      const nextColumns = columnCount(node.clientWidth - EPISODE_GRID_PADDING * 2)
      const nextHeight = node.clientHeight
      setColumns((current) => (current === nextColumns ? current : nextColumns))
      setViewportHeight((current) => (current === nextHeight ? current : nextHeight))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    const node = scrollRef.current
    if (node && node.scrollTop !== desiredScroll) {
      node.scrollTop = desiredScroll
    }
  }, [appliedScrollKey, desiredScroll])

  if (!active) {
    return null
  }

  const episodes = Array.from(
    { length: active.end - active.start + 1 },
    (_, index) => active.start + index,
  )
  const rows = rowCount(episodes.length, columns)
  const visible = visibleRowRange(scrollTop, viewportHeight, EPISODE_ROW_HEIGHT, rows)
  const buttonHeight = EPISODE_ROW_HEIGHT - EPISODE_GRID_GAP
  const contentHeight = EPISODE_GRID_PADDING * 2 + rows * EPISODE_ROW_HEIGHT

  function submitEpisodeInput(
    event: FormEvent<HTMLFormElement>,
    input: string,
    action: (episode: number) => void,
  ) {
    event.preventDefault()
    const episode = parseEpisodeInput(input, totalEpisodes)
    if (episode == null) {
      const maxEpisode = totalKnown ? totalEpisodes : 5000
      setEpisodeInputError(`Enter an episode from 1 to ${maxEpisode}.`)
      return
    }
    setEpisodeInputError(null)
    action(episode)
  }

  return (
    <div className="space-y-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <form
            aria-label="Jump to episode"
            onSubmit={(event) => submitEpisodeInput(event, jumpInput, onJumpToEpisode)}
            className="flex min-w-0 items-center overflow-hidden rounded-full border border-white/10 bg-zinc-950/40 focus-within:border-indigo-300/40 focus-within:ring-2 focus-within:ring-indigo-300/30"
          >
            <label className="sr-only" htmlFor="jump-to-episode">Jump to episode</label>
            <input
              id="jump-to-episode"
              inputMode="numeric"
              value={jumpInput}
              onChange={(event) => {
                setJumpInput(event.target.value)
                setEpisodeInputError(null)
              }}
              placeholder="Jump to #"
              className="h-9 w-24 min-w-0 border-0 bg-transparent px-3 text-xs text-zinc-100 outline-none placeholder:text-zinc-500 focus:ring-0"
            />
            <button type="submit" className="h-9 shrink-0 border-l border-white/10 bg-white/[0.04] px-3 text-xs font-medium text-zinc-200 transition hover:bg-white/10 hover:text-white focus-visible:outline-none">
              Go
            </button>
          </form>
          <form
            aria-label="Mark progress"
            onSubmit={(event) =>
              submitEpisodeInput(event, markInput, onMarkUpToEpisode)
            }
            className="flex min-w-0 items-center overflow-hidden rounded-full border border-indigo-300/20 bg-indigo-400/[0.04] focus-within:border-indigo-300/40 focus-within:ring-2 focus-within:ring-indigo-300/30"
          >
            <label className="sr-only" htmlFor="mark-progress-episode">Mark progress through episode</label>
            <input
              id="mark-progress-episode"
              inputMode="numeric"
              value={markInput}
              onChange={(event) => {
                setMarkInput(event.target.value)
                setEpisodeInputError(null)
              }}
              placeholder="Mark to #"
              className="h-9 w-24 min-w-0 border-0 bg-transparent px-3 text-xs text-zinc-100 outline-none placeholder:text-zinc-500 focus:ring-0"
            />
            <button
              type="submit"
              disabled={markingPending}
              className="h-9 shrink-0 border-l border-indigo-300/15 bg-indigo-400/[0.08] px-3 text-xs font-medium text-indigo-100 transition hover:bg-indigo-400/[0.16] disabled:opacity-50"
            >
              {markingPending ? '…' : 'Mark'}
            </button>
          </form>
        </div>
      </div>
      {episodeInputError ? <p className="text-sm text-red-400" role="alert">{episodeInputError}</p> : null}
      <div className="ui-tablist" role="tablist" aria-label="Episode ranges">
        {ranges.map((range) => {
          const selected = range.start === active.start
          return (
            <button
              key={range.start}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setSelectedStart(range.start)}
              className={cn(UI.pill, selected && UI.pillActive)}
            >
              {range.start}–{range.end}
            </button>
          )
        })}
        {totalKnown ? null : (
          <button
            type="button"
            onClick={() => setOpenedThrough((current) => Math.max(current, active.end) + RANGE_SIZE)}
            className={cn(UI.pill, 'ui-pill-dashed')}
          >
            Next 100
          </button>
        )}
      </div>
      <div
        ref={scrollRef}
        className={UI.episodePanel}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        <div className="relative" style={{ height: contentHeight }}>
          {Array.from({ length: visible.end - visible.start }, (_, offset) => {
            const rowIndex = visible.start + offset
            const rowStart = rowIndex * columns
            const rowEpisodes = episodes.slice(rowStart, rowStart + columns)
            return (
              <div
                key={rowIndex}
                className="absolute grid"
                style={{
                  top: EPISODE_GRID_PADDING + rowIndex * EPISODE_ROW_HEIGHT,
                  left: EPISODE_GRID_PADDING,
                  right: EPISODE_GRID_PADDING,
                  height: buttonHeight,
                  gap: EPISODE_GRID_GAP,
                  gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                }}
              >
                {rowEpisodes.map((episode) => {
                  const isWatched = watched.has(episode)
                  const focused = episode === anchorEpisode
                  return (
                    <button
                      key={episode}
                      type="button"
                      aria-pressed={isWatched}
                      aria-current={focused ? 'true' : undefined}
                      onClick={() => onSelect(episode)}
                      className={cn(
                        isWatched ? UI.episodeBtnWatched : UI.episodeBtn,
                        focused && 'ui-episode-btn-focus',
                      )}
                    >
                      {episode}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
      <p className="text-xs text-zinc-500">
        Filled numbers are watched. Click a number to open watch links.
      </p>
    </div>
  )
}
