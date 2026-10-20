import { PageTransition } from './PageTransition'
import type { ReactNode } from 'react'

export function AuthPageLayout({ children }: { children?: ReactNode }) {
  return (
    <div className="auth-scene relative min-h-screen overflow-hidden text-zinc-50">
      <div className="auth-scene__backdrop" aria-hidden="true">
        <div className="auth-scene__gradient" />
        <div className="auth-scene__grid" />
        <div className="auth-scene__orb auth-scene__orb--violet" />
        <div className="auth-scene__orb auth-scene__orb--indigo" />
        <div className="auth-scene__orb auth-scene__orb--cyan" />
        <div className="auth-scene__noise" />
      </div>

      <main className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12">
        {children ?? <PageTransition />}
      </main>
    </div>
  )
}
