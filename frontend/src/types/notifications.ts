export type AppNotification = {
  id: string
  type: string
  title: string
  body: string | null
  actor_username: string | null
  href: string | null
  read: boolean
  created_at: string
}

export type NotificationList = {
  unread_count: number
  notifications: AppNotification[]
}
