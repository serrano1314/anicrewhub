import type {
  ChangePasswordRequest,
  AvatarId,
  ForgotPasswordRequest,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  TokenResponse,
  User,
} from '../types/auth'
import { apiFetch, readApiError } from './client'

async function parseToken(response: Response): Promise<TokenResponse> {
  if (!response.ok) {
    throw await readApiError(response)
  }
  return (await response.json()) as TokenResponse
}

export async function register(body: RegisterRequest): Promise<TokenResponse> {
  return parseToken(
    await apiFetch('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  )
}

export async function login(body: LoginRequest): Promise<TokenResponse> {
  return parseToken(
    await apiFetch('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  )
}

export async function refresh(): Promise<TokenResponse> {
  return parseToken(await apiFetch('/api/v1/auth/refresh', { method: 'POST' }))
}

export async function logout(): Promise<void> {
  const response = await apiFetch('/api/v1/auth/logout', { method: 'POST' })
  if (!response.ok) {
    throw await readApiError(response)
  }
}

export async function fetchMe(): Promise<User> {
  const response = await apiFetch('/api/v1/auth/me', { method: 'GET' })
  if (!response.ok) {
    throw await readApiError(response)
  }
  return (await response.json()) as User
}

export async function updateAvatar(avatarId: AvatarId | null): Promise<User> {
  const response = await apiFetch('/api/v1/auth/me/avatar', {
    method: 'PATCH',
    body: JSON.stringify({ avatar_id: avatarId }),
  })
  if (!response.ok) {
    throw await readApiError(response)
  }
  return (await response.json()) as User
}

export async function updateProfile(email: string, username: string): Promise<User> {
  const response = await apiFetch('/api/v1/auth/me/profile', {
    method: 'PATCH',
    body: JSON.stringify({ email, username }),
  })
  if (!response.ok) {
    throw await readApiError(response)
  }
  return (await response.json()) as User
}

export async function changePassword(body: ChangePasswordRequest): Promise<void> {
  const response = await apiFetch('/api/v1/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw await readApiError(response)
  }
}

export async function forgotPassword(body: ForgotPasswordRequest): Promise<void> {
  const response = await apiFetch('/api/v1/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw await readApiError(response)
  }
}

export async function resetPassword(body: ResetPasswordRequest): Promise<void> {
  const response = await apiFetch('/api/v1/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw await readApiError(response)
  }
}
