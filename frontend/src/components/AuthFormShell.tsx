import type { ReactNode } from 'react'

type AuthFormShellProps = {
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
}

export function AuthFormShell({ title, description, children, footer }: AuthFormShellProps) {
  return (
    <div className="w-full max-w-md">
      {/* <header className="mb-7 flex flex-col items-center text-center">
        <div className="auth-logo-glow relative">
          <div className="auth-logo-ring flex h-[4.25rem] w-[4.25rem] items-center justify-center rounded-2xl border border-white/10 bg-zinc-900/60 shadow-lg shadow-indigo-950/50 backdrop-blur-md">
            <img src="/favicon.svg" alt="" className="size-11 drop-shadow-sm" width={44} height={44} />
          </div>
        </div>
        <p className="brand-wordmark mt-5 text-[11px] uppercase tracking-[0.2em] text-indigo-300/90"></p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-400">{description}</p> : null}
      </header> */}

      <div className="auth-panel relative overflow-hidden space-y-5 p-6 sm:p-8">
        <p className="brand-wordmark mt-5 text-[11px] uppercase tracking-[0.2em] text-indigo-300/90"></p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-400">{description}</p> : null}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-indigo-400/8 to-transparent" />
        <div className="relative">{children}</div>

        {footer ? <div className="relative mt-7 border-t border-white/10 pt-5 text-center text-sm text-zinc-400">{footer}</div> : null}
      </div>
    </div>
  )
}
