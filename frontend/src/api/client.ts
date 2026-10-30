export class ApiError extends Error {
  readonly status: number
  readonly retryAfterSeconds: number | null

  constructor(message: string, status: number, retryAfterSeconds: number | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
  }
}

let accessToken: string | null = null
let refreshInFlight: Promise<string | null> | null = null
const tokenListeners = new Set<(token: string | null) => void>()

export function setAccessToken(token: string | null): void {
  accessToken = token
  for (const listener of tokenListeners) {
    listener(token)
  }
}

export function onAccessTokenChange(listener: (token: string | null) => void): () => void {
  tokenListeners.add(listener)
  return () => {
    tokenListeners.delete(listener)
  }
}

export function getAccessToken(): string | null {
  return accessToken
}

export function buildAuthHeaders(
  token: string | null,
  extra?: HeadersInit,
): Headers {
  const headers = new Headers(extra)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  return headers
}

export async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw await readApiError(response)
  }
  return (await response.json()) as T
}

export async function readApiError(response: Response): Promise<ApiError> {
  const data: unknown = await response.json().catch(() => null)
  let message = response.statusText || 'Request failed'
  if (data && typeof data === 'object' && 'detail' in data) {
    const detail = (data as { detail: unknown }).detail
    if (typeof detail === 'string') {
      message = detail
    } else if (Array.isArray(detail)) {
      message = 'Invalid request'
    }
  }
  const retryAfterHeader = response.headers.get('Retry-After')
  const parsedRetryAfter = retryAfterHeader != null ? Number(retryAfterHeader) : null
  const retryAfterSeconds =
    parsedRetryAfter != null && Number.isFinite(parsedRetryAfter) && parsedRetryAfter >= 0
      ? parsedRetryAfter
      : null
  return new ApiError(
    message,
    response.status,
    retryAfterSeconds,
  )
}

function canRenewSession(path: string): boolean {
  return (
    !path.startsWith('/api/v1/auth/refresh') &&
    !path.startsWith('/api/v1/auth/login') &&
    !path.startsWith('/api/v1/auth/register') &&
    !path.startsWith('/api/v1/auth/forgot-password') &&
    !path.startsWith('/api/v1/auth/reset-password')
  )
}

async function renewAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = fetch('/api/v1/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(async (response) => {
        if (!response.ok) {
          return null
        }
        const data: unknown = await response.json()
        if (
          !data ||
          typeof data !== 'object' ||
          !('access_token' in data) ||
          typeof data.access_token !== 'string'
        ) {
          return null
        }
        setAccessToken(data.access_token)
        return data.access_token
      })
      .finally(() => {
        refreshInFlight = null
      })
  }
  return refreshInFlight
}

export async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const response = await fetch(path, {
    ...options,
    headers: buildAuthHeaders(accessToken, options.headers),
    credentials: 'include',
  })
  if (response.status !== 401 || !canRenewSession(path)) {
    return response
  }
  const nextToken = await renewAccessToken()
  if (!nextToken) {
    return response
  }
  return fetch(path, {
    ...options,
    headers: buildAuthHeaders(nextToken, options.headers),
    credentials: 'include',
  })
}
