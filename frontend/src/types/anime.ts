export type ExternalLink = {
  site: string
  url: string
}

export type RelatedAnime = {
  anilist_id: number
  title: string
  relation: string
  format: string | null
  cover_url: string | null
}

export type Anime = {
  anilist_id: number
  mal_id: number | null
  title_romaji: string
  title_english: string | null
  title_synonyms: string[]
  cover_url: string | null
  description: string | null
  format: string | null
  total_episodes: number | null
  average_score: number | null
  airing_status: string | null
  season_year: number | null
  external_links: ExternalLink[]
  details: AnimeDetails
}

export type AnimeDetails = {
  genres: string[]
  studios: string[]
  tags: { name: string; rank: number | null; is_spoiler: boolean }[]
  related_anime: RelatedAnime[]
  source: string | null
  duration_minutes: number | null
  country_of_origin: string | null
  season: string | null
  start_date: string | null
  end_date: string | null
  popularity: number | null
  favorites: number | null
  banner_url: string | null
  trailer_url: string | null
  next_episode: number | null
  next_airing_at: number | null
}

export type AnimeDetail = Anime & {
  last_synced_at: string
}

export type AnimeSearchResponse = {
  page: number
  has_next_page: boolean
  results: Anime[]
}

export type WatchLinkSource = 'saved' | 'official' | 'search'

export type WatchLink = {
  label: string
  url: string
  source: WatchLinkSource
}
