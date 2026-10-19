import { cn } from '../lib/ui'

type PagerProps = {
  page: number
  hasNext: boolean
  totalCount?: number
  totalPages?: number
  onPage: (page: number) => void
}

export function Pager({ page, hasNext, totalCount, totalPages, onPage }: PagerProps) {
  if (page <= 1 && !hasNext && totalCount == null) {
    return null
  }

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 pt-3">
      <div className="flex flex-wrap items-center gap-2 text-sm tabular-nums">
        {totalCount != null ? (
          <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/10 bg-zinc-900/60 px-3 text-zinc-300">
            <span className="text-zinc-500">Saved</span>
            <span className="font-semibold text-zinc-100">{totalCount}</span>
          </span>
        ) : null}
        <span
          aria-current="page"
          aria-label={
            totalPages != null ? `Page ${page} of ${totalPages}` : `Page ${page}`
          }
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 text-indigo-100"
        >
          <span className="text-indigo-300">Page</span>
          <span className="font-semibold">{page}</span>
          {totalPages != null ? <span className="text-indigo-200/70">/ {totalPages}</span> : null}
        </span>
      </div>
      <div className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-zinc-900/60 p-1 shadow-lg shadow-black/20 backdrop-blur-sm">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Previous page"
          title="Previous page"
          className={cn(
            'inline-flex size-9 items-center justify-center rounded-full text-zinc-300 transition-colors hover:bg-white/8 hover:text-zinc-50 disabled:pointer-events-none disabled:opacity-35',
          )}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          disabled={!hasNext}
          onClick={() => onPage(page + 1)}
          aria-label="Next page"
          title="Next page"
          className={cn(
            'inline-flex size-9 items-center justify-center rounded-full text-zinc-300 transition-colors hover:bg-white/8 hover:text-zinc-50 disabled:pointer-events-none disabled:opacity-35',
          )}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </nav>
  )
}
