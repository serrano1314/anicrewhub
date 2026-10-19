import type { Anime } from './anime'
import type { LibraryStatus } from './library'

export type ExportEpisode = {
  episode_number: number
  watched_at: string
  source_site: string | null
}

export type ExportLibraryItem = {
  anilist_id: number
  status: LibraryStatus
  is_favorite: boolean
  score: number | null
  episodes: ExportEpisode[]
  anime: Anime
}

export type ExportSite = {
  site_key: string
  name: string
  base_url: string
  episode_url_template: string | null
  search_url_template: string | null
}

export type ExportAnimeSiteLink = {
  anilist_id: number
  site_key: string
  anime_url: string | null
}

export type LibraryExportDocument = {
  version: 1
  exported_at: string
  library: ExportLibraryItem[]
  sites: ExportSite[]
  anime_sites: ExportAnimeSiteLink[]
}

export type LibraryImportResponse = {
  library_entries_merged: number
  episodes_added: number
  episodes_updated: number
  sites_merged: number
  anime_site_links_merged: number
}
