import type { NotificationList } from '../types/notifications'
import { apiFetch, readApiError, readJson } from './client'

export async function fetchNotifications(): Promise<NotificationList> {
  return readJson<NotificationList>(await apiFetch('/api/v1/me/notifications', { method: 'GET' }))
}

export async function markNotificationsRead(): Promise<void> {
  const response = await apiFetch('/api/v1/me/notifications/read', { method: 'POST' })
  if (!response.ok) {
    throw await readApiError(response)
  }
}
