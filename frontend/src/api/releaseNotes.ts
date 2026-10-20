import { apiFetch, readJson } from './client'

export type ReleaseNote = {
  version: string
  content_html: string
  created_at: string
}

export function fetchReleaseNote(version: string): Promise<ReleaseNote> {
  return apiFetch(`/api/v1/release-notes/${encodeURIComponent(version)}`).then((response) =>
    readJson<ReleaseNote>(response),
  )
}
