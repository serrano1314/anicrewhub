import { useLayoutEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

/** Re-mounts routed content on pathname change and plays the enter animation. */
export function PageTransition() {
  const location = useLocation()

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [location.pathname])

  return (
    <div key={location.pathname} className="page-transition-enter w-full">
      <Outlet />
    </div>
  )
}
