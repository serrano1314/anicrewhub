import { type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { NotificationBell } from './NotificationBell'
import { PageTransition } from './PageTransition'
import { ProfileAvatar } from './ProfileAvatar'
import { useAuth } from '../auth/AuthProvider'
import { useDialog } from './dialogContext'
import { APP_VERSION } from '../lib/config'
import type { AvatarId } from '../types/auth'
import { cn } from '../lib/ui'

type NavItem = {
  to: string
  end?: boolean
  label: string
  icon: (props: { active: boolean }) => ReactNode
}

type NavigationItemsProps = {
  compact?: boolean
  username: string
  avatarId: AvatarId | null
}

function navClass(active: boolean, compact = false): string {
  const base = compact
    ? 'relative z-10 flex h-full w-full min-w-0 items-center justify-center rounded-full px-0 py-2 transition-colors duration-200 ease-out'
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
    label: 'Collections',
    icon: ({ active }) => (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={`h-5 w-5 ${active ? 'stroke-indigo-200' : 'stroke-current'}`} fill="none" strokeWidth="1.8">
        <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: '/users',
    end: true,
    label: 'Search users',
    icon: ({ active }) => (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={`h-5 w-5 ${active ? 'stroke-indigo-200' : 'stroke-current'}`} fill="none" strokeWidth="1.8">
        <path d="M16 21v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 19.5V21" strokeLinecap="round" />
        <circle cx="10" cy="8" r="3" />
        <path d="M20 8v6M17 11h6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: '/search',
    label: 'Search/Add anime',
    icon: ({ active }) => (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={`h-5 w-5 ${active ? 'text-indigo-200' : 'text-current'}`} fill="none">
        <circle cx="9.5" cy="10" r="6.25" stroke="currentColor" strokeWidth="1.8" />
        <path d="m14.1 14.6 4.15 4.15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="18" cy="6" r="4.25" fill={active ? '#818cf8' : '#71717a'} stroke="#18181b" strokeWidth="1.2" />
        <path d="M18 3.9v4.2M15.9 6h4.2" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
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

function NavigationItems({
  compact = false,
  username,
  avatarId,
}: NavigationItemsProps) {
  const { pathname } = useLocation()
  const routeIndex = NAV_ITEMS.findIndex((item) => (item.end ? pathname === item.to : pathname.startsWith(item.to)))
  const activeIndex = pathname.startsWith('/profile') ? NAV_ITEMS.length : routeIndex
  const hasActiveNav = activeIndex >= 0

  return (
    <>
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute top-1 bottom-1 left-1 w-[calc((100%-0.5rem)/5)] rounded-full bg-indigo-500/20 ring-1 ring-indigo-400/30 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
          hasActiveNav ? 'opacity-100' : 'opacity-0',
        )}
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
              {compact ? <span className="sr-only">{item.label}</span> : null}
            </>
          )}
        </NavLink>
      ))}
      <NavLink
        to="/profile"
        aria-label="Profile"
        title="Profile"
        className={({ isActive }) => navClass(isActive, compact)}
      >
        {({ isActive }) => (
          <>
            <span className={cn(
              'flex items-center justify-center rounded-full transition',
              compact ? 'size-10' : 'size-7',
            )}>
              <ProfileAvatar
                username={username}
                avatarId={avatarId}
                size="sm"
                className={cn('size-full', isActive && '!ring-0')}
              />
            </span>
            {compact ? <span className="sr-only">Profile</span> : null}
          </>
        )}
      </NavLink>
    </>
  )
}

export function AppShell({ children }: { children?: ReactNode }) {
  const { user } = useAuth()
  const dialog = useDialog()

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
            <span className="brand-wordmark hidden text-[1.02rem] text-zinc-100 sm:inline">Anime Tracker</span>
          </NavLink>

          <nav
            className="relative mx-auto hidden w-80 grid-cols-5 items-center rounded-full border border-white/10 bg-zinc-900/50 p-1 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] md:grid md:mx-auto md:fixed md:left-1/2 md:-translate-x-1/2 md:top-16 md:z-50 md:bg-zinc-900/90 md:backdrop-blur-xl md:shadow-xl md:border-white/15"
            aria-label="Main"
          >
            {user ? (
              <NavigationItems username={user.username} avatarId={user.avatar_id} />
            ) : null}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
            <button
              type="button"
              aria-label="Help"
              title="Help"
              onClick={() => {
                void dialog.success({
                  title: 'Help center coming soon',
                  message: 'The help center is still in development and is not available yet.',
                })
              }}
              className="inline-flex size-9 items-center justify-center rounded-full border border-white/10 bg-zinc-900/70 text-zinc-400 shadow-sm shadow-black/20 transition hover:border-indigo-300/30 hover:bg-indigo-500/10 hover:text-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/60"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M9.7 9a2.4 2.4 0 1 1 4.1 1.7c-1.1 1.1-1.8 1.4-1.8 3" strokeLinecap="round" />
                <circle cx="12" cy="17" r=".8" fill="currentColor" stroke="none" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-5xl px-4 py-8 pb-32 md:pb-10">
        {children ?? <PageTransition />}
      </main>

      <footer className="relative mx-auto pt-50 flex w-full max-w-5xl flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 pb-28 text-center text-xs text-zinc-500 md:pb-6">
        <span>
          Anime metadata by{' '}
          <a
            href="https://anilist.co"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-400 underline decoration-white/20 underline-offset-2 transition-colors hover:text-indigo-200"
          >
            AniList
          </a>
        </span>
        <span aria-hidden="true" className="text-zinc-700">·</span>
        <span>Anime Tracker v{APP_VERSION}</span>
      </footer>

      <nav
        className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4 pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Main"
      >
        <div className="pointer-events-auto relative grid w-full max-w-md grid-cols-5 items-stretch rounded-full border border-white/15 bg-zinc-900/55 p-1 shadow-[0_12px_32px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-2xl backdrop-saturate-150">
          {user ? (
            <NavigationItems compact username={user.username} avatarId={user.avatar_id} />
          ) : null}
        </div>
      </nav>
    </div>
  )
}
