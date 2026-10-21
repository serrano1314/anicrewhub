import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { AnimeDetailLocationState, BackTarget } from '../lib/navigation'

type BackLinkProps = {
  fallback?: BackTarget
}

export function BackLink({ fallback }: BackLinkProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state as AnimeDetailLocationState | null
  const target = state?.back ?? fallback

  const className =
    'inline-flex items-center gap-1.5 rounded-md text-sm text-zinc-300 hover:text-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 pt-10'

  const icon = (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M11.8 4.2a1 1 0 0 1 0 1.4L7.4 10l4.4 4.4a1 1 0 1 1-1.4 1.4l-5.1-5.1a1 1 0 0 1 0-1.4l5.1-5.1a1 1 0 0 1 1.4 0z" />
    </svg>
  )

  if (target) {
    return (
      <Link to={target.to} className={className}>
        {icon}
        {target.label}
      </Link>
    )
  }

  return (
    <button
      type="button"
      onClick={() => navigate(-1)}
      className={className}
    >
      {icon}
      Back
    </button>
  )
}
