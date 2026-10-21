import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiFetch, buildAuthHeaders, readApiError, readJson, setAccessToken } from './client'

describe('buildAuthHeaders', () => {
  it('sets JSON content type and omits Authorization when logged out', () => {
    const headers = buildAuthHeaders(null)
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(headers.get('Authorization')).toBeNull()
  })

  it('adds a Bearer token when logged in', () => {
    const headers = buildAuthHeaders('abc123')
    expect(headers.get('Authorization')).toBe('Bearer abc123')
  })
})

describe('readApiError', () => {
  it('reads a FastAPI string detail', async () => {
    const response = new Response(JSON.stringify({ detail: 'Invalid email or password' }), {
      status: 401,
      statusText: 'Unauthorized',
    })
    const error = await readApiError(response)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(401)
    expect(error.message).toBe('Invalid email or password')
  })
})

describe('apiFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    setAccessToken(null)
  })

  it('renews an expired access token and retries the request', async () => {
    setAccessToken('expired')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: 'Unauthorized' }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'fresh' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ email: 'steven@example.com' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const response = await apiFetch('/api/v1/auth/me')

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/v1/auth/refresh')
    expect(new Headers(fetchMock.mock.calls[2]?.[1].headers).get('Authorization')).toBe('Bearer fresh')
  })

  it('does not renew a failed login', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ detail: 'Invalid email or password' }), { status: 401 }))
    vi.stubGlobal('fetch', fetchMock)

    const response = await apiFetch('/api/v1/auth/login', { method: 'POST' })

    expect(response.status).toBe(401)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('readJson', () => {
  it('returns the JSON body when the response is ok', async () => {
    const response = new Response(JSON.stringify({ ok: true }), { status: 200 })
    await expect(readJson<{ ok: boolean }>(response)).resolves.toEqual({ ok: true })
  })

  it('throws ApiError when the response failed', async () => {
    const response = new Response(JSON.stringify({ detail: 'Nope' }), { status: 404 })
    await expect(readJson(response)).rejects.toMatchObject({
      status: 404,
      message: 'Nope',
    })
  })
})
