import { PageTransition } from './PageTransition'
import { InteractiveParticleBackground } from './InteractiveParticleBackground'
import type { ReactNode } from 'react'

export function AuthPageLayout({ children, particles = false }: { children?: ReactNode; particles?: boolean }) {
  return (
    <div className="auth-scene relative min-h-screen overflow-hidden text-zinc-50">
      <div className="auth-scene__backdrop" aria-hidden="true">
        <div className="auth-scene__gradient" />
      </div>
      {particles && <InteractiveParticleBackground />}

      <main className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12">
        {children ?? <PageTransition />}
      </main>
    </div>
  )
}
