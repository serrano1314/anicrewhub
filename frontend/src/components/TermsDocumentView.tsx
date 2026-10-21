import type { TermsDocument } from '../types/sharing'

export function TermsDocumentView({ terms }: { terms: TermsDocument }) {
  return (
    <article className="space-y-5">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-300">Version {terms.version}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">{terms.title}</h1>
      </header>
      {terms.sections.map((section) => (
        <section key={section.heading} className="space-y-1">
          <h2 className="text-sm font-semibold text-zinc-100">{section.heading}</h2>
          <p className="text-sm leading-relaxed text-zinc-400">{section.body}</p>
        </section>
      ))}
    </article>
  )
}
