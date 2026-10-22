import type { LibraryStatus } from '../types/library'
import type {
  CopiedSite,
  CopySitesResponse,
  FollowConnection,
  FollowRequestItem,
  PrivacySettings,
  PublicProfile,
  SharedCollectionResponse,
  SharedSite,
  TermsDocument,
  UserSearchResponse,
} from '../types/sharing'
import { apiFetch, readApiError, readJson } from './client'

export async function fetchTerms(): Promise<TermsDocument> {
  return readJson<TermsDocument>(await apiFetch('/api/v1/terms', { method: 'GET' }))
}

export async function acceptTerms(termsVersion: string): Promise<TermsDocument> {
  const response = await apiFetch('/api/v1/auth/terms/accept', {
    method: 'POST',
    body: JSON.stringify({ terms_version: termsVersion }),
  })
  return readJson<TermsDocument>(response)
}

export async function fetchPrivacy(): Promise<PrivacySettings> {
  return readJson<PrivacySettings>(await apiFetch('/api/v1/me/privacy', { method: 'GET' }))
}

export async function updatePrivacy(body: Partial<PrivacySettings>): Promise<PrivacySettings> {
  const response = await apiFetch('/api/v1/me/privacy', {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  return readJson<PrivacySettings>(response)
}

export async function searchUsers(query: string, page: number): Promise<UserSearchResponse> {
  const params = new URLSearchParams({ q: query, page: String(page) })
  return readJson<UserSearchResponse>(await apiFetch(`/api/v1/users?${params.toString()}`, { method: 'GET' }))
}

export async function fetchProfile(username: string): Promise<PublicProfile> {
  return readJson<PublicProfile>(await apiFetch(`/api/v1/users/${encodeURIComponent(username)}`, { method: 'GET' }))
}

export async function fetchSharedCollection(
  username: string,
  page: number,
  status: LibraryStatus | null,
): Promise<SharedCollectionResponse> {
  const params = new URLSearchParams({ page: String(page) })
  if (status) {
    params.set('status', status)
  }
  return readJson<SharedCollectionResponse>(
    await apiFetch(`/api/v1/users/${encodeURIComponent(username)}/collection?${params.toString()}`, { method: 'GET' }),
  )
}

export async function fetchSharedSites(username: string): Promise<SharedSite[]> {
  return readJson<SharedSite[]>(await apiFetch(`/api/v1/users/${encodeURIComponent(username)}/sites`, { method: 'GET' }))
}

export async function copySharedSites(username: string, siteIds: string[]): Promise<CopySitesResponse> {
  const response = await apiFetch(`/api/v1/users/${encodeURIComponent(username)}/sites/copy`, {
    method: 'POST',
    body: JSON.stringify({ site_ids: siteIds }),
  })
  return readJson<CopySitesResponse>(response)
}

export async function followUser(username: string): Promise<PublicProfile> {
  const response = await apiFetch(`/api/v1/users/${encodeURIComponent(username)}/follow`, { method: 'POST' })
  return readJson<PublicProfile>(response)
}

export async function unfollowUser(username: string): Promise<PublicProfile> {
  const response = await apiFetch(`/api/v1/users/${encodeURIComponent(username)}/follow`, { method: 'DELETE' })
  return readJson<PublicProfile>(response)
}

export async function fetchFollowers(): Promise<FollowConnection[]> {
  return readJson<FollowConnection[]>(await apiFetch('/api/v1/me/followers', { method: 'GET' }))
}

export async function deleteFollower(username: string): Promise<void> {
  const response = await apiFetch(`/api/v1/me/followers/${encodeURIComponent(username)}`, { method: 'DELETE' })
  if (!response.ok) {
    throw await readApiError(response)
  }
}

export async function fetchFollowing(): Promise<FollowConnection[]> {
  return readJson<FollowConnection[]>(await apiFetch('/api/v1/me/following', { method: 'GET' }))
}

export async function fetchFollowRequests(): Promise<FollowRequestItem[]> {
  return readJson<FollowRequestItem[]>(await apiFetch('/api/v1/me/follow-requests', { method: 'GET' }))
}

export async function approveFollowRequest(username: string): Promise<void> {
  const response = await apiFetch(`/api/v1/me/follow-requests/${encodeURIComponent(username)}/approve`, { method: 'POST' })
  if (!response.ok) {
    throw await readApiError(response)
  }
}

export async function rejectFollowRequest(username: string): Promise<void> {
  const response = await apiFetch(`/api/v1/me/follow-requests/${encodeURIComponent(username)}/reject`, { method: 'POST' })
  if (!response.ok) {
    throw await readApiError(response)
  }
}

export async function fetchCopiedSites(): Promise<CopiedSite[]> {
  return readJson<CopiedSite[]>(await apiFetch('/api/v1/me/copied-sites', { method: 'GET' }))
}

export async function deleteCopiedSite(copiedSiteId: string): Promise<void> {
  const response = await apiFetch(`/api/v1/me/copied-sites/${encodeURIComponent(copiedSiteId)}`, { method: 'DELETE' })
  if (!response.ok) {
    throw await readApiError(response)
  }
}
