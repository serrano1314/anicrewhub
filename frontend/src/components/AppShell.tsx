import { useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { PageTransition } from './PageTransition'
import { ProfileAvatar } from './ProfileAvatar'
import { ProfileModal } from './ProfileModal'
import { useAuth } from '../auth/AuthProvider'
import { useDialog } from './dialogContext'

type NavItem = {
  to: string
  end?: boolean
  label: string
  icon: (props: { active: boolean }) => ReactNode
}

function navClass(active: boolean, compact = false): string {
  const base = compact
    ? 'relative z-10 flex flex-1 items-center justify-center rounded-full px-3 py-2.5 transition-colors duration-200 ease-out'
    : 'relative z-10 inline-flex items-center justify-center rounded-full px-3.5 py-2 transition-colors duration-200 ease-out'
  if (active) {
    return `${base} text-indigo-100`
  }
  return `${base} text-zinc-400 hover:text-zinc-100`
}

const NAV_ITEMS: NavItem[] = [
  {
    to: '/',
    end: true,
    label: 'My List',
    icon: ({ active }) => (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={`h-5 w-5 ${active ? 'stroke-indigo-200' : 'stroke-current'}`} fill="none" strokeWidth="1.8">
        <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: '/search',
    label: 'Search',
    icon: ({ active }) => (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={`h-5 w-5 ${active ? 'stroke-indigo-200' : 'stroke-current'}`} fill="none" strokeWidth="1.8">
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="M15.25 15.25L19.5 19.5" strokeLinecap="round" />
        <line x1="10.5" y1="7.75" x2="10.5" y2="13.25" strokeLinecap="round" />
        <line x1="7.75" y1="10.5" x2="13.25" y2="10.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: ({ active }) => (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={`h-5 w-5 ${active ? 'stroke-indigo-200' : 'stroke-current'}`} fill="none" strokeWidth="1.8">
        <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
        <path
          d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2.1 2.1 0 0 1-1.5 3.6 2.1 2.1 0 0 1-1.5-.6l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V22a2.1 2.1 0 0 1-4.2 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2.1 2.1 0 0 1-3-3l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H2.1a2.1 2.1 0 0 1 0-4.2h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2.1 2.1 0 0 1 3-3l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V2.1a2.1 2.1 0 0 1 4.2 0v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2.1 2.1 0 0 1 3 3l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H22a2.1 2.1 0 0 1 0 4.2h-.2a1.7 1.7 0 0 0-1.5 1z"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
]

function NavigationItems({ compact = false }: { compact?: boolean }) {
  const { pathname } = useLocation()
  const activeIndex = Math.max(
    0,
    NAV_ITEMS.findIndex((item) => (item.end ? pathname === item.to : pathname.startsWith(item.to))),
  )

  return (
    <>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-full bg-indigo-500/20 ring-1 ring-indigo-400/30 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ transform: `translateX(${activeIndex * 100}%)` }}
      />
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          aria-label={item.label}
          title={item.label}
          className={({ isActive }) => navClass(isActive, compact)}
        >
          {({ isActive }) => (
            <>
              {item.icon({ active: isActive })}
            </>
          )}
        </NavLink>
      ))}
    </>
  )
}

export function AppShell() {
  const { user, logout } = useAuth()
  const dialog = useDialog()
  const [profileOpen, setProfileOpen] = useState(false)

  async function onLogout() {
    const confirmed = await dialog.confirm({
      title: 'Log out?',
      message: 'You can sign back in at any time to continue tracking your anime.',
      confirmLabel: 'Log out',
      tone: 'danger',
    })
    if (confirmed) {
      await logout()
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.12),_transparent_55%)]" />
      <header className="relative sticky top-0 z-40 border-b border-white/5 bg-zinc-950/75 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 sm:gap-4">
          <NavLink
            to="/"
            end
            className="flex shrink-0 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/15 ring-1 ring-indigo-400/20">
              <img src="/favicon.svg" alt="" className="h-5 w-5" />
            </span>
            <span className="hidden font-semibold tracking-tight sm:inline">Anime Tracker</span>
          </NavLink>

          <nav
            className="relative mx-auto hidden w-40 grid-cols-3 items-center rounded-full border border-white/10 bg-zinc-900/50 p-1 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] md:grid md:mx-auto md:fixed md:left-1/2 md:-translate-x-1/2 md:top-16 md:z-50 md:bg-zinc-900/90 md:backdrop-blur-xl md:shadow-xl md:border-white/15"
            aria-label="Main"
          >
            <NavigationItems />
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <button
                type="button"
                onClick={() => setProfileOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={profileOpen}
                className="flex max-w-[11rem] items-center gap-2 rounded-full border border-white/10 bg-zinc-900/60 px-2.5 py-1.5 text-left transition-colors hover:border-white/20 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50"
                title={user.email}
              >
                <ProfileAvatar username={user.username} size="sm" />
                <span className="truncate text-sm text-zinc-300">{user.username}</span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                void onLogout()
              }}
              className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-zinc-900/60 text-zinc-300/65 transition-colors hover:border-white/20 hover:bg-zinc-800 hover:text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50"
              aria-label="Log out"
              title="Log out"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5" aria-hidden="true">
                <path d="M10 17l5-5-5-5" />
                <path d="M15 12H3" />
                <path d="M13 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {user ? (
        <ProfileModal open={profileOpen} user={user} onClose={() => setProfileOpen(false)} />
      ) : null}

      <main className="relative mx-auto w-full max-w-5xl px-4 py-8 pb-32 md:pb-10">
        <PageTransition />
      </main>

      <nav
        className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4 pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Main"
      >
        <div className="pointer-events-auto relative grid w-full max-w-xs grid-cols-3 items-stretch rounded-full border border-white/15 bg-zinc-900/55 py-4 px-2 shadow-[0_12px_32px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-2xl backdrop-saturate-150">
          <NavigationItems compact />
        </div>
      </nav>
    </div>
  )
}
