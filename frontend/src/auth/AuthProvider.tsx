import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { fetchMe, login as loginRequest, logout as logoutRequest, refresh, register as registerRequest, updateAvatar as updateAvatarRequest, updateProfile as updateProfileRequest } from '../api/auth'
import { acceptTerms as acceptTermsRequest, fetchTerms } from '../api/sharing'
import { ApiError, onAccessTokenChange, setAccessToken } from '../api/client'
import type { AvatarId, User } from '../types/auth'

type AuthContextValue = {
  user: User | null
  isReady: boolean
  isAuthenticated: boolean
  authError: boolean
  retryAuth: () => void
  login: (email: string, password: string) => Promise<void>
  register: (email: string, username: string, password: string, termsVersion: string) => Promise<void>
  acceptTerms: () => Promise<void>
  updateAvatar: (avatarId: AvatarId | null, avatarUrl?: string | null) => Promise<void>
  updateProfile: (email: string, username: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [token, setToken] = useState<string | null>(null)
  const [bootstrapDone, setBootstrapDone] = useState(false)
  const [bootstrapError, setBootstrapError] = useState(false)
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0)

  const applyToken = useCallback((next: string | null) => {
    setAccessToken(next)
    setToken(next)
  }, [])
  const retryAuth = useCallback(() => {
    setBootstrapAttempt((attempt) => attempt + 1)
  }, [])

  useEffect(() => onAccessTokenChange(setToken), [])

  useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      setBootstrapDone(false)
      setBootstrapError(false)
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const data = await refresh()
          if (!cancelled) {
            applyToken(data.access_token)
          }
          break
        } catch (error) {
          if (cancelled) {
            return
          }
          if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
            applyToken(null)
            break
          }
          if (attempt === 2) {
            setBootstrapError(true)
            break
          }
          await new Promise((resolve) => window.setTimeout(resolve, 500 * (attempt + 1)))
        }
      }
      if (!cancelled) {
        setBootstrapDone(true)
      }
    }
    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [applyToken, bootstrapAttempt])

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    enabled: bootstrapDone && token !== null,
    retry: (failureCount, error) =>
      !(error instanceof ApiError && (error.status === 401 || error.status === 403)) &&
      failureCount < 2,
  })

  useEffect(() => {
    if (
      meQuery.isError &&
      meQuery.error instanceof ApiError &&
      (meQuery.error.status === 401 || meQuery.error.status === 403)
    ) {
      applyToken(null)
    }
  }, [applyToken, meQuery.error, meQuery.isError])

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await loginRequest({ email, password })
      applyToken(data.access_token)
      await queryClient.fetchQuery({ queryKey: ['me'], queryFn: fetchMe })
    },
    [applyToken, queryClient],
  )

  const register = useCallback(
    async (email: string, username: string, password: string, termsVersion: string) => {
      const data = await registerRequest({ email, username, password, terms_version: termsVersion })
      applyToken(data.access_token)
      await queryClient.fetchQuery({ queryKey: ['me'], queryFn: fetchMe })
    },
    [applyToken, queryClient],
  )

  const acceptTerms = useCallback(async () => {
    const terms = await fetchTerms()
    await acceptTermsRequest(terms.version)
    await queryClient.fetchQuery({ queryKey: ['me'], queryFn: fetchMe })
  }, [queryClient])

  const logout = useCallback(async () => {
    try {
      await logoutRequest()
    } finally {
      applyToken(null)
      queryClient.removeQueries({ queryKey: ['me'] })
    }
  }, [applyToken, queryClient])

  const updateAvatar = useCallback(
    async (avatarId: AvatarId | null, avatarUrl: string | null = null) => {
      const user = await updateAvatarRequest(avatarId, avatarUrl)
      queryClient.setQueryData(['me'], user)
    },
    [queryClient],
  )

  const updateProfile = useCallback(
    async (email: string, username: string) => {
      const user = await updateProfileRequest(email, username)
      queryClient.setQueryData(['me'], user)
    },
    [queryClient],
  )

  const meSettled = token === null || meQuery.isSuccess || meQuery.isError
  const isReady = bootstrapDone && meSettled
  const isAuthenticated = token !== null && meQuery.data !== undefined
  const authError =
    bootstrapError ||
    (token !== null &&
      meQuery.isError &&
      !(meQuery.error instanceof ApiError && (meQuery.error.status === 401 || meQuery.error.status === 403)) &&
      meQuery.data === undefined)

  const value = useMemo<AuthContextValue>(
    () => ({
      user: meQuery.data ?? null,
      isReady,
      isAuthenticated,
      authError,
      retryAuth,
      login,
      register,
      acceptTerms,
      updateAvatar,
      updateProfile,
      logout,
    }),
    [acceptTerms, authError, isAuthenticated, isReady, login, logout, meQuery.data, register, retryAuth, updateAvatar, updateProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
