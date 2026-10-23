export type AvatarId = string

export type User = {
  id: string
  email: string
  username: string
  avatar_id: AvatarId | null
  profile_public: boolean
  share_collection: boolean
  share_favorites_only: boolean
  share_watch_sites: boolean
  terms_accepted: boolean
}

export type TokenResponse = {
  access_token: string
  token_type: string
}

export type RegisterRequest = {
  email: string
  username: string
  password: string
  terms_version: string
}

export type LoginRequest = {
  email: string
  password: string
}

export type ChangePasswordRequest = {
  current_password: string
  new_password: string
}

export type ForgotPasswordRequest = {
  email: string
}

export type ResetPasswordRequest = {
  token: string
  new_password: string
}
