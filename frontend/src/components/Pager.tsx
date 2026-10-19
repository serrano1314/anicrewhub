import { cn } from '../lib/ui'

type PagerProps = {
  page: number
  hasNext: boolean
  onPage: (page: number) => void
}

export function Pager({ page, hasNext, onPage }: PagerProps) {
  if (page <= 1 && !hasNext) {
    return null
  }

  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        aria-label="Previous page"
        className={cn(
          'inline-flex size-9 items-center justify-center rounded-full text-zinc-400 transition-colors hover:text-zinc-50 disabled:pointer-events-none disabled:opacity-40',
        )}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <span className="text-sm text-zinc-400">Page {page}</span>
      <button
        type="button"
        disabled={!hasNext}
        onClick={() => onPage(page + 1)}
        aria-label="Next page"
        className={cn(
          'inline-flex size-9 items-center justify-center rounded-full text-zinc-400 transition-colors hover:text-zinc-50 disabled:pointer-events-none disabled:opacity-40',
        )}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  )
}
