import type { AnimeSite, SiteInput, WatchSite } from '../types/sites'
import { apiFetch, readApiError, readJson } from './client'

export function fetchSites(): Promise<WatchSite[]> {
  return apiFetch('/api/v1/sites').then((response) => readJson<WatchSite[]>(response))
}

export function createSite(body: SiteInput): Promise<WatchSite> {
  return apiFetch('/api/v1/sites', {
    method: 'POST',
    body: JSON.stringify(body),
  }).then((response) => readJson<WatchSite>(response))
}

export function updateSite(siteId: string, body: SiteInput): Promise<WatchSite> {
  return apiFetch(`/api/v1/sites/${siteId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  }).then((response) => readJson<WatchSite>(response))
}

export async function deleteSite(siteId: string): Promise<void> {
  const response = await apiFetch(`/api/v1/sites/${siteId}`, { method: 'DELETE' })
  if (!response.ok) {
    throw await readApiError(response)
  }
}

export function fetchAnimeSites(anilistId: number): Promise<AnimeSite[]> {
  return apiFetch(`/api/v1/library/${anilistId}/sites`).then((response) =>
    readJson<AnimeSite[]>(response),
  )
}

export function addAnimeSite(
  anilistId: number,
  siteId: string,
  animeUrl: string,
): Promise<AnimeSite> {
  return apiFetch(`/api/v1/library/${anilistId}/sites`, {
    method: 'POST',
    body: JSON.stringify({
      site_id: siteId,
      anime_url: animeUrl.trim() ? animeUrl.trim() : null,
    }),
  }).then((response) => readJson<AnimeSite>(response))
}

export function updateAnimeSite(
  anilistId: number,
  siteId: string,
  animeUrl: string,
): Promise<AnimeSite> {
  return apiFetch(`/api/v1/library/${anilistId}/sites/${siteId}`, {
    method: 'PATCH',
    body: JSON.stringify({ anime_url: animeUrl.trim() || null }),
  }).then((response) => readJson<AnimeSite>(response))
}

export async function removeAnimeSite(anilistId: number, siteId: string): Promise<void> {
  const response = await apiFetch(`/api/v1/library/${anilistId}/sites/${siteId}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    throw await readApiError(response)
  }
}
