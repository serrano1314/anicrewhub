import { apiFetch, readJson } from './client'

export type CharacterAvatar = {
  anilist_id: number
  name: string
  image_url: string
  anime_title: string | null
}

export function fetchCharacterAvatars(
  query = '',
  offset = 0,
  limit = 10,
): Promise<{ results: CharacterAvatar[]; has_more: boolean }> {
  const params = new URLSearchParams({ offset: String(offset), limit: String(limit) })
  if (query.trim()) {
    params.set('q', query.trim())
  }
  const suffix = params.size ? `?${params.toString()}` : ''
  return apiFetch(`/api/v1/anime/characters${suffix}`).then((response) =>
    readJson<{ results: CharacterAvatar[]; has_more: boolean }>(response),
  )
}
