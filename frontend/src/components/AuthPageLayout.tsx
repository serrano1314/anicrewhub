import { PageTransition } from './PageTransition'
import type { ReactNode } from 'react'

export function AuthPageLayout({ children }: { children?: ReactNode }) {
  return (
    <div className="auth-scene relative min-h-screen overflow-hidden text-zinc-50">
      <div className="auth-scene__backdrop" aria-hidden="true">
        <div className="auth-scene__gradient" />
      </div>
      <main className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12">
        {children ?? <PageTransition />}
      </main>
    </div>
  )
}
