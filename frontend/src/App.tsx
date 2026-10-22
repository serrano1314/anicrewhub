import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { AppShell } from './components/AppShell'
import { AuthPageLayout } from './components/AuthPageLayout'
import { DialogProvider } from './components/DialogProvider'
import { ProtectedRoute } from './components/ProtectedRoute'
import { TermsGate } from './components/TermsGate'
import { AuthRecoveryScreen } from './components/AuthRecoveryScreen'
import { AnimeDetailPage } from './pages/AnimeDetailPage'
import { LibraryPage } from './pages/LibraryPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { LoginPage } from './pages/LoginPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { SearchPage } from './pages/SearchPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ProfilePage } from './pages/ProfilePage'
import { SettingsPage } from './pages/SettingsPage'
import { TermsPage } from './pages/TermsPage'
import { UserProfilePage } from './pages/UserProfilePage'
import { UserSearchPage } from './pages/UserSearchPage'

const queryClient = new QueryClient()

function HomePage() {
  const { isReady, isAuthenticated, authError, user } = useAuth()

  if (!isReady) {
    return (
      <AuthPageLayout>
        <main className="flex min-h-screen w-full items-center justify-center" role="status" aria-busy="true">
          <span className="sr-only">Loading AnimeCrew Hub…</span>
          <div className="size-10 animate-pulse rounded-2xl bg-indigo-400/20 ring-1 ring-indigo-300/20" />
        </main>
      </AuthPageLayout>
    )
  }

  if (authError) {
    return <AuthRecoveryScreen />
  }

  if (isAuthenticated && user && !user.terms_accepted) {
    return <TermsGate />
  }

  if (!isAuthenticated) {
    return (
      <AuthPageLayout>
        <LoginPage />
      </AuthPageLayout>
    )
  }

  return (
    <AppShell>
      <LibraryPage />
    </AppShell>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DialogProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route element={<AuthPageLayout />}>
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
              </Route>
              <Route element={<ProtectedRoute />}>
                <Route element={<AppShell />}>
                  <Route path="/search" element={<SearchPage />} />
                  <Route path="/users" element={<UserSearchPage />} />
                  <Route path="/users/:username" element={<UserProfilePage />} />
                  <Route path="/anime/:anilistId" element={<AnimeDetailPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
        </DialogProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
