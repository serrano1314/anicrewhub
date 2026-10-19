import type {
  LibraryEntry,
  LibraryListResponse,
  LibraryStatus,
  ProgressState,
  WatchedEpisodes,
} from '../types/library'
import type { LibraryExportDocument, LibraryImportResponse } from '../types/libraryBackup'
import { apiFetch, readApiError, readJson } from './client'

export function fetchLibrary(
  status: LibraryStatus | undefined,
  page: number,
  query: string = '',
): Promise<LibraryListResponse> {
  const params = new URLSearchParams({ page: String(page) })
  if (status) {
    params.set('status', status)
  }
  if (query) {
    params.set('q', query)
  }
  return apiFetch(`/api/v1/library?${params.toString()}`).then((response) =>
    readJson<LibraryListResponse>(response),
  )
}

export function addToLibrary(anilistId: number, status: LibraryStatus): Promise<LibraryEntry> {
  return apiFetch('/api/v1/library', {
    method: 'POST',
    body: JSON.stringify({ anilist_id: anilistId, status }),
  }).then((response) => readJson<LibraryEntry>(response))
}

export function updateLibrary(
  anilistId: number,
  body: { status?: LibraryStatus; score?: number | null },
): Promise<LibraryEntry> {
  return apiFetch(`/api/v1/library/${anilistId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  }).then((response) => readJson<LibraryEntry>(response))
}

export async function removeFromLibrary(anilistId: number): Promise<void> {
  const response = await apiFetch(`/api/v1/library/${anilistId}`, { method: 'DELETE' })
  if (!response.ok) {
    throw await readApiError(response)
  }
}

export function fetchWatchedEpisodes(anilistId: number): Promise<WatchedEpisodes> {
  return apiFetch(`/api/v1/library/${anilistId}/episodes`).then((response) =>
    readJson<WatchedEpisodes>(response),
  )
}

export function setEpisodeWatched(
  anilistId: number,
  episode: number,
  watched: boolean,
): Promise<ProgressState> {
  return apiFetch(`/api/v1/library/${anilistId}/episodes/${episode}`, {
    method: 'PUT',
    body: JSON.stringify({ watched }),
  }).then((response) => readJson<ProgressState>(response))
}

export function markUpTo(anilistId: number, episode: number): Promise<ProgressState> {
  return apiFetch(`/api/v1/library/${anilistId}/episodes/mark-up-to/${episode}`, {
    method: 'POST',
  }).then((response) => readJson<ProgressState>(response))
}

export function fetchLibraryExport(): Promise<LibraryExportDocument> {
  return apiFetch('/api/v1/library/export').then((response) =>
    readJson<LibraryExportDocument>(response),
  )
}

export async function downloadLibraryExport(): Promise<void> {
  const backup = await fetchLibraryExport()
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = window.document.createElement('a')
  const stamp = backup.exported_at.slice(0, 10)
  anchor.href = url
  anchor.download = `anime-tracker-backup-${stamp}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

export function importLibraryBackup(document: unknown): Promise<LibraryImportResponse> {
  return apiFetch('/api/v1/library/import', {
    method: 'POST',
    body: JSON.stringify({ document }),
  }).then((response) => readJson<LibraryImportResponse>(response))
}

export async function findLibraryEntry(anilistId: number): Promise<LibraryEntry | null> {
  let page = 1
  for (;;) {
    const data = await fetchLibrary(undefined, page)
    const found = data.results.find((entry) => entry.anilist_id === anilistId)
    if (found) {
      return found
    }
    if (!data.has_next_page) {
      return null
    }
    page += 1
  }
}
