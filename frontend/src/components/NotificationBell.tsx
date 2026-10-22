import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { clearAll, clearOne, fetchNotifications, markNotificationsRead } from '../api/notifications'
import type { AppNotification } from '../types/notifications'

function FollowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M16 21v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 19.5V21" strokeLinecap="round" />
      <circle cx="10" cy="8" r="3" />
      <path d="m16.5 11 1.5 1.5 3-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function FollowRequestIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M15 21v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 3 19.5V21" strokeLinecap="round" />
      <circle cx="9" cy="8" r="3" />
      <path d="M19 8v6M16 11h6" strokeLinecap="round" />
    </svg>
  )
}

function GenericIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const NOTIFICATION_ICONS: Record<string, () => ReactNode> = {
  follow: FollowIcon,
  follow_request: FollowRequestIcon,
}

function notificationIcon(type: string): ReactNode {
  const Icon = NOTIFICATION_ICONS[type] ?? GenericIcon
  return <Icon />
}

function notificationTime(value: string): string {
  const created = new Date(value).getTime()
  if (Number.isNaN(created)) {
    return ''
  }
  const minutes = Math.max(0, Math.round((Date.now() - created) / 60000))
  if (minutes < 1) {
    return 'Just now'
  }
  if (minutes < 60) {
    return `${minutes}m`
  }
  const hours = Math.round(minutes / 60)
  if (hours < 24) {
    return `${hours}h`
  }
  const days = Math.round(hours / 24)
  return `${days}d`
}

export function NotificationBell() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const panelId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  })
  const unreadCount = notificationsQuery.data?.unread_count ?? 0

  useEffect(() => {
    if (!open) {
      return
    }
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (!open || unreadCount === 0) {
      return
    }
    let cancelled = false
    void markNotificationsRead().then(() => {
      if (!cancelled) {
        void queryClient.invalidateQueries({ queryKey: ['notifications'] })
      }
    })
    return () => {
      cancelled = true
    }
  }, [open, queryClient, unreadCount])

  function openNotification(notification: AppNotification) {
    setOpen(false)
    if (notification.href) {
      void navigate(notification.href)
    }
  }

  function clearNotifications(action: () => Promise<void>) {
    void action().then(() => queryClient.invalidateQueries({ queryKey: ['notifications'] }))
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={open}
        aria-controls={panelId}
        title="Notifications"
        onClick={() => setOpen((current) => !current)}
        className="relative inline-flex size-9 items-center justify-center rounded-full border border-white/10 bg-zinc-900/70 text-zinc-400 shadow-sm shadow-black/20 transition hover:border-indigo-300/30 hover:bg-indigo-500/10 hover:text-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/60"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5" aria-hidden="true">
          <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {unreadCount > 0 ? <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-rose-500 ring-2 ring-zinc-950" /> : null}
      </button>
      {open ? (
        <section
          id={panelId}
          className="absolute right-0 z-[60] mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/95 shadow-2xl shadow-black/40 backdrop-blur-xl"
        >
          <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <h2 className="text-sm font-semibold text-zinc-50">Notifications</h2>
            {notificationsQuery.data && notificationsQuery.data.notifications.length > 0 ? (
              <button
                type="button"
                onClick={() => clearNotifications(clearAll)}
                className="text-xs text-zinc-400 transition hover:text-zinc-100"
              >
                Clear all
              </button>
            ) : null}
          </header>
          {notificationsQuery.isPending ? <p className="px-4 py-6 text-sm text-zinc-400">Loading notifications…</p> : null}
          {notificationsQuery.isError ? <p className="px-4 py-6 text-sm text-red-300">Could not load notifications.</p> : null}
          {notificationsQuery.data && notificationsQuery.data.notifications.length === 0 ? (
            <p className="px-4 py-6 text-sm text-zinc-400">No notifications yet.</p>
          ) : null}
          {notificationsQuery.data && notificationsQuery.data.notifications.length > 0 ? (
            <ul className="max-h-96 overflow-y-auto">
              {notificationsQuery.data.notifications.slice(0, 10).map((notification) => (
                <li key={notification.id} className="flex items-start transition hover:bg-white/5">
                  <button
                    type="button"
                    onClick={() => openNotification(notification)}
                    className="flex min-w-0 flex-1 items-start gap-3 py-3 pl-4 text-left"
                  >
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-400/10 text-indigo-200">
                      {notificationIcon(notification.type)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-zinc-100">{notification.title}</span>
                      {notification.body ? <span className="mt-0.5 block text-xs text-zinc-400">{notification.body}</span> : null}
                      <span className="mt-1 block text-[11px] text-zinc-500">{notificationTime(notification.created_at)}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label="Clear notification"
                    title="Clear"
                    onClick={() => clearNotifications(() => clearOne(notification.id))}
                    className="m-2 inline-flex size-7 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-white/10 hover:text-zinc-100"
                  >
                    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="m5 5 10 10M15 5 5 15" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
