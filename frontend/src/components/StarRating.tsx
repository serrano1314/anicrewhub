import { useState } from 'react'
import { cn } from '../lib/ui'

type StarRatingProps = {
  value: number | null
  onChange?: (value: number | null) => void
  disabled?: boolean
  readOnly?: boolean
  showValue?: boolean
}

export function StarRating({
  value,
  onChange,
  disabled = false,
  readOnly = false,
  showValue = true,
}: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null)
  const activeValue = hoverValue ?? value ?? 0
  const ratingLabel = String(activeValue / 2)

  return (
    <div
      role={readOnly ? 'img' : 'group'}
      aria-label={
        readOnly
          ? value == null
            ? 'Not rated'
            : `Rated ${value} out of 10`
          : 'Anime rating, from half a star to five stars'
      }
      className="flex items-center gap-0.5"
      onMouseLeave={() => setHoverValue(null)}
    >
      {!readOnly && showValue ? (
        <button
          type="button"
          aria-label={`Clear rating; ${ratingLabel} out of 5 stars`}
          aria-pressed={value == null}
          title={`Clear rating · ${ratingLabel}/5 stars`}
          disabled={disabled}
          onMouseEnter={() => setHoverValue(0)}
          onFocus={() => setHoverValue(0)}
          onBlur={() => setHoverValue(null)}
          onClick={() => onChange?.(null)}
          className={cn(
            'mr-1 rounded px-1 text-xs tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-indigo-300',
            value == null ? 'text-amber-300' : 'text-zinc-500 hover:text-zinc-200',
          )}
        >
          {ratingLabel}
        </button>
      ) : null}
      {Array.from({ length: 5 }, (_, index) => {
        const star = index + 1
        const fill = Math.max(0, Math.min(100, ((activeValue - (index * 2)) / 2) * 100))
        return (
          <span key={star} className="relative h-5 w-5">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="absolute inset-0 h-full w-full text-zinc-700">
              <path
                d="m12 2.5 2.93 5.94 6.56.95-4.75 4.63 1.12 6.54L12 17.47l-5.86 3.09 1.12-6.54-4.75-4.63 6.56-.95z"
                fill="currentColor"
              />
            </svg>
            <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${fill}%` }}>
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 text-amber-300">
                <path
                  d="m12 2.5 2.93 5.94 6.56.95-4.75 4.63 1.12 6.54L12 17.47l-5.86 3.09 1.12-6.54-4.75-4.63 6.56-.95z"
                  fill="currentColor"
                />
              </svg>
            </span>
            {!readOnly
              ? [1, 2].map((half) => {
                  const rating = index * 2 + half
                  return (
                    <button
                      key={rating}
                      type="button"
                      aria-label={`Rate ${rating} out of 10`}
                      aria-pressed={value === rating}
                      title={`${rating}/10`}
                      disabled={disabled}
                      onMouseEnter={() => setHoverValue(rating)}
                      onFocus={() => setHoverValue(rating)}
                      onBlur={() => setHoverValue(null)}
                      onClick={() => onChange?.(rating)}
                      className={cn(
                        'absolute inset-y-0 z-10 w-1/2 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-indigo-300',
                        half === 1 ? 'left-0' : 'right-0',
                      )}
                    />
                  )
                })
              : null}
          </span>
        )
      })}
    </div>
  )
}
