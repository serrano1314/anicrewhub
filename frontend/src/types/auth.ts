export type AvatarId = string

export type User = {
  id: string
  email: string
  username: string
  avatar_id: AvatarId | null
}

export type TokenResponse = {
  access_token: string
  token_type: string
}

export type RegisterRequest = {
  email: string
  username: string
  password: string
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
