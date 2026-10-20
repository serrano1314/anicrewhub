import { useEffect } from 'react'

let activeLocks = 0
let previousHtmlOverflow = ''
let previousBodyOverflow = ''
let previousBodyPaddingRight = ''

export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return

    const html = document.documentElement
    const body = document.body
    if (activeLocks === 0) {
      previousHtmlOverflow = html.style.overflow
      previousBodyOverflow = body.style.overflow
      previousBodyPaddingRight = body.style.paddingRight

      const scrollbarWidth = window.innerWidth - html.clientWidth
      const bodyPaddingRight = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0

      html.style.overflow = 'hidden'
      body.style.overflow = 'hidden'
      if (scrollbarWidth > 0) {
        body.style.paddingRight = `${bodyPaddingRight + scrollbarWidth}px`
      }
    }
    activeLocks += 1

    return () => {
      activeLocks -= 1
      if (activeLocks === 0) {
        html.style.overflow = previousHtmlOverflow
        body.style.overflow = previousBodyOverflow
        body.style.paddingRight = previousBodyPaddingRight
      }
    }
  }, [active])
}
