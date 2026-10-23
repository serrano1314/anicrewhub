import type { LibraryStatus } from './library'

export type TermsSection = {
  heading: string
  body: string
}

export type TermsDocument = {
  version: string
  title: string
  sections: TermsSection[]
}

export type PrivacySettings = {
  profile_public: boolean
  share_collection: boolean
  share_favorites_only: boolean
  share_watch_sites: boolean
}

export type UserSearchResult = {
  username: string
  avatar_id: string | null
  profile_public: boolean
  follower_count: number | null
  is_self: boolean
  follow_state: FollowState | null
  follows_you: FollowState | null
}

export type UserSearchResponse = {
  page: number
  has_next_page: boolean
  results: UserSearchResult[]
}

export type FollowState = 'pending' | 'accepted'

export type PublicProfile = {
  username: string
  avatar_id: string | null
  is_self: boolean
  profile_public: boolean
  follow_state: FollowState | null
  follows_you: FollowState | null
  follower_count: number | null
  following_count: number | null
  can_view_collection: boolean
  can_view_sites: boolean
  incoming_request_count: number | null
}

export type FollowRequestItem = {
  username: string
  avatar_id: string | null
}

export type FollowConnection = {
  username: string
  avatar_id: string | null
  profile_public: boolean
}

export type SharedCollectionItem = {
  anilist_id: number
  title_romaji: string
  title_english: string | null
  cover_url: string | null
  format: string | null
  status: LibraryStatus
  watched_count: number
  last_episode_watched: number
  total_episodes: number | null
}

export type SharedCollectionResponse = {
  page: number
  has_next_page: boolean
  total_count: number
  results: SharedCollectionItem[]
}

export type SharedSite = {
  id: string
  name: string
  base_url: string
  episode_url_template: string | null
  search_url_template: string | null
  already_copied: boolean
}

export type CopiedSite = {
  id: string
  name: string
  base_url: string
  episode_url_template: string | null
  search_url_template: string | null
  source_username: string
  source_site_id: string
}

export type CopySitesResponse = {
  copied: CopiedSite[]
  already_copied: string[]
}
