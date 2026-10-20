import type { AnimeDetail, AnimeSearchResponse, RelatedAnime, WatchLink } from '../types/anime'
import { apiFetch, readJson } from './client'

export function searchAnime(query: string, page: number): Promise<AnimeSearchResponse> {
  const params = new URLSearchParams({ q: query, page: String(page) })
  return apiFetch(`/api/v1/anime/search?${params.toString()}`).then((response) =>
    readJson<AnimeSearchResponse>(response),
  )
}

export function discoverAnime(kind: 'latest' | 'trending'): Promise<AnimeSearchResponse> {
  return apiFetch(`/api/v1/anime/discover/${kind}`).then((response) =>
    readJson<AnimeSearchResponse>(response),
  )
}

export function fetchAnime(anilistId: number): Promise<AnimeDetail> {
  return apiFetch(`/api/v1/anime/${anilistId}`).then((response) => readJson<AnimeDetail>(response))
}

export function fetchRelatedAnime(anilistId: number): Promise<RelatedAnime[]> {
  return apiFetch(`/api/v1/anime/${anilistId}/related`).then((response) =>
    readJson<RelatedAnime[]>(response),
  )
}

export function fetchWatchLinks(anilistId: number, episode: number): Promise<WatchLink[]> {
  return apiFetch(`/api/v1/anime/${anilistId}/episodes/${episode}/watch-links`).then((response) =>
    readJson<WatchLink[]>(response),
  )
}
