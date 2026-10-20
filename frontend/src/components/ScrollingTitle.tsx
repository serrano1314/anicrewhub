import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { cn } from '../lib/ui'

export function ScrollingTitle({
  title,
  className,
}: {
  title: string
  className?: string
}) {
  const containerRef = useRef<HTMLHeadingElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const [scrollDistance, setScrollDistance] = useState(0)

  useEffect(() => {
    const container = containerRef.current
    const text = textRef.current
    if (!container || !text) return

    const measure = () => {
      setScrollDistance(Math.max(0, text.scrollWidth - container.clientWidth))
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    observer.observe(text)
    return () => observer.disconnect()
  }, [title])

  const style: CSSProperties & {
    '--title-scroll-distance'?: string
    '--title-scroll-duration'?: string
  } = scrollDistance > 0
    ? {
        '--title-scroll-distance': `${scrollDistance}px`,
        '--title-scroll-duration': `${Math.max(8, scrollDistance / 24 + 4)}s`,
      }
    : {}

  return (
    <h2
      ref={containerRef}
      title={title}
      className={cn('min-w-0 overflow-hidden whitespace-nowrap font-medium', className)}
      style={{ maskImage: 'linear-gradient(to right, black calc(100% - 1.25rem), transparent)' }}
    >
      <span
        ref={textRef}
        style={style}
        className={cn(
          'inline-block max-w-full truncate align-bottom',
          scrollDistance > 0 && 'library-title-marquee max-w-none',
        )}
      >
        {title}
      </span>
    </h2>
  )
}
